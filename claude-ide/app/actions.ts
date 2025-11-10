"use server";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { agentRepository } from "@/lib/agent-repository";
import { Agent, Project } from "@/lib/types";

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
