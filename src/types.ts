// CodebaseHQ API Types (JSON responses)

export interface ProjectWrapper {
  project: ProjectResponse;
}

export interface ProjectResponse {
  project_id: number;
  name: string;
  permalink: string;
  status: string;
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
}

export interface TicketWrapper {
  ticket: TicketResponse;
}

export interface TicketResponse {
  ticket_id: number;
  summary: string;
  ticket_type: string;
  reporter_id: number;
  reporter: string;
  assignee_id: number | null;
  assignee: string | null;
  category_id: number;
  category: { id: number; name: string };
  priority_id: number;
  priority: { id: number; name: string; colour: string };
  status_id: number;
  status: { id: number; name: string; colour: string; order: number; 'treat-as-closed': boolean };
  type_id: number;
  type: { id: number; name: string; icon: string };
  milestone_id: number | null;
  milestone: { id: number; name: string } | null;
  tags: string;
  start_on: string | null;
  deadline: string | null;
  estimated_time: number | null;
  total_time_spent: number;
  project_id: number;
  created_at: string;
  updated_at: string;
}

export interface TicketNoteWrapper {
  ticket_note: TicketNoteResponse;
}

export interface TicketNoteResponse {
  id: number;
  content: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  updates: string;
  company_id: number | null;
  attachments: TicketAttachment[];
}

export interface TicketAttachment {
  id: number;
  identifier: string;
  'file-name': string;
  'content-type': string;
  'file-size': number;
  url: string;
}

export interface ActivityEvent {
  id: number;
  title: string;
  type: string;
  timestamp: string;
  html_title: string;
  html_text: string;
  user_id: number;
  actor_email: string;
  actor_name: string;
  project_id: number;
  deleted: boolean;
}

export interface UserResponse {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email_address: string;
  company: string;
}
