"use client";

import { useEffect, useState } from "react";
import { Agent, AgentMessage } from "@/lib/types";
import { getAgent } from "@/app/actions";
import { Activity, Terminal, User, Wrench, CheckCircle, XCircle } from "lucide-react";

interface ActivityViewerProps {
  selectedAgentId?: string | null;
}

export function ActivityViewer({ selectedAgentId }: ActivityViewerProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-3">
        {/* Agent Header */}
        <div className="sticky top-0 bg-background pb-2 border-b border-border">
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
          <div className="space-y-2">
            {agent.messages.map((message, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-3 space-y-1.5"
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

                <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                  {typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content, null, 2)}
                </p>

                {message.metadata && Object.keys(message.metadata).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Metadata
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
  );
}
