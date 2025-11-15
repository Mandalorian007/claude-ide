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

// GitHub Repository reference
export interface GitHubRepo {
  owner: string;              // e.g., "Mandalorian007"
  name: string;               // e.g., "claude-ide"
  fullName: string;           // e.g., "Mandalorian007/claude-ide"
  url: string;                // GitHub URL
  defaultBranch: string;      // e.g., "main" or "master"
}

// Session = isolated workspace with dedicated branch
export interface Session {
  id: string;
  sdkSessionId?: string;      // SDK session ID for continuation

  // GitHub & Workspace
  githubRepo: string;         // "owner/repo" format
  workspacePath: string;      // Absolute path to workspace directory
  gitBranch: string;          // Branch created for this session

  // Session Info
  title: string;              // Extracted from prompt
  description: string;        // Initial prompt
  status: SessionStatus;

  // Metrics
  contextUsed: number;
  maxContext: number;
  totalTokens: number;
  totalCost: number;
  model: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // State
  error?: string;
  prUrl?: string;             // Pull request URL if created

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
