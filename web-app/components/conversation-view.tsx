"use client";

import { useEffect, useState } from "react";
import { getSessionDetails, continueSession } from "@/app/actions";
import { Session } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Loader2, Send } from "lucide-react";

export function ConversationView({ sessionId }: { sessionId: string | null }) {
  const [session, setSession] = useState<Session | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }

    const loadSession = async () => {
      const data = await getSessionDetails(sessionId);
      setSession(data);
    };

    loadSession();

    // Poll for updates every 1 second
    const interval = setInterval(loadSession, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleContinue = async () => {
    if (!sessionId || !followUpPrompt.trim()) return;

    setIsLoading(true);

    try {
      const result = await continueSession(sessionId, followUpPrompt);
      if (result.success) {
        setFollowUpPrompt("");
      }
    } catch (error) {
      console.error("Failed to continue session:", error);
    } finally {
      setIsLoading(false);
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Session Header */}
      <div className="border-b p-4">
        <h2 className="font-semibold">{session.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {session.status} • {Math.round(session.contextUsed / 1000)}k/{Math.round(session.maxContext / 1000)}k context •
          ${session.totalCost.toFixed(6)}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {session.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No messages yet
          </div>
        ) : (
          session.messages.map((message, index) => (
            <MessageItem key={index} message={message} />
          ))
        )}
      </div>

      {/* Continue Input */}
      {session.status === "completed" && session.sdkSessionId && (
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={followUpPrompt}
              onChange={(e) => setFollowUpPrompt(e.target.value)}
              placeholder="Continue this session..."
              className="min-h-[60px] resize-none"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleContinue();
                }
              }}
            />
            <Button
              onClick={handleContinue}
              disabled={isLoading || !followUpPrompt.trim()}
              size="icon"
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Press ⌘+Enter to send
          </p>
        </div>
      )}
    </div>
  );
}

function MessageItem({ message }: { message: any }) {
  const isUser = message.type === "user";
  const isAssistant = message.type === "assistant";
  const isSystem = message.type === "system";
  const isSubAgent = message.metadata?.sub_agent_id;

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0">
        {isUser && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
        )}
        {(isAssistant || isSubAgent) && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
            <Bot className="h-4 w-4" />
          </div>
        )}
        {isSystem && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <span className="text-xs">⚙️</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser && "You"}
            {isAssistant && !isSubAgent && "Claude"}
            {isSubAgent && `Sub-agent: ${message.metadata.sub_agent_type}`}
            {isSystem && "System"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Message Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm">{message.content}</pre>
        </div>

        {/* Metadata */}
        {message.metadata && (
          <div className="flex flex-wrap gap-2">
            {message.metadata.tokens && (
              <>
                <Badge variant="outline" className="text-xs">
                  In: {message.metadata.tokens.input.toLocaleString()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Out: {message.metadata.tokens.output.toLocaleString()}
                </Badge>
                {message.metadata.tokens.cache_read > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Cache: {message.metadata.tokens.cache_read.toLocaleString()}
                  </Badge>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
