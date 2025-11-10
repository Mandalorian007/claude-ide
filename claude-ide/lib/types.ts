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
