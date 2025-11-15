"use client";

import { useEffect, useState } from "react";
import { getRepositories } from "@/app/actions";
import { Repository, Session } from "@/lib/types";
import { ChevronDown, ChevronRight, Circle, CheckCircle2, XCircle, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

export function SessionsList({ onSessionSelect }: { onSessionSelect: (sessionId: string) => void }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Load repositories and sessions
    const loadData = async () => {
      const repos = await getRepositories();
      setRepositories(repos);
    };

    loadData();

    // Poll for updates every 2 seconds
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleSessionExpanded = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    onSessionSelect(sessionId);
  };

  // Group sessions by status
  const groupSessionsByStatus = (sessions: Session[]) => {
    const active = sessions.filter((s) => s.status === "active");
    const completed = sessions.filter((s) => s.status === "completed");
    const other = sessions.filter((s) => s.status !== "active" && s.status !== "completed");
    return { active, completed, other };
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Circle className="h-3 w-3 fill-green-500 text-green-500 animate-pulse" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case "error":
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Circle className="h-3 w-3 text-gray-400" />;
    }
  };

  // Format context usage
  const formatContext = (used: number, max: number) => {
    const usedK = Math.round(used / 1000);
    const maxK = Math.round(max / 1000);
    return `${usedK}k/${maxK}k`;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm text-muted-foreground">Sessions</h2>
      </div>

      <div className="p-2">
        {repositories.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <p>No sessions yet</p>
            <p className="mt-1 text-xs">Start a new session to get started</p>
          </div>
        ) : (
          repositories.map((repo) => {
            const { active, completed, other } = groupSessionsByStatus(repo.sessions);
            const allSessions = [...active, ...other, ...completed];

            if (allSessions.length === 0) return null;

            return (
              <div key={repo.id} className="mb-6">
                {/* Repository Header */}
                <div className="mb-2 flex items-center gap-2 px-2 py-1">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{repo.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {repo.branch} • {repo.localPath}
                    </p>
                  </div>
                </div>

                {/* Active Sessions */}
                {active.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Active ({active.length})
                    </p>
                    {active.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isSelected={selectedSessionId === session.id}
                        isExpanded={expandedSessions.has(session.id)}
                        onToggleExpand={() => toggleSessionExpanded(session.id)}
                        onClick={() => handleSessionClick(session.id)}
                        getStatusIcon={getStatusIcon}
                        formatContext={formatContext}
                      />
                    ))}
                  </div>
                )}

                {/* Completed Sessions */}
                {completed.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Completed ({completed.length})
                    </p>
                    {completed.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isSelected={selectedSessionId === session.id}
                        isExpanded={expandedSessions.has(session.id)}
                        onToggleExpand={() => toggleSessionExpanded(session.id)}
                        onClick={() => handleSessionClick(session.id)}
                        getStatusIcon={getStatusIcon}
                        formatContext={formatContext}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isSelected,
  isExpanded,
  onToggleExpand,
  onClick,
  getStatusIcon,
  formatContext,
}: {
  session: Session;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
  getStatusIcon: (status: string) => React.ReactElement;
  formatContext: (used: number, max: number) => string;
}) {
  const hasSubAgents = session.subAgents && session.subAgents.length > 0;

  return (
    <div className="mb-1">
      {/* Session Row */}
      <div
        className={cn(
          "group flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent cursor-pointer transition-colors",
          isSelected && "bg-accent"
        )}
        onClick={onClick}
      >
        {/* Expand/Collapse Button */}
        {hasSubAgents && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="mt-0.5 shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        {!hasSubAgents && <div className="w-4 shrink-0" />}

        {/* Status Icon */}
        <div className="mt-1 shrink-0">{getStatusIcon(session.status)}</div>

        {/* Session Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{session.title}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatContext(session.contextUsed, session.maxContext)}</span>
            <span>${session.totalCost.toFixed(4)}</span>
            {session.error && <span className="text-red-500">Error</span>}
          </div>
        </div>
      </div>

      {/* Sub-Agents */}
      {hasSubAgents && isExpanded && (
        <div className="ml-8 mt-1 space-y-1">
          {session.subAgents.map((subAgent) => (
            <div
              key={subAgent.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50"
            >
              <div className="shrink-0">{getStatusIcon(subAgent.status)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">🤖 {subAgent.type}</p>
                <p className="text-muted-foreground truncate">{subAgent.description}</p>
              </div>
              <span className="text-muted-foreground shrink-0">
                {Math.round(subAgent.contextUsed / 1000)}k
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
