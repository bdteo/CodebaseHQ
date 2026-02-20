# CodebaseHQ MCP Server

An MCP (Model Context Protocol) server that gives Claude access to [CodebaseHQ](https://www.codebasehq.com/) — a project management and ticketing platform. Read, search, create, and update tickets directly from Claude Code or any MCP-compatible client.

## Features

- **List projects** — browse all projects in your CodebaseHQ account
- **Search tickets** — full query syntax (status, assignee, priority, type, etc.) with pagination
- **View ticket details** — get complete ticket info with status/priority IDs for updates
- **Read comments** — full conversation thread with author names and file attachments
- **Activity feed** — see recent project activity (who created/updated what)
- **List team members** — discover user IDs for assignment
- **Create tickets** — create new tickets with type, priority, and assignee
- **Update tickets** — add comments, change status/priority/assignee, rename tickets

## Setup

### 1. Get your API credentials

Go to **CodebaseHQ → Settings → My Profile** and note:
- **API Username** (format: `account/username`)
- **API Key** (40-character string)

### 2. Set environment variables

Add to your shell config (e.g. `~/.zshrc`, `~/.bashrc`):

```bash
export CODEBASEHQ_ACCOUNT="your-account"
export CODEBASEHQ_USERNAME="your-username"
export CODEBASEHQ_API_KEY="your-api-key"
export CODEBASEHQ_DEFAULT_PROJECT="your-project-permalink"  # optional
```

The account and username come from the API Username field split on `/`.

### 3. Install and build

```bash
pnpm install
pnpm run build
```

### 4. Register with Claude Code

```bash
claude mcp add codebasehq -- node /path/to/CodebaseHQ/dist/index.js
```

Or add manually to `~/.claude.json`:

```json
{
  "mcpServers": {
    "codebasehq": {
      "command": "node",
      "args": ["/path/to/CodebaseHQ/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `list_projects` | Read | List all projects with ticket counts |
| `search_tickets` | Read | Search/list tickets with query syntax and pagination |
| `get_ticket` | Read | Full ticket detail by ID (includes field IDs for updates) |
| `get_ticket_notes` | Read | Comments, change history, and attachments |
| `get_activity` | Read | Recent project activity feed |
| `list_users` | Read | Team members with IDs for assignment |
| `create_ticket` | Write | Create a new ticket |
| `update_ticket` | Write | Add comment and/or change status, priority, assignee |

## Search Query Syntax

The `search_tickets` tool supports CodebaseHQ's query syntax:

```
status:open                    # by status
assignee:me                    # your tickets
priority:high                  # by priority
type:bug                       # Bug, Feature, or Task
category:General               # by category
sort:updated order:desc        # sorting
not-status:closed              # negation
assignee:me status:open        # combine filters
```

## Usage Examples

Ask Claude things like:

- "Show me all open tickets"
- "What tickets are assigned to me?"
- "Show me ticket #23 and its comments"
- "What happened recently on the project?"
- "Create a bug ticket for the login page issue"
- "Mark ticket #5 as closed with a comment"
- "Who's on the team? Assign ticket #10 to Mario"

## Architecture

```
src/
├── index.ts            # MCP server, tool definitions, request handlers
├── codebasehq-api.ts   # HTTP client (JSON responses, XML write bodies, rate limiting)
└── types.ts            # TypeScript types for API responses
```

- **Transport:** stdio (stdin/stdout)
- **API:** CodebaseHQ REST API v3 (`api3.codebasehq.com`)
- **Auth:** HTTP Basic (`account/username:api_key`)
- **Responses:** JSON (read), XML (write bodies)
- **Rate limiting:** Automatic retry with backoff on 429

## Tech Stack

- TypeScript (ES2022, Node16 modules)
- `@modelcontextprotocol/sdk` — MCP protocol implementation
- Zero additional runtime dependencies

## License

MIT
