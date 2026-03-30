#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CodebaseHQClient } from './codebasehq-api.js';
import type { UserResponse } from './types.js';

// Validate environment
const account = process.env.CODEBASEHQ_ACCOUNT;
const username = process.env.CODEBASEHQ_USERNAME;
const apiKey = process.env.CODEBASEHQ_API_KEY;
const defaultProject = process.env.CODEBASEHQ_DEFAULT_PROJECT;

if (!account || !username || !apiKey) {
  console.error('Error: CODEBASEHQ_ACCOUNT, CODEBASEHQ_USERNAME, and CODEBASEHQ_API_KEY environment variables are required');
  process.exit(1);
}

const client = new CodebaseHQClient(account, username, apiKey);

// Validate credentials
try {
  await client.getProjects();
  console.error(`✓ Authenticated as ${username} on ${account}`);
  if (defaultProject) console.error(`✓ Default project: ${defaultProject}`);
} catch (error) {
  console.error('Error: Invalid CodebaseHQ credentials or network error');
  console.error(error);
  process.exit(1);
}

// User cache: userId -> display name
const userCache = new Map<number, string>();

async function loadProjectUsers(project: string): Promise<void> {
  if (userCache.size > 0) return;
  try {
    const users = await client.getProjectUsers(project);
    for (const u of users) {
      userCache.set(u.id, `${u.first_name} ${u.last_name}`);
    }
  } catch {
    // Non-critical, continue without cache
  }
}

function getUserName(userId: number): string {
  return userCache.get(userId) || `user-${userId}`;
}

// Helper: resolve project param (use default if not provided)
function resolveProject(args: Record<string, unknown> | undefined): string {
  const project = args?.project as string | undefined;
  if (project) return project;
  if (defaultProject) return defaultProject;
  throw new Error('project is required (no default project configured)');
}

// Create MCP server
const server = new Server(
  {
    name: 'codebasehq',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
    instructions: `CodebaseHQ is a project management and ticketing platform (codebasehq.com). This MCP server provides access to the "${account}" account.${defaultProject ? ` The default project is "${defaultProject}" — you can omit the project parameter for most tools.` : ''}

## Typical Workflows

**Browse tickets:** search_tickets → get_ticket (for detail) → get_ticket_notes (for comments)
**Find my work:** search_tickets with query "assignee:me status:open"
**Update a ticket:** get_ticket first (to see current status/priority IDs), then update_ticket
**Create a ticket:** Use list_users to find assignee IDs, then create_ticket
**Recent activity:** get_activity to see what changed recently

## Search Query Syntax (for search_tickets)
- status:open, status:closed, status:New
- priority:high, priority:Normal, priority:Critical
- assignee:me, assignee:none, assignee:{username}
- reporter:me, reporter:{username}
- type:bug, type:Feature, type:Task
- category:General
- sort:priority, sort:updated, order:asc, order:desc
- not-status:closed, not-priority:low
- Combine: "assignee:me status:open sort:updated"
- Pagination: 20 tickets per page, use page parameter

## Important Notes
- Ticket updates are done via notes (update_ticket posts a note and optionally changes fields)
- get_ticket returns status.id, priority.id, category.id — use these IDs when updating
- Web URLs are included in responses for easy browser access
- The account URL pattern is: https://${account}.codebasehq.com/projects/{project}/tickets/{id}`,
  }
);

const projectDesc = defaultProject
  ? `Project permalink (optional, defaults to "${defaultProject}")`
  : 'Project permalink (e.g. "my-project")';

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_projects',
      description: 'List all projects in the CodebaseHQ account. Returns project name, permalink, status, and ticket counts. Use the permalink value as the "project" parameter in other tools.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'search_tickets',
      description: `List and search tickets in a project. Without a query, returns all tickets (newest first). Supports search syntax: "status:open", "assignee:me", "priority:high", "type:bug", "sort:updated order:desc". Combine filters: "assignee:me status:open sort:priority". Returns 20 per page.`,
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          query: {
            type: 'string',
            description: 'Search query. Examples: "status:open", "assignee:me status:open", "priority:high sort:updated", "not-status:closed". Omit to list all tickets.',
          },
          page: { type: 'number', description: 'Page number (default: 1, 20 tickets per page). Returns 404 when past last page.' },
        },
        required: defaultProject ? [] : ['project'],
      },
    },
    {
      name: 'get_ticket',
      description: 'Get full details of a specific ticket by its ID number. Returns status/priority/category with both name and numeric ID (use IDs for update_ticket). Also shows assignee, reporter, dates, tags, and time tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          ticket_id: { type: 'number', description: 'Ticket number (e.g. 23)' },
        },
        required: defaultProject ? ['ticket_id'] : ['project', 'ticket_id'],
      },
    },
    {
      name: 'get_ticket_notes',
      description: 'Get the full conversation thread (notes/comments) on a ticket. Includes author name, content, timestamps, field change history, and file attachments with download URLs. Notes are in chronological order.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          ticket_id: { type: 'number', description: 'Ticket number (e.g. 23)' },
        },
        required: defaultProject ? ['ticket_id'] : ['project', 'ticket_id'],
      },
    },
    {
      name: 'get_activity',
      description: 'Get the recent activity feed for a project — shows who created/updated/commented on tickets and when. Returns 20 events per page, newest first. Useful for "what happened recently?" questions.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          page: { type: 'number', description: 'Page number for older entries (default: 1)' },
        },
        required: defaultProject ? [] : ['project'],
      },
    },
    {
      name: 'list_users',
      description: 'List all team members assigned to a project. Returns user IDs (needed for assignee_id in create_ticket/update_ticket), names, usernames, emails, and company. Call this before creating or assigning tickets.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
        },
        required: defaultProject ? [] : ['project'],
      },
    },
    {
      name: 'create_ticket',
      description: 'Create a new ticket in a project. Only "summary" is required — all other fields are optional and will use project defaults. Use list_users to find assignee_id values. Use get_ticket on any existing ticket to discover valid priority_id and category_id values.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          summary: { type: 'string', description: 'Ticket title (required)' },
          description: { type: 'string', description: 'Detailed description of the issue or request' },
          ticket_type: {
            type: 'string',
            description: 'Ticket type',
            enum: ['Bug', 'Feature', 'Task'],
          },
          priority_id: { type: 'number', description: 'Priority ID number (get valid IDs from get_ticket on any existing ticket)' },
          assignee_id: { type: 'number', description: 'User ID to assign to (get valid IDs from list_users)' },
        },
        required: defaultProject ? ['summary'] : ['project', 'summary'],
      },
    },
    {
      name: 'update_ticket',
      description: 'Update a ticket by posting a note. Can optionally change status, priority, assignee, or rename the ticket in the same operation. At minimum provide content (comment text) or a field change. Use get_ticket first to see current field IDs.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          ticket_id: { type: 'number', description: 'Ticket number to update' },
          content: { type: 'string', description: 'Comment/note text to add to the ticket' },
          status_id: { type: 'number', description: 'New status ID (get from get_ticket response)' },
          priority_id: { type: 'number', description: 'New priority ID (get from get_ticket response)' },
          assignee_id: { type: 'number', description: 'New assignee user ID (from list_users). Use 0 to unassign.' },
          subject: { type: 'string', description: 'Rename the ticket to this new title' },
          private: { type: 'boolean', description: 'If true, this note is only visible to your own company, not the client' },
        },
        required: defaultProject ? ['ticket_id'] : ['project', 'ticket_id'],
      },
    },
    {
      name: 'download_attachment',
      description: 'Download one or more ticket attachments to local disk. Provide an array of {url, path} pairs. URLs come from get_ticket_notes attachment responses. Creates parent directories automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            description: 'Array of files to download',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'Attachment URL from get_ticket_notes' },
                path: { type: 'string', description: 'Absolute destination file path' },
              },
              required: ['url', 'path'],
            },
          },
        },
        required: ['files'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_projects': {
        const projects = await client.getProjects();
        const formatted = projects.map(p => ({
          name: p.project.name,
          permalink: p.project.permalink,
          status: p.project.status,
          open_tickets: p.project.open_tickets,
          closed_tickets: p.project.closed_tickets,
          total_tickets: p.project.total_tickets,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
        };
      }

      case 'search_tickets': {
        const project = resolveProject(args);
        const query = args?.query as string | undefined;
        const page = (args?.page as number) || 1;

        const tickets = await client.getTickets(project, query, page);
        const formatted = tickets.map(t => ({
          ticket_id: t.ticket.ticket_id,
          summary: t.ticket.summary,
          type: t.ticket.ticket_type,
          status: t.ticket.status.name,
          priority: t.ticket.priority.name,
          assignee: t.ticket.assignee || 'unassigned',
          reporter: t.ticket.reporter,
          category: t.ticket.category.name,
          tags: t.ticket.tags || undefined,
          created_at: t.ticket.created_at,
          updated_at: t.ticket.updated_at,
          url: `https://${account}.codebasehq.com/projects/${project}/tickets/${t.ticket.ticket_id}`,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify({ page, count: formatted.length, tickets: formatted }, null, 2) }],
        };
      }

      case 'get_ticket': {
        const project = resolveProject(args);
        const ticketId = args?.ticket_id as number;
        if (!ticketId) throw new Error('ticket_id is required');

        const ticket = await client.getTicket(project, ticketId);
        const formatted = {
          ticket_id: ticket.ticket_id,
          summary: ticket.summary,
          type: ticket.ticket_type,
          status: { name: ticket.status.name, id: ticket.status.id },
          priority: { name: ticket.priority.name, id: ticket.priority.id },
          category: { name: ticket.category.name, id: ticket.category.id },
          assignee: ticket.assignee || 'unassigned',
          assignee_id: ticket.assignee_id,
          reporter: ticket.reporter,
          milestone: ticket.milestone?.name || null,
          tags: ticket.tags || undefined,
          start_on: ticket.start_on,
          deadline: ticket.deadline,
          estimated_time: ticket.estimated_time,
          total_time_spent: ticket.total_time_spent,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          url: `https://${account}.codebasehq.com/projects/${project}/tickets/${ticket.ticket_id}`,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
        };
      }

      case 'get_ticket_notes': {
        const project = resolveProject(args);
        const ticketId = args?.ticket_id as number;
        if (!ticketId) throw new Error('ticket_id is required');

        await loadProjectUsers(project);
        const notes = await client.getTicketNotes(project, ticketId);
        const formatted = notes.map(n => ({
          id: n.ticket_note.id,
          author: getUserName(n.ticket_note.user_id),
          content: n.ticket_note.content,
          created_at: n.ticket_note.created_at,
          updates: n.ticket_note.updates !== '{}' ? n.ticket_note.updates : undefined,
          attachments: n.ticket_note.attachments.length > 0
            ? n.ticket_note.attachments.map(a => ({
                filename: a['file-name'],
                url: a.url,
                size: a['file-size'],
              }))
            : undefined,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify({ ticket_id: ticketId, notes: formatted }, null, 2) }],
        };
      }

      case 'get_activity': {
        const project = resolveProject(args);
        const page = (args?.page as number) || 1;

        const events = await client.getActivity(project, page);
        const formatted = events.map(e => ({
          title: e.event.title,
          type: e.event.type,
          timestamp: e.event.timestamp,
          actor: e.event.actor_name,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify({ page, events: formatted }, null, 2) }],
        };
      }

      case 'list_users': {
        const project = resolveProject(args);
        const users = await client.getProjectUsers(project);
        const formatted = users.map((u: UserResponse) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          username: u.username,
          email: u.email_address,
          company: u.company,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
        };
      }

      case 'create_ticket': {
        const project = resolveProject(args);
        const summary = args?.summary as string;
        if (!summary) throw new Error('summary is required');

        const ticket = await client.createTicket(project, {
          summary,
          description: args?.description as string | undefined,
          ticketType: args?.ticket_type as string | undefined,
          priorityId: args?.priority_id as number | undefined,
          assigneeId: args?.assignee_id as number | undefined,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            created: true,
            ticket_id: ticket.ticket_id,
            summary: ticket.summary,
            status: ticket.status.name,
            url: `https://${account}.codebasehq.com/projects/${project}/tickets/${ticket.ticket_id}`,
          }, null, 2) }],
        };
      }

      case 'update_ticket': {
        const project = resolveProject(args);
        const ticketId = args?.ticket_id as number;
        if (!ticketId) throw new Error('ticket_id is required');

        const assigneeRaw = args?.assignee_id as number | undefined;

        await client.updateTicket(project, ticketId, {
          content: args?.content as string | undefined,
          statusId: args?.status_id as number | undefined,
          priorityId: args?.priority_id as number | undefined,
          assigneeId: assigneeRaw === 0 ? null : assigneeRaw,
          subject: args?.subject as string | undefined,
          isPrivate: args?.private as boolean | undefined,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            updated: true,
            ticket_id: ticketId,
            url: `https://${account}.codebasehq.com/projects/${project}/tickets/${ticketId}`,
          }, null, 2) }],
        };
      }

      case 'download_attachment': {
        const files = args?.files as Array<{ url: string; path: string }>;
        if (!files || files.length === 0) throw new Error('files array is required');

        const results = await Promise.all(
          files.map(async (f) => {
            try {
              const { size } = await client.downloadAttachment(f.url, f.path);
              return { path: f.path, size, ok: true };
            } catch (error) {
              return { path: f.path, error: error instanceof Error ? error.message : String(error), ok: false };
            }
          })
        );

        const succeeded = results.filter(r => r.ok).length;
        return {
          content: [{ type: 'text', text: JSON.stringify({
            downloaded: succeeded,
            failed: results.length - succeeded,
            files: results,
          }, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CodebaseHQ MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
