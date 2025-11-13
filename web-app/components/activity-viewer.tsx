"use client";

import { useEffect, useState, useRef } from "react";
import { Agent, AgentMessage } from "@/lib/types";
import { getAgent, continueAgent } from "@/app/actions";
import { Activity, Terminal, User, Wrench, CheckCircle, XCircle, Send, Loader2 } from "lucide-react";
import ConfettiExplosion from "react-confetti-explosion";

interface ActivityViewerProps {
  selectedAgentId?: string | null;
  onAgentSelect?: (agentId: string) => void;
}

export function ActivityViewer({ selectedAgentId, onAgentSelect }: ActivityViewerProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExploding, setIsExploding] = useState(false);
  const previousMessagesRef = useRef<AgentMessage[]>([]);

  useEffect(() => {
    if (!selectedAgentId) {
      setAgent(null);
      return;
    }

    const loadAgent = async () => {
      setLoading(true);
      try {
        const data = await getAgent(selectedAgentId);
        setAgent(data);
      } catch (error) {
        console.error("Failed to load agent:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAgent();

    // Poll for updates every 2 seconds
    const interval = setInterval(loadAgent, 2000);
    return () => clearInterval(interval);
  }, [selectedAgentId]);

  // Detect session completion and trigger confetti
  useEffect(() => {
    if (!agent || !agent.messages) return;

    const currentMessages = agent.messages;
    const previousMessages = previousMessagesRef.current;

    // Check if a new success result message was added
    const hasNewSuccessResult = currentMessages.some((msg, index) => {
      const isNewMessage = index >= previousMessages.length;
      const isSuccessResult = msg.type === "result" && msg.subtype === "success";
      return isNewMessage && isSuccessResult;
    });

    if (hasNewSuccessResult) {
      setIsExploding(true);
      // Reset confetti after animation completes
      const timer = setTimeout(() => setIsExploding(false), 3000);
      return () => clearTimeout(timer);
    }

    // Update reference
    previousMessagesRef.current = currentMessages;
  }, [agent]);

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "assistant":
        return <Terminal className="h-4 w-4 text-primary" />;
      case "user":
        return <User className="h-4 w-4 text-blue-500" />;
      case "tool_use":
      case "tool_result":
        return <Wrench className="h-4 w-4 text-amber-500" />;
      case "result":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "system":
        return <Activity className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (!selectedAgentId) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center space-y-2">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Activity Viewer</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Select an agent from the left panel to view its activity logs
          </p>
        </div>
      </div>
    );
  }

  if (loading && !agent) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading agent logs...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-sm text-destructive">Agent not found</div>
      </div>
    );
  }

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!followUpPrompt.trim() || !selectedAgentId) {
      setError("Please enter a message");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const result = await continueAgent(selectedAgentId, followUpPrompt.trim());

      if (result.success) {
        setFollowUpPrompt("");
        setError(null);
        // Agent continues in same view, no need to change selection
      } else {
        setError(result.error || "Failed to send follow-up");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSending(false);
    }
  };

  const canContinue = agent?.status === "completed" && agent?.sessionId;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-3">
        {/* Agent Header */}
        <div className="sticky top-0 bg-background pb-2 border-b border-border z-10">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2">
            {agent.prompt}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {agent.messages.length} messages
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(agent.createdAt)}
            </span>
          </div>
        </div>

        {/* Messages Log */}
        {agent.messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {agent.messages.map((message, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    {getMessageIcon(message.type)}
                    <span className="text-xs font-medium text-card-foreground capitalize">
                      {message.type.replace("_", " ")}
                      {message.subtype && ` (${message.subtype})`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(message.timestamp)}
                  </span>
                </div>

                {/* Token usage badges for assistant messages */}
                {message.type === "assistant" && message.metadata?.tokens && (
                  <div className="flex flex-wrap gap-1.5">
                    {message.metadata.tokens.input > 0 && (
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                        In: {message.metadata.tokens.input.toLocaleString()}
                      </span>
                    )}
                    {message.metadata.tokens.output > 0 && (
                      <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                        Out: {message.metadata.tokens.output.toLocaleString()}
                      </span>
                    )}
                    {message.metadata.tokens.cache_read > 0 && (
                      <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                        Cache: {message.metadata.tokens.cache_read.toLocaleString()}
                      </span>
                    )}
                    {message.metadata.tokens.cache_creation > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Cache Created: {message.metadata.tokens.cache_creation.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {/* System init display with tools */}
                {message.type === "system" && message.subtype === "init" && message.metadata?.tools && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {Array.isArray(message.metadata.tools) ? message.metadata.tools.length : 0} Tools
                      </span>
                      {message.metadata.mcp_servers && Array.isArray(message.metadata.mcp_servers) && message.metadata.mcp_servers.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          {message.metadata.mcp_servers.length} MCP
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(message.metadata.tools) && message.metadata.tools.map((tool: string, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground font-mono border border-border"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Result success display with usage stats */}
                {message.type === "result" && message.subtype === "success" && message.metadata?.usage && (
                  <div className="space-y-2">
                    {/* Confetti explosion on completion */}
                    {isExploding && <ConfettiExplosion />}
                    <div className="flex flex-wrap gap-1.5">
                      {message.metadata.usage.input_tokens > 0 && (
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                          In: {message.metadata.usage.input_tokens.toLocaleString()}
                        </span>
                      )}
                      {message.metadata.usage.output_tokens > 0 && (
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          Out: {message.metadata.usage.output_tokens.toLocaleString()}
                        </span>
                      )}
                      {message.metadata.usage.cache_read_input_tokens > 0 && (
                        <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                          Cache: {message.metadata.usage.cache_read_input_tokens.toLocaleString()}
                        </span>
                      )}
                      {message.metadata.duration_ms && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                          {(message.metadata.duration_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      {message.metadata.total_cost > 0 && (
                        <span className="inline-flex items-center rounded-full bg-pink-500/10 px-2 py-0.5 text-xs font-medium text-pink-600 dark:text-pink-400">
                          ${message.metadata.total_cost.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
                  {typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content, null, 2)}
                </div>

                {message.metadata && Object.keys(message.metadata).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View Details
                    </summary>
                    <pre className="mt-1 p-2 rounded bg-muted overflow-x-auto text-xs">
                      {JSON.stringify(message.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Chat input for follow-ups */}
      {canContinue && (
        <div className="border-t border-border bg-background p-4 flex-shrink-0">
          <form onSubmit={handleSendFollowUp} className="space-y-2">
            {error && (
              <div className="text-xs text-destructive">{error}</div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                placeholder="Send a follow-up message..."
                disabled={isSending}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !followUpPrompt.trim()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Continue the conversation in this agent's session
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
