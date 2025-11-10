import { Agent, AgentStatus, Project } from "./types";

class AgentRepository {
  private agents: Map<string, Agent> = new Map();

  createAgent(data: {
    projectPath: string;
    prompt: string;
    model?: string;
  }): Agent {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const projectName = data.projectPath.split("/").pop() || "unknown";

    const agent: Agent = {
      id,
      projectPath: data.projectPath,
      projectName,
      prompt: data.prompt,
      status: "running",
      contextUsed: 0,
      maxContext: 200000,
      totalTokens: 0,
      totalCost: 0,
      model: data.model || "claude-sonnet-4-5",
      createdAt: new Date(),
      messages: [],
    };

    this.agents.set(id, agent);
    return agent;
  }

  updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    const agent = this.agents.get(id);
    if (!agent) return null;

    const updated = { ...agent, ...updates };
    this.agents.set(id, updated);
    return updated;
  }

  updateAgentStatus(
    id: string,
    status: AgentStatus,
    error?: string
  ): Agent | null {
    const agent = this.agents.get(id);
    if (!agent) return null;

    const updates: Partial<Agent> = { status };
    if (status === "completed" || status === "error") {
      updates.completedAt = new Date();
    }
    if (error) {
      updates.error = error;
    }

    return this.updateAgent(id, updates);
  }

  getAgent(id: string): Agent | null {
    return this.agents.get(id) || null;
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByProject(projectPath: string): Agent[] {
    return this.getAllAgents().filter((a) => a.projectPath === projectPath);
  }

  getAllProjects(): Project[] {
    const projectMap = new Map<string, Project>();

    for (const agent of this.getAllAgents()) {
      if (!projectMap.has(agent.projectPath)) {
        projectMap.set(agent.projectPath, {
          path: agent.projectPath,
          name: agent.projectName,
          agents: [],
        });
      }
      projectMap.get(agent.projectPath)!.agents.push(agent);
    }

    // Sort agents by creation time (newest first)
    for (const project of projectMap.values()) {
      project.agents.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    }

    return Array.from(projectMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  deleteAgent(id: string): boolean {
    return this.agents.delete(id);
  }

  addMessage(
    id: string,
    type: string,
    content: string,
    subtype?: string,
    metadata?: Record<string, any>
  ): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    agent.messages.push({
      timestamp: new Date(),
      type,
      subtype,
      content,
      metadata,
    });
  }

  clear(): void {
    this.agents.clear();
  }
}

// Singleton instance
export const agentRepository = new AgentRepository();
