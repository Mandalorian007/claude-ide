"use client";

import { useEffect, useState } from "react";
import { Project, Agent } from "@/lib/types";
import { getProjects } from "@/app/actions";
import { Folder, Circle, CheckCircle2, XCircle, StopCircle } from "lucide-react";

interface ProjectsListProps {
  selectedAgentId?: string | null;
  onAgentSelect: (agentId: string) => void;
}

export function ProjectsList({ selectedAgentId, onAgentSelect }: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    loadProjects();

    // Poll for updates every 2 seconds
    const interval = setInterval(loadProjects, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Agent["status"]) => {
    switch (status) {
      case "running":
        return <Circle className="h-4 w-4 text-primary animate-pulse" fill="currentColor" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "stopped":
        return <StopCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: Agent["status"]) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatContext = (used: number, max: number) => {
    const usedK = Math.round(used / 1000);
    const maxK = Math.round(max / 1000);
    return `${usedK}k/${maxK}k`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center space-y-2">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No agents running</p>
          <p className="text-xs text-muted-foreground">Start an agent to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-4">
        {projects.map((project) => (
          <div key={project.path} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-foreground">
                {project.name}
              </h3>
            </div>

            <div className="space-y-2 ml-6">
              {project.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onAgentSelect(agent.id)}
                  className={`w-full text-left rounded-lg border p-3 space-y-2 transition-colors ${
                    selectedAgentId === agent.id
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(agent.status)}
                      <span className="text-xs font-medium text-card-foreground">
                        {getStatusLabel(agent.status)}
                      </span>
                    </div>
                    {agent.totalCost > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {formatCost(agent.totalCost)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {agent.prompt}
                  </p>

                  {agent.status === "running" && agent.contextUsed > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {formatContext(agent.contextUsed, agent.maxContext)}
                    </div>
                  )}

                  {agent.error && (
                    <div className="text-xs text-destructive line-clamp-1">
                      Error: {agent.error}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
