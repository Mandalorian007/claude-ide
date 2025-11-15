import {
  Session,
  SubAgent,
  SessionStatus,
  SubAgentStatus,
  SessionMessage,
  SubAgentMessage,
} from "./types";
import { randomUUID } from "crypto";

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Extract title from prompt (first line or first 50 chars)
 */
export function extractTitle(prompt: string): string {
  const firstLine = prompt.split("\n")[0];
  return firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine;
}

/**
 * SessionRepository manages sessions and sub-agents (workspace-based)
 */
class SessionRepository {
  private sessions: Map<string, Session> = new Map();
  private subAgents: Map<string, SubAgent> = new Map();

  // ============ Session Management ============

  /**
   * Create a new session
   */
  createSession(data: {
    githubRepo: string;
    workspacePath: string;
    gitBranch: string;
    prompt: string;
    model?: string;
  }): Session {
    const id = generateId();
    const title = extractTitle(data.prompt);

    const session: Session = {
      id,
      githubRepo: data.githubRepo,
      workspacePath: data.workspacePath,
      gitBranch: data.gitBranch,
      title,
      description: data.prompt,
      status: "active",
      contextUsed: 0,
      maxContext: 200000,
      totalTokens: 0,
      totalCost: 0,
      model: data.model || "claude-sonnet-4-5",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      subAgents: [],
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(id: string): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;

    // Include sub-agents
    return {
      ...session,
      subAgents: session.subAgents
        .map((sa) => this.subAgents.get(sa.id))
        .filter((sa): sa is SubAgent => sa !== undefined),
    };
  }

  /**
   * Get all sessions, sorted by creation date (newest first)
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values())
      .map((session) => ({
        ...session,
        subAgents: session.subAgents
          .map((sa) => this.subAgents.get(sa.id))
          .filter((sa): sa is SubAgent => sa !== undefined),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get sessions by GitHub repo
   */
  getSessionsByRepo(githubRepo: string): Session[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.githubRepo === githubRepo)
      .map((session) => ({
        ...session,
        subAgents: session.subAgents
          .map((sa) => this.subAgents.get(sa.id))
          .filter((sa): sa is SubAgent => sa !== undefined),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.status === "active")
      .map((session) => ({
        ...session,
        subAgents: session.subAgents
          .map((sa) => this.subAgents.get(sa.id))
          .filter((sa): sa is SubAgent => sa !== undefined),
      }));
  }

  /**
   * Update session
   */
  updateSession(id: string, updates: Partial<Session>): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;

    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    this.sessions.set(id, updated);
    return this.getSession(id);
  }

  /**
   * Update session status
   */
  updateSessionStatus(
    id: string,
    status: SessionStatus,
    error?: string
  ): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;

    const updates: Partial<Session> = { status };

    if (status === "completed" || status === "error") {
      updates.completedAt = new Date();
    }

    if (error) {
      updates.error = error;
    }

    return this.updateSession(id, updates);
  }

  /**
   * Add message to session
   */
  addSessionMessage(
    id: string,
    type: string,
    content: string,
    subtype?: string,
    metadata?: Record<string, any>
  ): void {
    const session = this.sessions.get(id);
    if (!session) return;

    const message: SessionMessage = {
      timestamp: new Date(),
      type,
      subtype,
      content,
      metadata,
    };

    session.messages.push(message);
    session.updatedAt = new Date();
  }

  /**
   * Update session metrics from SDK message
   */
  updateSessionMetrics(
    id: string,
    data: {
      contextUsed?: number;
      totalTokens?: number;
      totalCost?: number;
      sdkSessionId?: string;
    }
  ): void {
    const session = this.sessions.get(id);
    if (!session) return;

    if (data.contextUsed !== undefined) {
      session.contextUsed = data.contextUsed;
    }
    if (data.totalTokens !== undefined) {
      session.totalTokens = data.totalTokens;
    }
    if (data.totalCost !== undefined) {
      session.totalCost = data.totalCost;
    }
    if (data.sdkSessionId) {
      session.sdkSessionId = data.sdkSessionId;
    }

    session.updatedAt = new Date();
  }

  /**
   * Delete session and its sub-agents
   */
  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    // Delete all sub-agents
    session.subAgents.forEach((sa) => this.subAgents.delete(sa.id));

    return this.sessions.delete(id);
  }

  // ============ Sub-Agent Management ============

  /**
   * Create a sub-agent within a session
   */
  createSubAgent(data: {
    sessionId: string;
    type: string;
    description: string;
  }): SubAgent {
    const id = generateId();

    const subAgent: SubAgent = {
      id,
      sessionId: data.sessionId,
      type: data.type,
      description: data.description,
      status: "running",
      contextUsed: 0,
      totalTokens: 0,
      totalCost: 0,
      createdAt: new Date(),
      messages: [],
    };

    this.subAgents.set(id, subAgent);

    // Add reference to parent session
    const session = this.sessions.get(data.sessionId);
    if (session) {
      session.subAgents.push(subAgent);
    }

    return subAgent;
  }

  /**
   * Get sub-agent by ID
   */
  getSubAgent(id: string): SubAgent | null {
    return this.subAgents.get(id) || null;
  }

  /**
   * Get all sub-agents for a session
   */
  getSubAgentsBySession(sessionId: string): SubAgent[] {
    return Array.from(this.subAgents.values())
      .filter((sa) => sa.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Update sub-agent
   */
  updateSubAgent(id: string, updates: Partial<SubAgent>): SubAgent | null {
    const subAgent = this.subAgents.get(id);
    if (!subAgent) return null;

    const updated = { ...subAgent, ...updates };
    this.subAgents.set(id, updated);
    return updated;
  }

  /**
   * Update sub-agent status
   */
  updateSubAgentStatus(
    id: string,
    status: SubAgentStatus,
    error?: string,
    result?: string
  ): SubAgent | null {
    const subAgent = this.subAgents.get(id);
    if (!subAgent) return null;

    const updates: Partial<SubAgent> = { status };

    if (status === "completed" || status === "error") {
      updates.completedAt = new Date();
    }

    if (error) {
      updates.error = error;
    }

    if (result) {
      updates.result = result;
    }

    return this.updateSubAgent(id, updates);
  }

  /**
   * Add message to sub-agent
   */
  addSubAgentMessage(
    id: string,
    type: string,
    content: string,
    metadata?: Record<string, any>
  ): void {
    const subAgent = this.subAgents.get(id);
    if (!subAgent) return;

    const message: SubAgentMessage = {
      timestamp: new Date(),
      type,
      content,
      metadata,
    };

    subAgent.messages.push(message);
  }

  /**
   * Update sub-agent metrics
   */
  updateSubAgentMetrics(
    id: string,
    data: {
      contextUsed?: number;
      totalTokens?: number;
      totalCost?: number;
    }
  ): void {
    const subAgent = this.subAgents.get(id);
    if (!subAgent) return;

    if (data.contextUsed !== undefined) {
      subAgent.contextUsed = data.contextUsed;
    }
    if (data.totalTokens !== undefined) {
      subAgent.totalTokens = data.totalTokens;
    }
    if (data.totalCost !== undefined) {
      subAgent.totalCost = data.totalCost;
    }
  }

  /**
   * Delete sub-agent
   */
  deleteSubAgent(id: string): boolean {
    return this.subAgents.delete(id);
  }

  // ============ Utility Methods ============

  /**
   * Clear all data
   */
  clear(): void {
    this.sessions.clear();
    this.subAgents.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      sessions: this.sessions.size,
      activeSessions: this.getActiveSessions().length,
      subAgents: this.subAgents.size,
    };
  }

  /**
   * Get unique GitHub repos with session counts
   */
  getGitHubRepoStats(): { repo: string; count: number }[] {
    const repoMap = new Map<string, number>();

    for (const session of this.sessions.values()) {
      const count = repoMap.get(session.githubRepo) || 0;
      repoMap.set(session.githubRepo, count + 1);
    }

    return Array.from(repoMap.entries())
      .map(([repo, count]) => ({ repo, count }))
      .sort((a, b) => b.count - a.count);
  }
}

// Singleton instance with global caching to ensure same instance across Next.js contexts
const globalForSessionRepo = globalThis as unknown as {
  sessionRepository: SessionRepository | undefined;
};

export const sessionRepository =
  globalForSessionRepo.sessionRepository ?? new SessionRepository();

if (process.env.NODE_ENV !== "production") {
  globalForSessionRepo.sessionRepository = sessionRepository;
}
