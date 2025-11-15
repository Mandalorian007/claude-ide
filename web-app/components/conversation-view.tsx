"use client";

import { useEffect, useState, useRef } from "react";
import { getSession, continueSession, createPR } from "@/app/actions";
import { Session, SessionMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitBranch, FolderGit2, ExternalLink } from "lucide-react";
import { Message, MessageContent, MessageAvatar } from "@/components/ui/shadcn-io/ai/message";
import { Response } from "@/components/ui/shadcn-io/ai/response";
import { Conversation, ConversationContent } from "@/components/ui/shadcn-io/ai/conversation";
import { Loader } from "@/components/ui/shadcn-io/ai/loader";
import { Textarea } from "@/components/ui/textarea";

export function ConversationView({ sessionId }: { sessionId: string | null }) {
  const [session, setSession] = useState<Session | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [showPRForm, setShowPRForm] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<SessionMessage[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial session and setup streaming
  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setStreamingMessages([]);
      // Close any existing stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const loadSession = async () => {
      const data = await getSession(sessionId);
      setSession(data);
      if (data) {
        setStreamingMessages(data.messages);
      }
    };

    loadSession();

    // Small delay before setting up SSE to ensure session is fully propagated
    const sseTimeout = setTimeout(() => {
      // Setup Server-Sent Events for streaming updates
      console.log(`[Client] Setting up SSE for session: ${sessionId}`);
      const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);
      eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("[Client] SSE connection opened");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[Client] SSE message received:", data.type);

        if (data.type === "init") {
          // Initial session state
          console.log("[Client] Received initial session state");
          setSession(data.session);
          setStreamingMessages(data.session.messages);
        } else if (data.type === "message") {
          // New message received
          console.log("[Client] New message received");

          // Avoid duplicates - check if message already exists
          setStreamingMessages((prev) => {
            const isDuplicate = prev.some(
              (msg) =>
                msg.type === data.message.type &&
                msg.content === data.message.content &&
                Math.abs(new Date(msg.timestamp).getTime() - new Date(data.message.timestamp).getTime()) < 1000
            );

            if (isDuplicate) {
              console.log("[Client] Duplicate message detected, skipping");
              return prev;
            }

            return [...prev, data.message];
          });

          // Update session metadata
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.session.status,
              contextUsed: data.session.contextUsed,
              totalTokens: data.session.totalTokens,
              totalCost: data.session.totalCost,
            };
          });
        } else if (data.type === "complete") {
          // Session completed - update state but keep connection open for potential continuation
          console.log("[Client] Session completed (keeping connection open for continuation)");
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.session.status,
              contextUsed: data.session.contextUsed,
              totalTokens: data.session.totalTokens,
              totalCost: data.session.totalCost,
              sdkSessionId: data.session.sdkSessionId,
            };
          });
          // Keep connection open - don't close it, in case user continues the session
        } else if (data.type === "error") {
          console.error("[Client] SSE error:", data.error);
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (error) {
        console.error("[Client] Failed to parse SSE message:", error, event.data);
      }
    };

      eventSource.onerror = (error) => {
        const readyState = eventSource.readyState;

        if (readyState === EventSource.CLOSED) {
          console.log("[Client] SSE connection closed");
          // Don't log as error if we manually closed it
          if (eventSourceRef.current === eventSource) {
            eventSourceRef.current = null;
          }
        } else if (readyState === EventSource.CONNECTING) {
          // Reconnecting - this is normal, just log once
          console.log("[Client] SSE reconnecting...");
        } else {
          console.error("[Client] SSE connection error, readyState:", readyState);
        }
      };
    }, 100); // Small delay to ensure session is available

    return () => {
      clearTimeout(sseTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [sessionId]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !followUpPrompt.trim()) return;

    const userPrompt = followUpPrompt;
    setIsLoading(true);
    setFollowUpPrompt("");

    // Optimistically add user message to UI
    const userMessage: SessionMessage = {
      timestamp: new Date(),
      type: "user",
      content: userPrompt,
    };
    setStreamingMessages((prev) => [...prev, userMessage]);

    // Optimistically update session status to active
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, status: "active" };
    });

    try {
      const result = await continueSession(sessionId, userPrompt);
      if (!result.success) {
        // Revert optimistic updates on error
        setStreamingMessages((prev) => prev.slice(0, -1));
        setSession((prev) => {
          if (!prev) return prev;
          return { ...prev, status: "completed" };
        });
        setFollowUpPrompt(userPrompt);
        console.error("Failed to continue session:", result.error);
      }
    } catch (error) {
      // Revert optimistic updates on error
      setStreamingMessages((prev) => prev.slice(0, -1));
      setSession((prev) => {
        if (!prev) return prev;
        return { ...prev, status: "completed" };
      });
      setFollowUpPrompt(userPrompt);
      console.error("Failed to continue session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePR = async () => {
    if (!sessionId || !session) return;

    const title = prTitle.trim() || session.title;
    const body = prBody.trim() || session.description;

    setIsCreatingPR(true);

    try {
      const result = await createPR(sessionId, title, body);
      if (result.success && result.prUrl) {
        setShowPRForm(false);
        setPrTitle("");
        setPrBody("");
        window.open(result.prUrl, "_blank");
      } else {
        alert(`Failed to create PR: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to create PR:", error);
      alert("Failed to create pull request");
    } finally {
      setIsCreatingPR(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Select a session to view conversation</p>
          <p className="mt-1 text-xs">or start a new session above</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  // Group messages by sub-agent for Branch visualization
  const messagesWithBranches = streamingMessages.reduce((acc, message, index) => {
    const isSubAgent = message.metadata?.sub_agent_id;

    if (isSubAgent && message.metadata) {
      const subAgentId = message.metadata.sub_agent_id;
      const subAgentType = message.metadata.sub_agent_type || "sub-agent";

      // Find or create branch
      let branch = acc.find((item) => item.type === "branch" && item.subAgentId === subAgentId);
      if (!branch) {
        const newBranch: { type: "branch"; subAgentId: string; subAgentType: string; messages: Array<{ message: SessionMessage; index: number }> } = {
          type: "branch" as const,
          subAgentId,
          subAgentType,
          messages: [],
        };
        acc.push(newBranch);
        newBranch.messages.push({ message, index });
      } else if (branch.type === "branch") {
        branch.messages.push({ message, index });
      }
    } else {
      acc.push({ type: "message" as const, message, index });
    }

    return acc;
  }, [] as Array<
    | { type: "message"; message: SessionMessage; index: number }
    | { type: "branch"; subAgentId: string; subAgentType: string; messages: Array<{ message: SessionMessage; index: number }> }
  >);

  return (
    <div className="flex h-full flex-col">
      {/* Session Header */}
      <div className="border-b p-4 space-y-3">
        <div>
          <h2 className="font-semibold">{session.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.status} • {Math.round(session.contextUsed / 1000)}k/{Math.round(session.maxContext / 1000)}k context
          </p>
        </div>

        {/* Workspace Info */}
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FolderGit2 className="h-3 w-3" />
            <span className="font-mono truncate">{session.workspacePath}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <span className="font-mono">{session.gitBranch}</span>
          </div>
        </div>

        {/* PR Actions */}
        {session.status === "completed" && (
          <div className="pt-2 border-t">
            {session.prUrl ? (
              <a
                href={session.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                View Pull Request
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : showPRForm ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  placeholder={session.title}
                  className="w-full px-2 py-1 text-sm border rounded"
                  disabled={isCreatingPR}
                />
                <Textarea
                  value={prBody}
                  onChange={(e) => setPrBody(e.target.value)}
                  placeholder={session.description}
                  className="min-h-[80px] resize-none text-sm"
                  disabled={isCreatingPR}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreatePR}
                    disabled={isCreatingPR}
                  >
                    {isCreatingPR ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Creating PR...
                      </>
                    ) : (
                      "Create Pull Request"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPRForm(false)}
                    disabled={isCreatingPR}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPRForm(true)}
              >
                Create Pull Request
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messagesWithBranches.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No messages yet
            </div>
          ) : (
            messagesWithBranches.map((item, itemIndex) => {
              if (item.type === "branch") {
                return (
                  <div key={`branch-${item.subAgentId}`} className="my-4 pl-4 border-l-2 border-primary/30">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      🤖 Sub-agent: {item.subAgentType}
                    </div>
                    {item.messages.map(({ message, index }) => (
                      <MessageComponent key={index} message={message} />
                    ))}
                  </div>
                );
              } else {
                return <MessageComponent key={item.index} message={item.message} />;
              }
            })
          )}

          {/* Loading indicator */}
          {session.status === "active" && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader />
              <span>Claude is working...</span>
            </div>
          )}
        </ConversationContent>
      </Conversation>

      {/* Continue Input - Always visible */}
      <div className="border-t p-3">
        <form onSubmit={handleContinue} className="flex gap-2 items-end">
          <div className="flex-1">
            <Textarea
              value={followUpPrompt}
              onChange={(e) => setFollowUpPrompt(e.target.value)}
              placeholder={
                session.status === "active"
                  ? "Session is running..."
                  : session.sdkSessionId
                  ? "Continue this session..."
                  : "Session cannot be continued"
              }
              disabled={isLoading || session.status === "active" || !session.sdkSessionId}
              className="min-h-[60px] max-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (followUpPrompt.trim() && !isLoading && session.status !== "active" && session.sdkSessionId) {
                    handleContinue(e as any);
                  }
                }
              }}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={
              !followUpPrompt.trim() ||
              isLoading ||
              session.status === "active" ||
              !session.sdkSessionId
            }
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </form>
        {session.status === "active" ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Waiting for session to complete...
          </p>
        ) : session.sdkSessionId ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Press ⌘+Enter to send
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            This session cannot be continued
          </p>
        )}
      </div>
    </div>
  );
}

function MessageComponent({ message }: { message: SessionMessage }) {
  const isUser = message.type === "user";
  const isAssistant = message.type === "assistant";
  const isSystem = message.type === "system";
  const isSubAgent = message.metadata?.sub_agent_id;

  return (
    <Message
      from={isUser ? "user" : "assistant"}
      className={isSystem ? "justify-center" : ""}
    >
      <MessageAvatar
        src={isUser ? "https://github.com/shadcn.png" : ""}
        name={
          isUser ? "You" :
          isSubAgent ? message.metadata?.sub_agent_type || "Sub-agent" :
          isSystem ? "System" :
          "Claude"
        }
      />
      <MessageContent>
        {/* Header with role, timestamp, and tokens */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium opacity-70">
              {isUser && "You"}
              {isAssistant && !isSubAgent && "Claude"}
              {isSubAgent && `Sub-agent: ${message.metadata?.sub_agent_type || "Unknown"}`}
              {isSystem && "System"}
            </span>
            <span className="text-xs opacity-50">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Token usage inline with timestamp */}
          {message.metadata?.tokens && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                In: {message.metadata.tokens.input.toLocaleString()}
              </Badge>
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                Out: {message.metadata.tokens.output.toLocaleString()}
              </Badge>
              {message.metadata.tokens.cache_read > 0 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  Cached: {message.metadata.tokens.cache_read.toLocaleString()}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Message Content */}
        {isAssistant || isUser ? (
          <Response>{message.content}</Response>
        ) : (
          <pre className="whitespace-pre-wrap text-sm">{message.content}</pre>
        )}
      </MessageContent>
    </Message>
  );
}
