"use server";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { agentRepository } from "@/lib/agent-repository";
import { sessionRepository } from "@/lib/session-repository";
import { parseGitRepository } from "@/lib/git-utils";
import { Agent, Project, Repository, Session } from "@/lib/types";

export async function startAgent(
  projectPath: string,
  prompt: string
): Promise<{ success: boolean; agentId?: string; error?: string }> {
  try {
    // Create agent record
    const agent = agentRepository.createAgent({
      projectPath,
      prompt,
      model: "claude-sonnet-4-5",
    });

    // Start SDK query in background (non-blocking)
    runAgentInBackground(agent.id, projectPath, prompt);

    return { success: true, agentId: agent.id };
  } catch (error) {
    console.error("Failed to start agent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getProjects(): Promise<Project[]> {
  return agentRepository.getAllProjects();
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  return agentRepository.getAgent(agentId);
}

export async function continueAgent(
  agentId: string,
  followUpPrompt: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existingAgent = agentRepository.getAgent(agentId);
    if (!existingAgent) {
      return { success: false, error: "Agent not found" };
    }

    if (!existingAgent.sessionId) {
      return { success: false, error: "No session to continue" };
    }

    // Update existing agent to running status
    agentRepository.updateAgentStatus(agentId, "running");

    // Add user message to the log
    agentRepository.addMessage(
      agentId,
      "user",
      followUpPrompt,
      undefined,
      {}
    );

    // Continue the session with the same agent
    runAgentWithResume(
      agentId,
      existingAgent.projectPath,
      followUpPrompt,
      existingAgent.sessionId
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to continue agent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Run agent SDK query with session resume
async function runAgentWithResume(
  agentId: string,
  projectPath: string,
  prompt: string,
  sessionId: string
) {
  try {
    const messages = query({
      prompt,
      options: {
        cwd: projectPath,
        model: "claude-sonnet-4-5",
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
        },
        maxTurns: 10,
        resume: sessionId,
      },
    });

    // Process messages from SDK (same as runAgentInBackground)
    await processAgentMessages(agentId, messages);
  } catch (error) {
    console.error(`Agent ${agentId} failed:`, error);
    agentRepository.updateAgentStatus(
      agentId,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Run agent SDK query in background
async function runAgentInBackground(
  agentId: string,
  projectPath: string,
  prompt: string
) {
  try {
    const messages = query({
      prompt,
      options: {
        cwd: projectPath,
        model: "claude-sonnet-4-5",
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
        },
        maxTurns: 10,
      },
    });

    await processAgentMessages(agentId, messages);
  } catch (error) {
    console.error(`Agent ${agentId} failed:`, error);
    agentRepository.updateAgentStatus(
      agentId,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Shared message processing logic
async function processAgentMessages(agentId: string, messages: AsyncIterable<any>) {
  try {
    // Process messages from SDK
    for await (const message of messages) {
      // Log all messages for debugging
      let logContent = "";
      let metadata: Record<string, any> = {};

      // Update agent state based on message type
      if (message.type === "system" && message.subtype === "init") {
        agentRepository.updateAgent(agentId, {
          model: message.model || "claude-sonnet-4-5",
          maxContext: 200000, // Default, can be updated based on model
        });

        const modelName = message.model || "claude-sonnet-4-5";
        const toolCount = message.tools?.length || 0;
        const mcpCount = message.mcp_servers?.length || 0;

        logContent = `🚀 Agent initialized with ${modelName}\n✓ ${toolCount} tools loaded${mcpCount > 0 ? `\n✓ ${mcpCount} MCP servers connected` : ''}`;
        metadata = { tools: message.tools, mcp_servers: message.mcp_servers };
      }

      if (message.type === "assistant") {
        let assistantMessage = "";
        let parsedMetadata: Record<string, any> = {};

        // Parse assistant message structure
        if (typeof message.message === "string") {
          assistantMessage = message.message;
        } else if (message.message && typeof message.message === "object") {
          const msg = message.message as any;

          // Extract text content from content array
          if (msg.content && Array.isArray(msg.content)) {
            assistantMessage = msg.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
          }

          // Extract useful metadata
          if (msg.usage) {
            parsedMetadata.tokens = {
              input: msg.usage.input_tokens || 0,
              output: msg.usage.output_tokens || 0,
              cache_read: msg.usage.cache_read_input_tokens || 0,
              cache_creation: msg.usage.cache_creation_input_tokens || 0,
            };
          }
          if (msg.model) {
            parsedMetadata.model = msg.model;
          }
          if (msg.id) {
            parsedMetadata.message_id = msg.id;
          }
        }

        agentRepository.updateAgent(agentId, {
          lastMessage: assistantMessage || "Assistant message",
        });
        logContent = assistantMessage || "Assistant message";
        metadata = { ...metadata, ...parsedMetadata };
      }

      if (message.type === "user") {
        if (typeof message.message === "string") {
          logContent = message.message;
        } else if (message.message && typeof message.message === "object") {
          const msg = message.message as any;

          // Check if this is a tool result message
          if (msg.content && Array.isArray(msg.content)) {
            const toolResults = msg.content.filter((c: any) => c.type === "tool_result");

            if (toolResults.length > 0) {
              // Format tool results nicely
              logContent = toolResults.map((result: any) => {
                const toolId = result.tool_use_id || "unknown";
                const content = result.content || "";
                const isError = result.is_error || false;

                return `Tool Result (${toolId.substring(0, 20)}...)\n${isError ? "❌ Error:" : "✅"} ${
                  typeof content === "string" ? content.substring(0, 500) : JSON.stringify(content).substring(0, 500)
                }`;
              }).join("\n\n");

              metadata = {
                tool_results: toolResults.map((r: any) => ({
                  tool_use_id: r.tool_use_id,
                  is_error: r.is_error,
                  content_length: typeof r.content === "string" ? r.content.length : 0,
                })),
              };
            } else {
              logContent = JSON.stringify(msg);
            }
          } else {
            logContent = JSON.stringify(msg);
          }
        }
      }

      if (message.type === "stream_event") {
        // Tool usage and other events come through stream_event
        try {
          const event = message as any;

          // Try to extract useful information from stream events
          if (event.event_type) {
            logContent = `Stream: ${event.event_type}`;

            // Extract tool usage if present
            if (event.event_type === "tool_use" && event.tool_name) {
              logContent = `Using tool: ${event.tool_name}`;
              metadata = {
                tool_name: event.tool_name,
                tool_input: event.tool_input,
              };
            } else if (event.event_type === "tool_result" && event.tool_name) {
              logContent = `Tool result: ${event.tool_name}`;
              const output = typeof event.tool_output === "string"
                ? event.tool_output.substring(0, 500)
                : JSON.stringify(event.tool_output).substring(0, 500);
              metadata = {
                tool_name: event.tool_name,
                output: output,
              };
            } else {
              logContent = `Stream event: ${event.event_type}`;
            }
          } else {
            logContent = `Stream event: ${JSON.stringify(message).substring(0, 200)}`;
          }
        } catch {
          logContent = "Stream event (unable to parse)";
        }
      }

      if (message.type === "tool_progress") {
        logContent = "Tool in progress...";
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          const totalTokens = message.usage?.input_tokens || 0 + message.usage?.output_tokens || 0;
          const cost = message.total_cost_usd || 0;
          const duration = message.duration_ms ? `${(message.duration_ms / 1000).toFixed(1)}s` : "N/A";

          agentRepository.updateAgentStatus(agentId, "completed");
          agentRepository.updateAgent(agentId, {
            totalTokens: totalTokens,
            totalCost: cost,
            contextUsed: totalTokens,
            sessionId: message.session_id,
          });

          logContent = `✅ Completed successfully\n⏱️ Duration: ${duration}\n💰 Cost: $${cost.toFixed(6)}`;
          metadata = {
            usage: message.usage,
            duration_ms: message.duration_ms,
            total_cost: cost,
            session_id: message.session_id,
          };
        } else {
          // Handle all error types
          const errorMsg = message.errors && message.errors.length > 0
            ? message.errors[0]
            : `Error: ${message.subtype}`;
          agentRepository.updateAgentStatus(
            agentId,
            "error",
            errorMsg
          );
          logContent = `❌ ${errorMsg}`;
          metadata = { errors: message.errors };
        }
      }

      // Add message to log
      if (logContent) {
        agentRepository.addMessage(
          agentId,
          message.type,
          logContent,
          "subtype" in message ? message.subtype : undefined,
          metadata
        );
      }
    }
  } catch (error) {
    console.error(`Agent ${agentId} message processing failed:`, error);
    throw error;
  }
}

// ============ New Session-Based Actions ============

/**
 * Discover and add a git repository
 */
export async function addRepository(
  localPath: string
): Promise<{ success: boolean; repository?: Repository; error?: string }> {
  try {
    const repo = await parseGitRepository(localPath);
    if (!repo) {
      return { success: false, error: "Not a valid git repository" };
    }

    const added = sessionRepository.addRepository(repo);
    return { success: true, repository: added };
  } catch (error) {
    console.error("Failed to add repository:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all repositories with their sessions
 */
export async function getRepositories(): Promise<Repository[]> {
  return sessionRepository.getAllRepositories();
}

/**
 * Start a new session in a repository
 */
export async function startSession(
  repositoryPath: string,
  prompt: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    // Find or create repository
    let repo = sessionRepository.findRepositoryByPath(repositoryPath);

    if (!repo) {
      const parsed = await parseGitRepository(repositoryPath);
      if (!parsed) {
        return { success: false, error: "Not a valid git repository" };
      }
      repo = sessionRepository.addRepository(parsed);
    }

    // Create session
    const session = sessionRepository.createSession({
      repositoryId: repo.id,
      prompt,
      model: "claude-sonnet-4-5",
    });

    // Run session in background
    runSessionInBackground(session.id, repositoryPath, prompt);

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

    const repo = sessionRepository.getRepository(session.repositoryId);
    if (!repo) {
      return { success: false, error: "Repository not found" };
    }

    // Update session status
    sessionRepository.updateSessionStatus(sessionId, "active");

    // Add user message
    sessionRepository.addSessionMessage(sessionId, "user", prompt);

    // Run with resume
    runSessionWithResume(
      sessionId,
      repo.localPath,
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
 * Get a specific session
 */
export async function getSessionDetails(
  sessionId: string
): Promise<Session | null> {
  return sessionRepository.getSession(sessionId);
}

/**
 * Run session in background with sub-agent support
 */
async function runSessionInBackground(
  sessionId: string,
  repositoryPath: string,
  prompt: string
) {
  try {
    const messages = query({
      prompt,
      options: {
        cwd: repositoryPath,
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
            prompt: "You are a testing specialist. Run tests, analyze results, and report findings clearly.",
            model: "haiku",
          },
          "type-checker": {
            description: "Checks TypeScript types and validates code",
            tools: ["Bash", "Read"],
            prompt: "You are a TypeScript expert. Check for type errors and suggest fixes.",
            model: "haiku",
          },
          "code-reviewer": {
            description: "Reviews code for quality and best practices",
            tools: ["Read", "Grep", "Glob"],
            prompt: "You are a code reviewer. Focus on code quality, best practices, and potential issues.",
            model: "sonnet",
          },
          "linter": {
            description: "Runs linters and formatters",
            tools: ["Bash", "Read"],
            prompt: "You are a code quality tool. Run linters and formatters, report issues.",
            model: "haiku",
          },
          "documentation": {
            description: "Writes and updates documentation",
            tools: ["Read", "Write", "Edit", "Grep"],
            prompt: "You are a documentation specialist. Write clear, comprehensive documentation.",
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
  repositoryPath: string,
  prompt: string,
  sdkSessionId: string
) {
  try {
    const messages = query({
      prompt,
      options: {
        cwd: repositoryPath,
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
            prompt: "You are a testing specialist. Run tests, analyze results, and report findings clearly.",
            model: "haiku",
          },
          "type-checker": {
            description: "Checks TypeScript types and validates code",
            tools: ["Bash", "Read"],
            prompt: "You are a TypeScript expert. Check for type errors and suggest fixes.",
            model: "haiku",
          },
          "code-reviewer": {
            description: "Reviews code for quality and best practices",
            tools: ["Read", "Grep", "Glob"],
            prompt: "You are a code reviewer. Focus on code quality, best practices, and potential issues.",
            model: "sonnet",
          },
          "linter": {
            description: "Runs linters and formatters",
            tools: ["Bash", "Read"],
            prompt: "You are a code quality tool. Run linters and formatters, report issues.",
            model: "haiku",
          },
          "documentation": {
            description: "Writes and updates documentation",
            tools: ["Read", "Write", "Edit", "Grep"],
            prompt: "You are a documentation specialist. Write clear, comprehensive documentation.",
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

      // Detect sub-agent launches (Task tool usage)
      if (message.type === "stream_event") {
        const event = message as any;

        if (event.event_type === "tool_use" && event.tool_name === "Task") {
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
        } else if (event.event_type === "tool_result" && event.tool_name === "Task" && currentSubAgentId) {
          // Sub-agent completed
          const result = typeof event.tool_output === "string"
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
      }

      // Track standard messages
      if (message.type === "system" && message.subtype === "init") {
        const modelName = message.model || "claude-sonnet-4-5";
        const toolCount = message.tools?.length || 0;
        const agentCount = Object.keys(message.agents || {}).length;

        logContent = `🚀 Session initialized with ${modelName}\n✓ ${toolCount} tools loaded${agentCount > 0 ? `\n✓ ${agentCount} sub-agents available` : ''}`;
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
            const totalTokens = (msg.usage.input_tokens || 0) + (msg.usage.output_tokens || 0);
            sessionRepository.updateSessionMetrics(sessionId, {
              contextUsed: totalTokens,
              totalTokens: totalTokens,
            });
          }
        }

        logContent = assistantMessage || "Assistant message";
        metadata = { ...metadata, ...parsedMetadata };
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          const totalTokens = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
          const cost = message.total_cost_usd || 0;

          sessionRepository.updateSessionStatus(sessionId, "completed");
          sessionRepository.updateSessionMetrics(sessionId, {
            totalTokens,
            totalCost: cost,
            contextUsed: totalTokens,
            sdkSessionId: message.session_id,
          });

          const duration = message.duration_ms ? `${(message.duration_ms / 1000).toFixed(1)}s` : "N/A";
          logContent = `✅ Session completed\n⏱️ Duration: ${duration}\n💰 Cost: $${cost.toFixed(6)}`;
          metadata = {
            usage: message.usage,
            duration_ms: message.duration_ms,
            total_cost: cost,
            session_id: message.session_id,
          };
        } else {
          const errorMsg = message.errors && message.errors.length > 0
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
