# Claude IDE

An agentic development environment for orchestrating Claude sessions with sub-agent workflows, built with Next.js 16 and the Claude Agent SDK.

## Project Structure

```
claude-ide/                    # Root directory
├── .claude/                   # Claude configuration
│   └── commands/             # Custom slash commands
├── .mcp.json                 # MCP server configurations
├── specs/                    # Project specifications
│   ├── CONCEPT.md           # Architecture and design concepts
│   └── CLAUDE_SDK_GUIDE.md  # SDK quick reference
└── web-app/                 # Next.js application
    ├── app/                 # Next.js app router
    │   ├── actions.ts      # Server Actions API
    │   └── page.tsx        # Main UI layout
    ├── components/          # React components
    │   ├── session-input.tsx    # Session starter
    │   ├── sessions-list.tsx    # Sessions sidebar
    │   └── conversation-view.tsx # Main conversation
    ├── lib/                 # Utilities and core logic
    │   ├── types.ts        # TypeScript definitions
    │   ├── git-utils.ts    # Git repository utilities
    │   └── session-repository.ts # State management
    └── public/              # Static assets
```

**Important**: This repository has a nested structure where:
- The **root directory** contains agentic tooling, specifications, and Claude configurations
- The **`web-app/` directory** contains the Next.js application

## Overview

Claude IDE is a **session-based** web interface for orchestrating Claude with sub-agent workflows, inspired by the Claude Code web interface. It provides:

- **Session-Based Workflows**: Each session is a conversation scoped to a Git repository
- **Sub-Agent Orchestration**: Main sessions can spawn specialized sub-agents (test-runner, code-reviewer, type-checker, etc.)
- **Git Repository Scoping**: Sessions are organized by repository, not directory
- **Real-Time Tracking**: Live context usage, token counts, and cost monitoring
- **2-Panel Interface**: Sessions list + conversation view (Claude Code style)
- **MCP Integration**: Extensible via Model Context Protocol servers

## Architecture

### Core Concepts

**Session-Based Design**: Inspired by Claude Code web interface, sessions are the primary unit of work:
- Each **Repository** represents a Git repo (natural project boundary)
- Each **Session** is a conversation/task within a repository
- Each **Sub-Agent** is a specialized task spawned by the main session

### Core Components

1. **UI Layer** (`/app`)
   - **Top Bar**: Session input (repository path + task description)
   - **Left Panel**: Sessions list grouped by repository, showing sub-agents
   - **Right Panel**: Conversation view with messages and sub-agent activity

2. **Backend Layer**
   - **Server Actions**: API for session operations (`startSession`, `continueSession`, `getRepositories`)
   - **SessionRepository**: In-memory state management for repos, sessions, and sub-agents
   - **Git Utils**: Repository discovery and parsing

3. **Session Layer**
   - Main session orchestrates work via Claude Agent SDK
   - Can spawn sub-agents for specialized tasks (test-runner, code-reviewer, etc.)
   - Sub-agents defined in `agents:` option of SDK `query()`

### Data Flow

```
User Input → startSession() → SessionRepository.createSession()
                ↓                           ↓
         SDK query() with sub-agents    Track state
                ↓                           ↓
         Main session works         Update session metrics
                ↓                           ↓
         Spawns sub-agent          Create SubAgent record
         (via Task tool)                    ↓
                ↓                    Track sub-agent execution
         Sub-agent completes               ↓
                ↓                    Update SubAgent status
         Results feed back                 ↓
         to main session            Stream to UI
```

### Session + Sub-Agent Workflow

The system uses an orchestrated workflow where the main session coordinates specialized sub-agents:

```
Mandalorian007/claude-ide
  📋 Session: "Refactor authentication"
     🤖 Sub-agent: test-runner    - 8k context
     🤖 Sub-agent: type-checker   - 6k context
     └─ Status: ✅ Completed      - 45k/200k total - $0.0045
```

**Sub-Agents Available:**
- `test-runner`: Runs tests and validates changes (Haiku, fast & cheap)
- `type-checker`: Validates TypeScript types (Haiku)
- `code-reviewer`: Reviews code quality (Sonnet, more capable)
- `linter`: Runs linters and formatters (Haiku)
- `documentation`: Writes documentation (Sonnet)

Each session:
- Has its own context window (up to 200k tokens)
- Can spawn multiple sub-agents
- Sub-agents have their own context/cost tracking
- Session can be resumed/continued after completion

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **React**: 19.2.0
- **SDK**: `@anthropic-ai/claude-agent-sdk`
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS 4 with tweakcn theming
- **Icons**: lucide-react
- **Backend**: Server Actions + API Routes (MCP only)
- **Streaming**: React Server Components + SSE
- **State Management**: In-memory repository (upgradeable to database)

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- Anthropic API key

### Installation

```bash
# Install dependencies for the Next.js app
cd web-app
npm install

# Set up environment variables
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
```

### Development

```bash
# Start the development server
cd web-app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Building

```bash
# Build for production
cd web-app
npm run build

# Start production server
npm start
```

## MCP Servers

The project includes MCP (Model Context Protocol) server configurations in `.mcp.json`:

- **shadcn**: Provides shadcn/ui component integration via MCP

Additional MCP servers can be configured to extend agent capabilities with custom tools and resources.

## Configuration

### Claude Configuration

The `.claude/` directory contains:
- **commands/**: Custom slash commands for agent workflows
- Additional Claude Code configurations

### MCP Configuration

The `.mcp.json` file at the root defines available MCP servers. These servers extend agent capabilities with custom tools.

## Development Roadmap

- [x] Agent repository with project-based organization
- [ ] Basic 3-panel responsive layout
- [ ] Server Action to start agent on a project
- [ ] Stream SDK messages to UI via Server Actions
- [ ] Display projects + agents in left sidebar
- [ ] Single agent working (prove concept)
- [ ] Multiple agents on same project in parallel
- [ ] Live context/cost tracking updates
- [ ] Agent stop/cleanup functionality
- [ ] Activity panel hook visibility
- [ ] Project discovery from filesystem
- [ ] VS Code integration

## Key Features

1. **Project-Based Organization** - All agents grouped by working directory
2. **Multi-Agent per Project** - Run multiple independent agents on the same codebase
3. **Live State Tracking** - Real-time context usage, cost, and status per agent
4. **In-Memory Repository** - Fast, simple state management (database upgradeable)
5. **Responsive 3-Panel Layout** - Clean IDE-like interface
6. **Independent Agents** - Each is a standalone SDK `query()` with its own context
7. **MCP Extensibility** - Custom tools via Model Context Protocol

## Documentation

- **[CONCEPT.md](./specs/CONCEPT.md)**: Detailed architecture and design concepts
- **[CLAUDE_SDK_GUIDE.md](./specs/CLAUDE_SDK_GUIDE.md)**: Quick reference for the Claude Agent SDK
- [Claude Agent SDK Docs](https://docs.claude.com/en/docs/agent-sdk/typescript)
- [Model Context Protocol](https://docs.claude.com/en/docs/mcp)

## License

Private project - All rights reserved

## Contributing

This is a private development project. For questions or collaboration inquiries, please contact the repository owner.
