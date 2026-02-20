// CodebaseHQ API Types

export interface CodebaseProject {
  name: string;
  permalink: string;
  status: string;
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
}

export interface CodebaseTicket {
  ticket_id: number;
  summary: string;
  status: { name: string };
  priority: { name: string };
  assignee?: { first_name: string; last_name: string };
  reporter: { first_name: string; last_name: string };
  category?: { name: string };
  milestone?: { name: string };
  created_at: string;
  updated_at: string;
}

export interface CodebaseRepository {
  name: string;
  permalink: string;
  scm: string;
  clone_url: string;
}

export interface CodebaseMilestone {
  id: number;
  name: string;
  status: string;
  estimated_completion_date?: string;
}

export interface CodebaseTicketNote {
  id: number;
  content: string;
  author: { first_name: string; last_name: string };
  created_at: string;
  updated_at: string;
  changes?: Record<string, string>;
}

export interface CodebaseTimeSession {
  id: number;
  summary: string;
  minutes: number;
  user: { first_name: string; last_name: string };
  session_date: string;
}

// Formatted responses for MCP tools

export interface FormattedProject {
  name: string;
  permalink: string;
  status: string;
  open_tickets: number;
  closed_tickets: number;
}

export interface FormattedTicket {
  ticket_id: number;
  summary: string;
  status: string;
  priority: string;
  assignee?: string;
  reporter: string;
  category?: string;
  milestone?: string;
  created_at: string;
  updated_at: string;
}

export interface FormattedRepository {
  name: string;
  permalink: string;
  scm: string;
  clone_url: string;
}
