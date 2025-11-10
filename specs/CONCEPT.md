# Claude IDE - Concept

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js App                           │
│                                                          │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────┐   │
│  │ Projects │    │   Activity  │    │Orchestrator  │   │
│  │  Agents  │    │   Viewer    │    │     Chat     │   │
│  │  (Left)  │    │  (Middle)   │    │   (Right)    │   │
│  └─────┬────┘    └──────┬──────┘    └──────┬───────┘   │
│        │                │                   │           │
│        └────────────────┴───────────────────┘           │
│                         │                               │
│              ┌──────────▼────────────┐                  │
│              │   Server Actions      │                  │
│              │  (app/actions.ts)     │                  │
│              │                       │                  │
│              │  startAgent()         │                  │
│              │  getProjects()        │                  │
│              │  getAgentStatus()     │                  │
│              └──────────┬────────────┘                  │
│                         │                               │
│              ┌──────────▼────────────┐                  │
│              │   AgentRepository     │                  │
│              │  (In-Memory State)    │                  │
│              │                       │                  │
│              │  Track all agents     │                  │
│              │  Group by project     │                  │
│              │  Context/cost/status  │                  │
│              └──────────┬────────────┘                  │
│                         │                               │
│                 ┌───────┴────────┐                      │
│                 │                │                      │
│          ┌──────▼──────┐  ┌──────▼──────┐              │
│          │   Agent 1   │  │   Agent 2   │              │
│          │   Query     │  │   Query     │              │
│          │   (SDK)     │  │   (SDK)     │              │
│          │             │  │             │              │
│          │ project: A  │  │ project: A  │ Multiple     │
│          │ cwd: /A     │  │ cwd: /A     │ agents per   │
│          └─────────────┘  └─────────────┘ project      │
└──────────────────────────────────────────────────────────┘
```

## Core Components

### 1. UI (`/app`)
- **Left Panel**: Project-based agent list with live status and context usage
- **Middle Panel**: Activity viewer (placeholder for hook visibility)
- **Right Panel**: Chat interface to start agents
- **Responsive**: Clean 3-panel layout that adapts to screen size
- Real-time updates via Server Actions streaming

### 2. Backend
**Server Actions** (preferred for most operations):
- `startAgent(projectPath, prompt)` - Start agent on a project
- `getProjects()` - Get all projects with their agents
- `getAgentStatus(agentId)` - Get specific agent details
- `stopAgent(agentId)` - Stop a running agent

### 3. AgentRepository (In-Memory State)
Central state manager for all agents, organized by project.

**Data Structure:**
```ts
interface Agent {
  id: string;
  projectPath: string;      // 1:1 with working directory
  projectName: string;      // Extracted from path
  status: "running" | "completed" | "error" | "stopped";
  contextUsed: number;      // Live token usage
  maxContext: number;       // Model's context limit
  totalTokens: number;
  totalCost: number;
  model: string;
  description?: string;
  lastMessage?: string;
}

interface Project {
  path: string;
  name: string;
  agents: Agent[];          // Multiple agents per project
}
```

**Key Operations:**
- `createAgent(projectPath, ...)` - Create new agent record
- `updateAgentFromMessage(agentId, message)` - Update state from SDK message
- `getAgentsByProject(projectPath)` - Get all agents for a project
- `getAllProjects()` - Get projects grouped with their agents
- `getActiveAgents()` - Get all running agents across all projects

**Multi-Agent Support:**
- Multiple agents can work on the same project simultaneously
- Each agent is an independent SDK `query()` instance
- Each has its own context window and state
- Repository groups them by project for UI organization

### 4. Agent (SDK Query)
Each agent is a standard SDK `query()` instance:

```ts
// Create and run agent
async function startAgent(projectPath: string, prompt: string) {
  const agent = agentRepository.createAgent({ projectPath });

  try {
    const messages = query({
      prompt,
      options: {
        cwd: projectPath,
        model: "claude-sonnet-4-5",
        systemPrompt: { type: "preset", preset: "claude_code" }
      }
    });

    for await (const message of messages) {
      agentRepository.updateAgentFromMessage(agent.id, message);
      // Stream to UI here
    }
  } catch (error) {
    agentRepository.updateAgentStatus(agent.id, "error", error.message);
  }
}

// Get data for UI sidebar
function getProjectsForUI() {
  return agentRepository.getAllProjects().map(p => ({
    name: p.name,
    agents: p.agents.map(a => ({
      id: a.id,
      status: a.status,
      context: `${a.contextUsed}/${a.maxContext}`,
      description: a.description
    }))
  }));
}
```

**Agent Characteristics:**
- Independent `query()` instance per agent
- Each has own context window
- Works in specific project directory (cwd)
- Tracked by repository for state/cost/context

## Data Flow

### Starting an Agent
```
User: "Add auth to my-web-app" (UI)
    ↓
Server Action: startAgent("/repos/my-web-app", prompt)
    ↓
AgentRepository: createAgent(projectPath, ...)
    ↓
Returns Agent { id, projectPath, status: "running", ... }
    ↓
SDK query() starts with cwd = projectPath
    ↓
For each message from SDK:
    ↓
AgentRepository.updateAgentFromMessage(id, message)
    ↓
Stream to UI: Project card updates (context, status, cost)
    ↓
Agent completes or errors
    ↓
AgentRepository marks status: "completed" | "error"
    ↓
UI shows final state
```

### Multiple Agents on Same Project
```
User starts 3 tasks on "my-web-app":
    ↓
Agent 1: "Add auth" (running, 45k/200k context)
Agent 2: "Fix bugs" (running, 32k/200k context)
Agent 3: "Write tests" (running, 67k/200k context)
    ↓
All work independently in parallel
    ↓
Each has own query() instance, own context window
    ↓
Repository groups them by projectPath
    ↓
UI shows all 3 under "my-web-app" section
```

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Claude IDE                                               ⚙️  │
├──────────────┬──────────────────────┬────────────────────────┤
│ Projects     │ Activity             │ Chat                   │
│              │                      │                        │
│ my-web-app   │                      │ Select project:        │
│  🟢 auth     │   [Placeholder]      │ > my-web-app           │
│    45k/200k  │                      │                        │
│  🔴 bugs     │   Hook events        │ What should I work on? │
│    ERROR     │   will show here     │                        │
│  🟢 tests    │                      │ ┌────────────────────┐ │
│    32k/200k  │                      │ │ Add authentication │ │
│              │                      │ │ to the app         │ │
│ my-api       │                      │ └────────────────────┘ │
│  🟢 refactor │                      │                        │
│    67k/200k  │                      │ [Start Agent]          │
│              │                      │                        │
│ blog-site    │                      │ Running agents: 4      │
│  🟡 deploy   │                      │ Total cost: $0.0234    │
│    STOPPED   │                      │                        │
│              │                      │                        │
└──────────────┴──────────────────────┴────────────────────────┘
```

**Sidebar Organization:**
- Grouped by project (directory path)
- Multiple agents per project
- Each agent shows: status, description, context usage
- Projects sorted alphabetically
- Agents sorted by creation time (newest first)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **SDK**: `@anthropic-ai/claude-agent-sdk`
- **MCP**: `mcp-handler` (HTTP/SSE transport)
- **Backend**: Server Actions (primary) + API Routes (MCP only)
- **Streaming**: React Server Components + SSE
- **State**: In-memory registry (upgradeable to DB)

## File Structure

```
/app
  /page.tsx                # Main 3-panel layout (responsive)
  /actions.ts              # Server Actions (start agent, get projects, etc.)
  /components
    /ProjectsList.tsx      # Left panel - projects with agents
    /ActivityViewer.tsx    # Middle panel (placeholder)
    /AgentChat.tsx         # Right panel - start agents

/lib
  /agent-repository.ts     # In-memory state for all agents
  /agent-manager.ts        # Start/stop agents, stream updates
```

## Key Features

1. **Project-Based Organization** - All agents grouped by the directory they work in
2. **Multi-Agent per Project** - Run multiple independent agents on the same codebase
3. **Live State Tracking** - Real-time context usage, cost, and status per agent
4. **In-Memory Repository** - Fast, simple state management (DB upgradeable later)
5. **Responsive 3-Panel Layout** - Clean IDE-like interface
6. **Independent Agents** - Each is a standalone SDK `query()` with its own context
7. **Activity Visibility** - Middle panel for hook events (future)

## Implementation Priority

1. ✅ Agent repository with project-based organization
2. Basic 3-panel responsive layout
3. Server Action to start agent on a project
4. Stream SDK messages to UI via Server Actions
5. Display projects + agents in left sidebar
6. Single agent working (prove concept)
7. Multiple agents on same project in parallel
8. Live context/cost tracking updates
9. Agent stop/cleanup functionality
10. Activity panel hook visibility (future)
11. Project discovery from filesystem (future)
12. VS Code integration (future)

## The Magic

**User experience:**
- Select a project (e.g., "my-web-app")
- Start multiple agents with different tasks
- Watch them work independently in parallel
- See live context usage per agent
- All agents grouped under the project they're working on

**Example scenario:**
```
my-web-app/
  🟢 "Add authentication"      - 45k/200k - $0.0045
  🟢 "Fix CSS bugs"            - 32k/200k - $0.0032
  🟢 "Write tests"             - 67k/200k - $0.0067
  🔴 "Update documentation"    - ERROR
```

**Three-panel visibility:**
- **Left**: Projects + agents (status, context, cost)
- **Middle**: What's happening (hooks placeholder)
- **Right**: Start new agents on selected project

All visible, all controllable, organized by project.

## Why In-Memory Repository?

**Advantages:**
- Simple, fast, no DB setup required
- Easy to reason about state
- Perfect for MVP
- Upgradeable to persistent DB later

**What we track:**
- Agent ID, project path, status
- Context usage (live updates from SDK)
- Token count, cost
- Timestamps, last message, errors

**Multi-agent support:**
- Repository naturally groups by `projectPath`
- Each agent is independent `query()` instance
- No coordination needed between agents
- UI just displays grouped data
