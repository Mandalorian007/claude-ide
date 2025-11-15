"use server";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { sessionRepository } from "@/lib/session-repository";
import {
  listGitHubRepos,
  createWorkspace,
  cleanupWorkspace,
  createPullRequest,
  checkGitHubCLI,
} from "@/lib/git-workspace-utils";
import { Session, GitHubRepo } from "@/lib/types";

// ============ GitHub Integration Actions ============

/**
 * Check if GitHub CLI is ready
 */
export async function checkGitHub(): Promise<{
  installed: boolean;
  authenticated: boolean;
  error?: string;
}> {
  return await checkGitHubCLI();
}

/**
 * List user's GitHub repositories
 */
export async function getGitHubRepos(): Promise<GitHubRepo[]> {
  try {
    return await listGitHubRepos();
  } catch (error) {
    console.error("Failed to list GitHub repos:", error);
    return [];
  }
}

// ============ Session Actions ============

/**
 * Get all sessions
 */
export async function getSessions(): Promise<Session[]> {
  return sessionRepository.getAllSessions();
}

/**
 * Get a specific session
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  return sessionRepository.getSession(sessionId);
}

/**
 * Start a new session with workspace setup
 */
export async function startSession(
  githubRepo: string,
  prompt: string,
  defaultBranch: string = "main"
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    // Create workspace (clone + branch)
    const { workspacePath, gitBranch } = await createWorkspace(
      githubRepo,
      prompt,
      defaultBranch
    );

    // Create session record
    const session = sessionRepository.createSession({
      githubRepo,
      workspacePath,
      gitBranch,
      prompt,
      model: "claude-sonnet-4-5",
    });

    console.log(`[Server Action] Session created: ${session.id}`);
    console.log(`[Server Action] Total sessions: ${sessionRepository.getAllSessions().length}`);

    // Run session in background
    runSessionInBackground(session.id, workspacePath, prompt);

    return { success: true, sessionId: session.id };
  } catch (error) {
    console.error("Failed to start session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Continue an existing session
 */
export async function continueSession(
  sessionId: string,
  prompt: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = sessionRepository.getSession(sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (!session.sdkSessionId) {
      return { success: false, error: "Session cannot be resumed" };
    }

    // Update session status
    sessionRepository.updateSessionStatus(sessionId, "active");

    // Add user message
    sessionRepository.addSessionMessage(sessionId, "user", prompt);

    // Run with resume
    runSessionWithResume(
      sessionId,
      session.workspacePath,
      prompt,
      session.sdkSessionId
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to continue session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Cleanup session: delete workspace and session record
 */
export async function cleanupSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = sessionRepository.getSession(sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Delete workspace directory
    await cleanupWorkspace(session.workspacePath);

    // Delete session record
    sessionRepository.deleteSession(sessionId);

    return { success: true };
  } catch (error) {
    console.error("Failed to cleanup session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a pull request from session
 */
export async function createPR(
  sessionId: string,
  title: string,
  body: string
): Promise<{ success: boolean; prUrl?: string; error?: string }> {
  try {
    const session = sessionRepository.getSession(sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const prUrl = await createPullRequest(
      session.workspacePath,
      session.gitBranch,
      title,
      body
    );

    // Update session with PR URL
    sessionRepository.updateSession(sessionId, { prUrl });

    return { success: true, prUrl };
  } catch (error) {
    console.error("Failed to create PR:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============ Session Execution (Background) ============

/**
 * Run session in background with sub-agent support
 */
async function runSessionInBackground(
  sessionId: string,
  workspacePath: string,
  prompt: string
) {
  try {
    const messages = query({
      prompt,
      options: {
        cwd: workspacePath,
        model: "claude-sonnet-4-5",
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
        },
        maxTurns: 20,

        // Define sub-agents available to this session
        agents: {
          "test-runner": {
            description: "Runs tests and validates changes",
            tools: ["Bash", "Read", "Grep", "Glob"],
            prompt:
              "You are a testing specialist. Run tests, analyze results, and report findings clearly.",
            model: "haiku",
          },
          "type-checker": {
            description: "Checks TypeScript types and validates code",
            tools: ["Bash", "Read"],
            prompt:
              "You are a TypeScript expert. Check for type errors and suggest fixes.",
            model: "haiku",
          },
          "code-reviewer": {
            description: "Reviews code for quality and best practices",
            tools: ["Read", "Grep", "Glob"],
            prompt:
              "You are a code reviewer. Focus on code quality, best practices, and potential issues.",
            model: "sonnet",
          },
          "linter": {
            description: "Runs linters and formatters",
            tools: ["Bash", "Read"],
            prompt:
              "You are a code quality tool. Run linters and formatters, report issues.",
            model: "haiku",
          },
          "documentation": {
            description: "Writes and updates documentation",
            tools: ["Read", "Write", "Edit", "Grep"],
            prompt:
              "You are a documentation specialist. Write clear, comprehensive documentation.",
            model: "sonnet",
          },
        },
      },
    });

    await processSessionMessages(sessionId, messages);
  } catch (error) {
    console.error(`Session ${sessionId} failed:`, error);
    sessionRepository.updateSessionStatus(
      sessionId,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Run session with resume
 */
async function runSessionWithResume(
  sessionId: string,
  workspacePath: string,
  prompt: string,
  sdkSessionId: string
) {
  try {
    const messages = query({
      prompt,
      options: {
        cwd: workspacePath,
        model: "claude-sonnet-4-5",
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
        },
        maxTurns: 20,
        resume: sdkSessionId,

        // Same sub-agents as initial run
        agents: {
          "test-runner": {
            description: "Runs tests and validates changes",
            tools: ["Bash", "Read", "Grep", "Glob"],
            prompt:
              "You are a testing specialist. Run tests, analyze results, and report findings clearly.",
            model: "haiku",
          },
          "type-checker": {
            description: "Checks TypeScript types and validates code",
            tools: ["Bash", "Read"],
            prompt:
              "You are a TypeScript expert. Check for type errors and suggest fixes.",
            model: "haiku",
          },
          "code-reviewer": {
            description: "Reviews code for quality and best practices",
            tools: ["Read", "Grep", "Glob"],
            prompt:
              "You are a code reviewer. Focus on code quality, best practices, and potential issues.",
            model: "sonnet",
          },
          "linter": {
            description: "Runs linters and formatters",
            tools: ["Bash", "Read"],
            prompt:
              "You are a code quality tool. Run linters and formatters, report issues.",
            model: "haiku",
          },
          "documentation": {
            description: "Writes and updates documentation",
            tools: ["Read", "Write", "Edit", "Grep"],
            prompt:
              "You are a documentation specialist. Write clear, comprehensive documentation.",
            model: "sonnet",
          },
        },
      },
    });

    await processSessionMessages(sessionId, messages);
  } catch (error) {
    console.error(`Session ${sessionId} resume failed:`, error);
    sessionRepository.updateSessionStatus(
      sessionId,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Process messages from a session, tracking sub-agents
 */
async function processSessionMessages(
  sessionId: string,
  messages: AsyncIterable<any>
) {
  let currentSubAgentId: string | null = null;

  try {
    for await (const message of messages) {
      let logContent = "";
      let metadata: Record<string, any> = {};

      // Detect tool usage and sub-agent launches
      if (message.type === "stream_event") {
        const event = message as any;

        if (event.event_type === "tool_use") {
          if (event.tool_name === "Task") {
            // Sub-agent is being launched
            const subAgentType = event.tool_input?.subagent_type || "unknown";
            const description = event.tool_input?.description || "Running task";

            const subAgent = sessionRepository.createSubAgent({
              sessionId,
              type: subAgentType,
              description,
            });

            currentSubAgentId = subAgent.id;

            logContent = `🤖 Launching sub-agent: ${subAgentType}\n📋 ${description}`;
            metadata = {
              sub_agent_id: subAgent.id,
              sub_agent_type: subAgentType,
            };
          } else {
            // Regular tool use
            const toolInput = event.tool_input
              ? JSON.stringify(event.tool_input, null, 2).substring(0, 500)
              : "";
            logContent = `🔧 Using tool: ${event.tool_name}`;
            if (toolInput) {
              logContent += `\n${toolInput}`;
            }
            metadata = {
              tool_name: event.tool_name,
              tool_input: event.tool_input,
            };
          }
        } else if (event.event_type === "tool_result") {
          if (event.tool_name === "Task" && currentSubAgentId) {
            // Sub-agent completed
            const result =
              typeof event.tool_output === "string"
                ? event.tool_output
                : JSON.stringify(event.tool_output);

            sessionRepository.updateSubAgentStatus(
              currentSubAgentId,
              "completed",
              undefined,
              result.substring(0, 1000)
            );

            logContent = `✅ Sub-agent completed: ${result.substring(0, 500)}`;
            metadata = { sub_agent_id: currentSubAgentId };

            currentSubAgentId = null;
          }
          // Note: Regular tool results are not logged to keep logs cleaner
        }
      }

      // Track standard messages
      if (message.type === "system" && message.subtype === "init") {
        const modelName = message.model || "claude-sonnet-4-5";
        const toolCount = message.tools?.length || 0;
        const agentCount = Object.keys(message.agents || {}).length;

        logContent = `🚀 Session initialized with ${modelName}\n✓ ${toolCount} tools loaded${
          agentCount > 0 ? `\n✓ ${agentCount} sub-agents available` : ""
        }`;
        metadata = { tools: message.tools, agents: message.agents };
      }

      if (message.type === "assistant") {
        let assistantMessage = "";
        let parsedMetadata: Record<string, any> = {};

        if (typeof message.message === "string") {
          assistantMessage = message.message;
        } else if (message.message && typeof message.message === "object") {
          const msg = message.message as any;

          if (msg.content && Array.isArray(msg.content)) {
            assistantMessage = msg.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
          }

          if (msg.usage) {
            parsedMetadata.tokens = {
              input: msg.usage.input_tokens || 0,
              output: msg.usage.output_tokens || 0,
              cache_read: msg.usage.cache_read_input_tokens || 0,
              cache_creation: msg.usage.cache_creation_input_tokens || 0,
            };

            // Update session metrics
            const totalTokens =
              (msg.usage.input_tokens || 0) + (msg.usage.output_tokens || 0);
            sessionRepository.updateSessionMetrics(sessionId, {
              contextUsed: totalTokens,
              totalTokens: totalTokens,
            });
          }
        }

        // Only log if there's actual content
        if (assistantMessage.trim()) {
          logContent = assistantMessage;
          metadata = { ...metadata, ...parsedMetadata };
        }
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          const totalTokens =
            (message.usage?.input_tokens || 0) +
            (message.usage?.output_tokens || 0);
          const cost = message.total_cost_usd || 0;

          sessionRepository.updateSessionStatus(sessionId, "completed");
          sessionRepository.updateSessionMetrics(sessionId, {
            totalTokens,
            totalCost: cost,
            contextUsed: totalTokens,
            sdkSessionId: message.session_id,
          });

          const duration = message.duration_ms
            ? `${(message.duration_ms / 1000).toFixed(1)}s`
            : "N/A";
          logContent = `✅ Session completed\n⏱️ Duration: ${duration}\n💰 Cost: $${cost.toFixed(
            6
          )}`;
          metadata = {
            usage: message.usage,
            duration_ms: message.duration_ms,
            total_cost: cost,
            session_id: message.session_id,
          };
        } else {
          const errorMsg =
            message.errors && message.errors.length > 0
              ? message.errors[0]
              : `Error: ${message.subtype}`;

          sessionRepository.updateSessionStatus(sessionId, "error", errorMsg);
          logContent = `❌ ${errorMsg}`;
          metadata = { errors: message.errors };
        }
      }

      // Add message to session log
      if (logContent) {
        sessionRepository.addSessionMessage(
          sessionId,
          message.type,
          logContent,
          "subtype" in message ? message.subtype : undefined,
          metadata
        );
      }
    }
  } catch (error) {
    console.error(`Session ${sessionId} message processing failed:`, error);
    throw error;
  }
}
