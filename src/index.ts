#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CodebaseHQClient } from './codebasehq-api.js';

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
      description: 'List all projects in the CodebaseHQ account',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'search_tickets',
      description: 'Search tickets in a project. Supports query syntax: status:open, assignee:me, priority:high, category:General, type:bug, sort:priority, not-status:closed. Returns 20 per page.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          query: {
            type: 'string',
            description: 'Search query (e.g. "status:open assignee:me", "priority:high", "status:open sort:updated")',
          },
          page: { type: 'number', description: 'Page number (default: 1, 20 tickets per page)' },
        },
        required: defaultProject ? [] : ['project'],
      },
    },
    {
      name: 'get_ticket',
      description: 'Get full details of a specific ticket by ID',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          ticket_id: { type: 'number', description: 'Ticket ID number' },
        },
        required: defaultProject ? ['ticket_id'] : ['project', 'ticket_id'],
      },
    },
    {
      name: 'get_ticket_notes',
      description: 'Get notes/comments and attachments on a specific ticket',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          ticket_id: { type: 'number', description: 'Ticket ID number' },
        },
        required: defaultProject ? ['ticket_id'] : ['project', 'ticket_id'],
      },
    },
    {
      name: 'get_activity',
      description: 'Get recent activity feed for a project (ticket creates, updates, comments). Returns 20 events per page.',
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
      name: 'create_ticket',
      description: 'Create a new ticket in a project',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          summary: { type: 'string', description: 'Ticket title/summary' },
          description: { type: 'string', description: 'Detailed description (supports markdown)' },
          ticket_type: { type: 'string', description: 'Type: Bug, Feature, or Task' },
          priority_id: { type: 'number', description: 'Priority ID (get from ticket details to see available IDs)' },
          assignee_id: { type: 'number', description: 'User ID to assign (get from project users)' },
        },
        required: defaultProject ? ['summary'] : ['project', 'summary'],
      },
    },
    {
      name: 'update_ticket',
      description: 'Add a note/comment to a ticket and optionally change its status, priority, assignee, or subject. Changes are made by posting a ticket note.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: projectDesc },
          ticket_id: { type: 'number', description: 'Ticket ID number' },
          content: { type: 'string', description: 'Comment/note text' },
          status_id: { type: 'number', description: 'New status ID' },
          priority_id: { type: 'number', description: 'New priority ID' },
          assignee_id: { type: 'number', description: 'New assignee user ID (use 0 to unassign)' },
          subject: { type: 'string', description: 'New ticket title/summary' },
          private: { type: 'boolean', description: 'Make this note private (visible only to your company)' },
        },
        required: defaultProject ? ['ticket_id'] : ['project', 'ticket_id'],
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

        const notes = await client.getTicketNotes(project, ticketId);
        const formatted = notes.map(n => ({
          id: n.ticket_note.id,
          content: n.ticket_note.content,
          user_id: n.ticket_note.user_id,
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
          title: e.title,
          type: e.type,
          timestamp: e.timestamp,
          actor: e.actor_name,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify({ page, events: formatted }, null, 2) }],
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
