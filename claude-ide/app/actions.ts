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
        logContent = `Initialized with model: ${message.model}`;
        metadata = { tools: message.tools, mcp_servers: message.mcp_servers };
      }

      if (message.type === "assistant") {
        const assistantMessage = typeof message.message === "string"
          ? message.message
          : JSON.stringify(message.message);
        agentRepository.updateAgent(agentId, {
          lastMessage: assistantMessage,
        });
        logContent = assistantMessage || "Assistant message";
      }

      if (message.type === "user") {
        logContent = typeof message.message === "string"
          ? message.message
          : JSON.stringify(message.message);
      }

      if (message.type === "stream_event") {
        // Tool usage and other events come through stream_event
        try {
          logContent = `Stream event: ${JSON.stringify(message).substring(0, 200)}`;
        } catch {
          logContent = "Stream event (unable to stringify)";
        }
      }

      if (message.type === "tool_progress") {
        logContent = "Tool in progress...";
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          agentRepository.updateAgentStatus(agentId, "completed");
          agentRepository.updateAgent(agentId, {
            totalTokens: message.usage?.total_tokens || 0,
            totalCost: message.total_cost_usd || 0,
            contextUsed: message.usage?.total_tokens || 0,
          });
          logContent = `Completed successfully. Tokens: ${message.usage?.total_tokens}, Cost: $${message.total_cost_usd}`;
          metadata = { usage: message.usage, duration_ms: message.duration_ms };
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
          logContent = errorMsg;
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
    console.error(`Agent ${agentId} failed:`, error);
    agentRepository.updateAgentStatus(
      agentId,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
