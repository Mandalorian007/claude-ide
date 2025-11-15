import {
  Repository,
  Session,
  SubAgent,
  SessionStatus,
  SubAgentStatus,
  SessionMessage,
  SubAgentMessage,
} from "./types";
import { generateId, extractTitle } from "./git-utils";

/**
 * SessionRepository manages repositories, sessions, and sub-agents
 */
class SessionRepository {
  private repositories: Map<string, Repository> = new Map();
  private sessions: Map<string, Session> = new Map();
  private subAgents: Map<string, SubAgent> = new Map();

  // ============ Repository Management ============

  /**
   * Add or update a repository
   */
  addRepository(repo: Repository): Repository {
    this.repositories.set(repo.id, repo);
    return repo;
  }

  /**
   * Get repository by ID
   */
  getRepository(id: string): Repository | null {
    return this.repositories.get(id) || null;
  }

  /**
   * Find repository by local path
   */
  findRepositoryByPath(localPath: string): Repository | null {
    return (
      Array.from(this.repositories.values()).find(
        (r) => r.localPath === localPath
      ) || null
    );
  }

  /**
   * Get all repositories with their sessions
   */
  getAllRepositories(): Repository[] {
    return Array.from(this.repositories.values()).map((repo) => ({
      ...repo,
      sessions: this.getSessionsByRepository(repo.id),
    }));
  }

  /**
   * Delete repository
   */
  deleteRepository(id: string): boolean {
    // Delete all sessions in this repository
    const sessions = this.getSessionsByRepository(id);
    sessions.forEach((session) => this.deleteSession(session.id));

    return this.repositories.delete(id);
  }

  // ============ Session Management ============

  /**
   * Create a new session
   */
  createSession(data: {
    repositoryId: string;
    prompt: string;
    model?: string;
  }): Session {
    const id = generateId();
    const title = extractTitle(data.prompt);

    const session: Session = {
      id,
      repositoryId: data.repositoryId,
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
   * Get all sessions for a repository
   */
  getSessionsByRepository(repositoryId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.repositoryId === repositoryId)
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
    this.repositories.clear();
    this.sessions.clear();
    this.subAgents.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      repositories: this.repositories.size,
      sessions: this.sessions.size,
      activeSessions: this.getActiveSessions().length,
      subAgents: this.subAgents.size,
    };
  }
}

// Singleton instance
export const sessionRepository = new SessionRepository();
