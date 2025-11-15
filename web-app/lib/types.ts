// Session and sub-agent status types
export type SessionStatus = "active" | "completed" | "paused" | "error";
export type SubAgentStatus = "running" | "completed" | "error";

// Message types
export interface SessionMessage {
  timestamp: Date;
  type: string;
  subtype?: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface SubAgentMessage {
  timestamp: Date;
  type: string;
  content: string;
  metadata?: Record<string, any>;
}

// Git Repository (natural project boundary)
export interface Repository {
  id: string;
  owner: string;              // e.g., "Mandalorian007"
  name: string;               // e.g., "claude-ide"
  fullName: string;           // e.g., "Mandalorian007/claude-ide"
  localPath: string;          // Absolute path on filesystem
  branch: string;             // Current git branch
  remoteUrl?: string;         // Git remote URL
  sessions: Session[];
}

// Session = one conversation/workflow in a repository
export interface Session {
  id: string;
  repositoryId: string;
  title: string;              // Extracted from prompt
  description: string;        // Initial prompt
  status: SessionStatus;
  contextUsed: number;        // Main session context
  maxContext: number;
  totalTokens: number;
  totalCost: number;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  sdkSessionId?: string;      // SDK session ID for continuation
  error?: string;

  messages: SessionMessage[];
  subAgents: SubAgent[];
}

// Sub-agent = specialized task spawned by main session
export interface SubAgent {
  id: string;
  sessionId: string;          // Parent session
  type: string;               // e.g., "test-runner", "code-reviewer"
  description: string;        // What it's doing
  status: SubAgentStatus;
  contextUsed: number;
  totalTokens: number;
  totalCost: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;

  messages: SubAgentMessage[];
  result?: string;            // Final output/summary
}

// Legacy types (for gradual migration)
export type AgentStatus = "running" | "completed" | "error" | "stopped";

export interface AgentMessage {
  timestamp: Date;
  type: string;
  subtype?: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface Agent {
  id: string;
  projectPath: string;
  projectName: string;
  prompt: string;
  status: AgentStatus;
  contextUsed: number;
  maxContext: number;
  totalTokens: number;
  totalCost: number;
  model: string;
  createdAt: Date;
  completedAt?: Date;
  lastMessage?: string;
  error?: string;
  messages: AgentMessage[];
  sessionId?: string;
}

export interface Project {
  path: string;
  name: string;
  agents: Agent[];
}
