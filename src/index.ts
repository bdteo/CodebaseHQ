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

if (!account || !username || !apiKey) {
  console.error('Error: CODEBASEHQ_ACCOUNT, CODEBASEHQ_USERNAME, and CODEBASEHQ_API_KEY environment variables are required');
  process.exit(1);
}

const client = new CodebaseHQClient(account, username, apiKey);

// Validate credentials by fetching projects
try {
  await client.getProjects();
  console.error(`✓ Authenticated as ${username} on ${account}`);
} catch (error) {
  console.error('Error: Invalid CodebaseHQ credentials or network error');
  console.error(error);
  process.exit(1);
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
      name: 'get_tickets',
      description: 'Get tickets for a CodebaseHQ project, with optional search query',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project permalink (e.g. "my-project")',
          },
          query: {
            type: 'string',
            description: 'Optional search query to filter tickets',
          },
        },
        required: ['project'],
      },
    },
    {
      name: 'get_ticket',
      description: 'Get a specific ticket with its details',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project permalink',
          },
          ticket_id: {
            type: 'number',
            description: 'Ticket ID number',
          },
        },
        required: ['project', 'ticket_id'],
      },
    },
    {
      name: 'get_ticket_notes',
      description: 'Get notes/comments on a specific ticket',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project permalink',
          },
          ticket_id: {
            type: 'number',
            description: 'Ticket ID number',
          },
        },
        required: ['project', 'ticket_id'],
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
        const result = await client.getProjects();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_tickets': {
        const project = args?.project as string;
        const query = args?.query as string | undefined;
        if (!project) throw new Error('project is required');

        const result = await client.getTickets(project, query);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_ticket': {
        const project = args?.project as string;
        const ticketId = args?.ticket_id as number;
        if (!project) throw new Error('project is required');
        if (!ticketId) throw new Error('ticket_id is required');

        const result = await client.getTicket(project, ticketId);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_ticket_notes': {
        const project = args?.project as string;
        const ticketId = args?.ticket_id as number;
        if (!project) throw new Error('project is required');
        if (!ticketId) throw new Error('ticket_id is required');

        const result = await client.getTicketNotes(project, ticketId);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
