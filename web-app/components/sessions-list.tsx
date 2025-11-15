"use client";

import { useEffect, useState } from "react";
import { getSessions, cleanupSession } from "@/app/actions";
import { Session } from "@/lib/types";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle2,
  XCircle,
  GitBranch,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SessionsList({
  onSessionSelect,
}: {
  onSessionSelect: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    // Load sessions
    const loadData = async () => {
      const sessionList = await getSessions();
      setSessions(sessionList);
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

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(sessionId);
  };

  const handleConfirmDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingSession(sessionId);
    setConfirmDelete(null);

    try {
      const result = await cleanupSession(sessionId);

      if (result.success) {
        // Remove from local state
        setSessions(sessions.filter((s) => s.id !== sessionId));

        // Clear selection if this was selected
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
          onSessionSelect("");
        }
      } else {
        console.error("Failed to cleanup session:", result.error);
        alert(`Failed to cleanup session: ${result.error}`);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      alert("Failed to delete session");
    } finally {
      setDeletingSession(null);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(null);
  };

  // Group sessions by GitHub repo
  const sessionsByRepo = sessions.reduce(
    (acc, session) => {
      if (!acc[session.githubRepo]) {
        acc[session.githubRepo] = [];
      }
      acc[session.githubRepo].push(session);
      return acc;
    },
    {} as Record<string, Session[]>
  );

  // Group sessions by status
  const groupSessionsByStatus = (sessions: Session[]) => {
    const active = sessions.filter((s) => s.status === "active");
    const completed = sessions.filter((s) => s.status === "completed");
    const other = sessions.filter(
      (s) => s.status !== "active" && s.status !== "completed"
    );
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
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <p>No sessions yet</p>
            <p className="mt-1 text-xs">Start a new session to get started</p>
          </div>
        ) : (
          Object.entries(sessionsByRepo).map(([repo, repoSessions]) => {
            const { active, completed, other } = groupSessionsByStatus(repoSessions);
            const allSessions = [...active, ...other, ...completed];

            return (
              <div key={repo} className="mb-6">
                {/* Repository Header */}
                <div className="mb-2 flex items-center gap-2 px-2 py-1">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{repo}</p>
                    <p className="text-xs text-muted-foreground">
                      {allSessions.length} session{allSessions.length !== 1 ? "s" : ""}
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
                        isDeleting={deletingSession === session.id}
                        confirmDelete={confirmDelete === session.id}
                        onToggleExpand={() => toggleSessionExpanded(session.id)}
                        onClick={() => handleSessionClick(session.id)}
                        onDelete={(e) => handleDeleteClick(session.id, e)}
                        onConfirmDelete={(e) => handleConfirmDelete(session.id, e)}
                        onCancelDelete={handleCancelDelete}
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
                        isDeleting={deletingSession === session.id}
                        confirmDelete={confirmDelete === session.id}
                        onToggleExpand={() => toggleSessionExpanded(session.id)}
                        onClick={() => handleSessionClick(session.id)}
                        onDelete={(e) => handleDeleteClick(session.id, e)}
                        onConfirmDelete={(e) => handleConfirmDelete(session.id, e)}
                        onCancelDelete={handleCancelDelete}
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
  isDeleting,
  confirmDelete,
  onToggleExpand,
  onClick,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  getStatusIcon,
  formatContext,
}: {
  session: Session;
  isSelected: boolean;
  isExpanded: boolean;
  isDeleting: boolean;
  confirmDelete: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onConfirmDelete: (e: React.MouseEvent) => void;
  onCancelDelete: (e: React.MouseEvent) => void;
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
            {session.error && <span className="text-red-500">Error</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
            {session.gitBranch}
          </p>
        </div>

        {/* Delete Button */}
        <div className="shrink-0 mt-0.5">
          {confirmDelete ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 px-2 text-xs"
                onClick={onConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Confirm
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={onCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          )}
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
