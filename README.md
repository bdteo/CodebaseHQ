# CodebaseHQ MCP Server

An MCP (Model Context Protocol) server that gives [Claude Code](https://docs.anthropic.com/en/docs/claude-code) access to [CodebaseHQ](https://www.codebasehq.com/) — a project management and ticketing platform. Read, search, create, and update tickets directly from Claude Code or any MCP-compatible client.

## Features

- **List projects** — browse all projects in your CodebaseHQ account
- **Search tickets** — full query syntax (status, assignee, priority, type, etc.) with pagination
- **View ticket details** — get complete ticket info with status/priority IDs for updates
- **Read comments** — full conversation thread with author names and file attachments
- **Activity feed** — see recent project activity (who created/updated what)
- **List team members** — discover user IDs for assignment
- **Create tickets** — create new tickets with type, priority, and assignee
- **Update tickets** — add comments, change status/priority/assignee, rename tickets

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (or npm/yarn)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or another MCP-compatible client
- A [CodebaseHQ](https://www.codebasehq.com/) account with API access

## Setup

### 1. Get your API credentials

Go to **CodebaseHQ → Settings → My Profile** and note:
- **API Username** — format: `account/username` (e.g. `mycompany/john`)
- **API Key** — 40-character string

### 2. Set environment variables

Add to your shell config (e.g. `~/.zshrc`, `~/.bashrc`):

```bash
export CODEBASEHQ_ACCOUNT="your-account"       # the part before /
export CODEBASEHQ_USERNAME="your-username"      # the part after /
export CODEBASEHQ_API_KEY="your-api-key"
export CODEBASEHQ_DEFAULT_PROJECT="my-project"  # optional — skip the project param in every tool call
```

### 3. Clone and build

```bash
git clone https://github.com/bdteo/CodebaseHQ.git
cd CodebaseHQ
pnpm install
pnpm run build
```

### 4. Register with Claude Code

Pick **one** of the methods below.

#### Option A: CLI command (global)

```bash
claude mcp add codebasehq -- node /absolute/path/to/CodebaseHQ/dist/index.js
```

The server inherits environment variables from your shell, so the `CODEBASEHQ_*` vars you set in step 2 are picked up automatically.

#### Option B: Global config file

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "codebasehq": {
      "command": "node",
      "args": ["/absolute/path/to/CodebaseHQ/dist/index.js"]
    }
  }
}
```

#### Option C: Project-scoped config

Create a `.mcp.json` in your project root (useful for sharing with a team):

```json
{
  "mcpServers": {
    "codebasehq": {
      "command": "node",
      "args": ["/absolute/path/to/CodebaseHQ/dist/index.js"],
      "env": {
        "CODEBASEHQ_ACCOUNT": "${CODEBASEHQ_ACCOUNT}",
        "CODEBASEHQ_USERNAME": "${CODEBASEHQ_USERNAME}",
        "CODEBASEHQ_API_KEY": "${CODEBASEHQ_API_KEY}",
        "CODEBASEHQ_DEFAULT_PROJECT": "${CODEBASEHQ_DEFAULT_PROJECT}"
      }
    }
  }
}
```

The `${VAR}` syntax references your shell environment variables — no secrets in the file.

### 5. Verify

Restart Claude Code, then ask:

> "List my CodebaseHQ projects"

If the server connects, you'll see your projects. If not, check [Troubleshooting](#troubleshooting).

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
- **Runtime dependencies:** `@modelcontextprotocol/sdk` only

## Troubleshooting

**"Invalid CodebaseHQ credentials or network error"**
- Double-check your `CODEBASEHQ_ACCOUNT`, `CODEBASEHQ_USERNAME`, and `CODEBASEHQ_API_KEY` values
- The account/username come from splitting the API Username on `/`
- Verify your API key in CodebaseHQ → Settings → My Profile

**Server not showing in Claude Code**
- Run `claude mcp list` to check connection status
- Make sure the path to `dist/index.js` is absolute
- Rebuild with `pnpm run build` after any source changes
- Restart Claude Code after config changes

**Rate limited**
- The server automatically retries after the delay
- Reduce the `limit` parameter in queries if hitting limits frequently

## Disclaimer

This project is **not affiliated with, endorsed by, or associated with** aTech Media Ltd / Krystal Hosting Ltd (the makers of CodebaseHQ). It is an independent, open-source API client. You need your own CodebaseHQ account and API credentials to use it.

## License

[MIT](LICENSE)
