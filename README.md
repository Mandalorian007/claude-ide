# Claude IDE

An agentic development environment for orchestrating multiple Claude agents across projects, built with Next.js 16 and the Claude Agent SDK.

## Project Structure

```
claude-ide/                    # Root directory
├── .claude/                   # Claude configuration
│   └── commands/             # Custom slash commands
├── .mcp.json                 # MCP server configurations
├── specs/                    # Project specifications
│   ├── CONCEPT.md           # Architecture and design concepts
│   └── CLAUDE_SDK_GUIDE.md  # SDK quick reference
└── claude-ide/              # Next.js application
    ├── app/                 # Next.js app router
    ├── components/          # React components
    ├── lib/                 # Utilities and core logic
    └── public/              # Static assets
```

**Important**: This repository has a nested structure where:
- The **root `claude-ide/` directory** contains agentic tooling, specifications, and Claude configurations
- The **nested `claude-ide/claude-ide/` directory** contains the Next.js application

## Overview

Claude IDE is a web-based interface for managing multiple Claude agents working on different projects simultaneously. It provides:

- **Multi-Agent Orchestration**: Run multiple independent agents on the same project in parallel
- **Project-Based Organization**: Agents grouped by the directory/project they're working on
- **Real-Time Tracking**: Live context usage, token counts, and cost monitoring per agent
- **3-Panel Interface**: Projects sidebar, activity viewer, and chat interface
- **MCP Integration**: Extensible via Model Context Protocol servers

## Architecture

### Core Components

1. **UI Layer** (`/app`)
   - **Left Panel**: Project-based agent list with live status and metrics
   - **Middle Panel**: Activity viewer for monitoring agent actions
   - **Right Panel**: Chat interface for starting new agents

2. **Backend Layer**
   - **Server Actions**: Primary API for agent operations (`startAgent`, `getProjects`, etc.)
   - **AgentRepository**: In-memory state management for all agents
   - **Agent Manager**: Handles SDK query lifecycle and streaming

3. **Agent Layer**
   - Each agent is an independent `query()` instance from the Claude Agent SDK
   - Agents work in specific project directories (via `cwd`)
   - Multiple agents can work on the same project simultaneously

### Data Flow

```
User Input → Server Action → AgentRepository → SDK query()
                ↓                                    ↓
            Create Agent Record              Execute in project dir
                ↓                                    ↓
        Stream Updates ← Update State ← SDK Messages
```

### Multi-Agent Support

The system supports multiple agents working independently:

```
my-web-app/
  🟢 "Add authentication"      - 45k/200k - $0.0045
  🟢 "Fix CSS bugs"            - 32k/200k - $0.0032
  🟢 "Write tests"             - 67k/200k - $0.0067
  🔴 "Update documentation"    - ERROR
```

Each agent:
- Has its own context window
- Operates independently
- Is tracked for tokens/cost/status
- Is grouped by project path in the UI

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
cd claude-ide/claude-ide
npm install

# Set up environment variables
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
```

### Development

```bash
# Start the development server
cd claude-ide/claude-ide
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Building

```bash
# Build for production
cd claude-ide/claude-ide
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
