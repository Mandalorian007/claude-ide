# Claude Agent SDK Quick Reference Guide

## Installation

```bash
pnpm add @anthropic-ai/claude-agent-sdk
```

## Basic Usage

### Spinning Up an Agent

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Simple query
for await (const message of query({
  prompt: "Your task here",
  options: {
    // Configuration options
  }
})) {
  if (message.type === "assistant") {
    console.log(message.content);
  }
}
```

## Core Configuration Options

### Essential Settings

```typescript
options: {
  // Model selection
  model: "claude-sonnet-4-5",

  // Working directory
  cwd: process.cwd(),

  // Max conversation turns
  maxTurns: 10,

  // Permission mode
  permissionMode: "default" | "acceptEdits" | "bypassPermissions" | "plan",

  // Tools control
  allowedTools: ["Read", "Write", "Edit", "Bash"],
  disallowedTools: ["WebSearch"],
}
```

### System Prompts

```typescript
options: {
  // Custom system prompt
  systemPrompt: "You are a coding assistant...",

  // OR use Claude Code's preset prompt
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: "Additional instructions..."  // Optional
  }
}
```

### Loading Settings from Filesystem

```typescript
options: {
  // Control which filesystem settings to load
  settingSources: ["user", "project", "local"],
  // user: ~/.claude/settings.json
  // project: .claude/settings.json (version controlled)
  // local: .claude/settings.local.json (gitignored)

  // NOTE: Must include 'project' to load CLAUDE.md files
}
```

## Subagents

Define specialized agents programmatically:

```typescript
options: {
  agents: {
    "code-reviewer": {
      description: "Reviews code for quality and best practices",
      tools: ["Read", "Grep", "Glob"],
      prompt: "You are a code reviewer. Focus on...",
      model: "sonnet" | "opus" | "haiku" | "inherit"
    },
    "bug-fixer": {
      description: "Diagnoses and fixes bugs",
      prompt: "You are a bug fixing specialist...",
      // If tools omitted, inherits all tools from parent
    }
  }
}
```

Agents can also be defined in `.claude/agents/*.md` files when using `settingSources`.

## Hooks

Hooks execute callbacks in response to events:

```typescript
options: {
  hooks: {
    PreToolUse: [
      {
        matcher: "Bash",  // Optional: filter by tool name
        hooks: [
          async (input, toolUseID, { signal }) => {
            console.log("About to run:", input.tool_input.command);

            return {
              decision: "approve",  // or "block"
              systemMessage: "Approved with logging"
            };
          }
        ]
      }
    ],
    PostToolUse: [
      {
        hooks: [
          async (input, toolUseID, { signal }) => {
            console.log("Tool completed:", input.tool_name);
            return { continue: true };
          }
        ]
      }
    ],
    UserPromptSubmit: [
      {
        hooks: [
          async (input) => {
            return {
              hookSpecificOutput: {
                hookEventName: "UserPromptSubmit",
                additionalContext: "Context from hook"
              }
            };
          }
        ]
      }
    ]
  }
}
```

### Available Hook Events

- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `UserPromptSubmit` - When user submits a prompt
- `SessionStart` - When session begins
- `SessionEnd` - When session ends
- `Stop` - When execution stops
- `SubagentStop` - When subagent stops
- `PreCompact` - Before context compaction
- `Notification` - For notifications

## MCP Servers (Model Context Protocol)

Extend agents with custom tools via MCP servers:

### Stdio MCP Server

```typescript
options: {
  mcpServers: {
    "my-server": {
      type: "stdio",
      command: "node",
      args: ["./path/to/mcp-server.js"],
      env: {
        API_KEY: process.env.API_KEY
      }
    }
  }
}
```

### HTTP/SSE MCP Servers

```typescript
options: {
  mcpServers: {
    "remote-server": {
      type: "http",  // or "sse"
      url: "https://api.example.com/mcp",
      headers: {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

### SDK-Based MCP Server (In-Process)

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Create tools
const myTool = tool(
  "fetch_data",
  "Fetches data from database",
  {
    id: z.string().describe("Record ID")
  },
  async (args, extra) => {
    const data = await fetchFromDB(args.id);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }
);

// Create server
const mcpServer = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [myTool]
});

// Use in query
options: {
  mcpServers: {
    "my-tools": mcpServer
  }
}
```

## Skills

Skills are loaded from `.claude/skills/*/SKILL.md` files when using `settingSources: ["project"]`:

```typescript
options: {
  settingSources: ["project"],  // Enables loading skills from .claude/skills/
  systemPrompt: {
    type: "preset",
    preset: "claude_code"  // Required for skills
  }
}
```

Skills are model-invoked capabilities that Claude uses autonomously. See [Agent Skills documentation](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) for creating skills.

## Plugins

Load custom plugins to extend functionality:

```typescript
options: {
  plugins: [
    { type: "local", path: "./my-plugin" },
    { type: "local", path: "/absolute/path/to/plugin" }
  ]
}
```

Plugin structure:
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json       # Required manifest
├── commands/             # Custom slash commands
├── agents/               # Custom agents
├── skills/               # Agent Skills
├── hooks/                # Event handlers
└── .mcp.json            # MCP server definitions
```

## Built-in Tools

Available tools include:

**File Operations:**
- `Read` - Read files (text, images, PDFs, notebooks)
- `Write` - Write files
- `Edit` - Edit files with string replacement
- `Glob` - Pattern-based file search
- `Grep` - Content search with regex

**Execution:**
- `Bash` - Execute shell commands
- `BashOutput` - Read background shell output
- `KillShell` - Terminate background shells

**Web:**
- `WebFetch` - Fetch and process web content
- `WebSearch` - Search the web

**Organization:**
- `TodoWrite` - Task tracking
- `Task` - Launch subagents

**MCP:**
- `ListMcpResources` - List MCP resources
- `ReadMcpResource` - Read MCP resource

**Other:**
- `NotebookEdit` - Edit Jupyter notebooks
- `ExitPlanMode` - Exit planning mode

## Permission Control

### Custom Permission Function

```typescript
options: {
  canUseTool: async (toolName, input, { signal, suggestions }) => {
    // Custom permission logic
    if (toolName === "Bash" && input.command.includes("rm -rf")) {
      return {
        behavior: "deny",
        message: "Dangerous command blocked"
      };
    }

    return {
      behavior: "allow",
      updatedInput: input,  // Can modify input
      updatedPermissions: []  // Can update rules
    };
  }
}
```

## Session Management

### Resume Sessions

```typescript
options: {
  resume: "session-id-here",
  forkSession: true  // Create new session ID but continue history
}
```

### Continue Last Session

```typescript
options: {
  continue: true
}
```

## Message Types

When processing messages:

```typescript
for await (const message of query({...})) {
  switch (message.type) {
    case "system":
      if (message.subtype === "init") {
        console.log("Model:", message.model);
        console.log("Tools:", message.tools);
        console.log("MCP servers:", message.mcp_servers);
      }
      break;

    case "assistant":
      console.log("Assistant:", message.message);
      break;

    case "user":
      console.log("User:", message.message);
      break;

    case "result":
      if (message.subtype === "success") {
        console.log("Result:", message.result);
        console.log("Usage:", message.usage);
        console.log("Cost:", message.total_cost_usd);
      }
      break;
  }
}
```

## Authentication

Set environment variables:

```bash
# Direct API access
export ANTHROPIC_API_KEY="your-key-here"

# OR Amazon Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
# + AWS credentials

# OR Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
# + Google Cloud credentials
```

## Complete Example

```typescript
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Create custom MCP tool
const fetchTool = tool(
  "fetch_user",
  "Fetches user data",
  { userId: z.string() },
  async (args) => ({
    content: [{ type: "text", text: `User ${args.userId} data...` }]
  })
);

const mcpServer = createSdkMcpServer({
  name: "user-tools",
  tools: [fetchTool]
});

// Run query with full configuration
for await (const message of query({
  prompt: "Analyze the codebase and fix any bugs",
  options: {
    model: "claude-sonnet-4-5",
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "Focus on TypeScript best practices"
    },
    settingSources: ["project"],
    permissionMode: "default",
    allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    maxTurns: 20,

    // Subagents
    agents: {
      "tester": {
        description: "Runs tests and validates fixes",
        tools: ["Bash", "Read"],
        prompt: "You are a testing specialist..."
      }
    },

    // MCP servers
    mcpServers: {
      "user-tools": mcpServer
    },

    // Hooks
    hooks: {
      PreToolUse: [{
        matcher: "Write",
        hooks: [
          async (input) => {
            console.log("Writing file:", input.tool_input.file_path);
            return { decision: "approve" };
          }
        ]
      }]
    },

    // Plugins
    plugins: [
      { type: "local", path: "./custom-plugins/code-review" }
    ]
  }
})) {
  if (message.type === "assistant") {
    console.log(message.message);
  }

  if (message.type === "result") {
    console.log("Completed in", message.duration_ms, "ms");
    console.log("Cost:", message.total_cost_usd, "USD");
  }
}
```

## Key Resources

- [TypeScript SDK Reference](https://docs.claude.com/en/docs/agent-sdk/typescript)
- [Python SDK Reference](https://docs.claude.com/en/docs/agent-sdk/python)
- [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [MCP Documentation](https://docs.claude.com/en/docs/mcp)
- [Plugins Guide](https://code.claude.com/docs/plugins)
