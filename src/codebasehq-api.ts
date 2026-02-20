import type {
  ProjectWrapper,
  TicketWrapper,
  TicketNoteWrapper,
  TicketResponse,
  ActivityEvent,
  UserResponse,
} from './types.js';

export class CodebaseHQClient {
  private readonly baseUrl = 'https://api3.codebasehq.com';
  private readonly authHeader: string;

  constructor(account: string, username: string, apiKey: string) {
    const credentials = Buffer.from(`${account}/${username}:${apiKey}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(endpoint: string, method: string = 'GET', body?: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'Accept': 'application/json',
      'Content-type': 'application/xml',
    };

    const response = await fetch(url, { method, headers, body });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
      console.error(`Rate limited. Retrying after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.request<T>(endpoint, method, body);
    }

    if (response.status === 404) {
      return [] as T;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CodebaseHQ API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  // === READ ===

  async getProjects(): Promise<ProjectWrapper[]> {
    return this.request<ProjectWrapper[]>('/projects');
  }

  async getTickets(project: string, query?: string, page: number = 1): Promise<TicketWrapper[]> {
    let endpoint = `/${project}/tickets?page=${page}`;
    if (query) endpoint += `&query=${encodeURIComponent(query)}`;
    return this.request<TicketWrapper[]>(endpoint);
  }

  async getTicket(project: string, ticketId: number): Promise<TicketResponse> {
    const result = await this.request<{ ticket: TicketResponse }>(`/${project}/tickets/${ticketId}`);
    return result.ticket;
  }

  async getTicketNotes(project: string, ticketId: number): Promise<TicketNoteWrapper[]> {
    return this.request<TicketNoteWrapper[]>(`/${project}/tickets/${ticketId}/notes`);
  }

  async getActivity(project: string, page: number = 1): Promise<ActivityEvent[]> {
    return this.request<ActivityEvent[]>(`/${project}/activity?page=${page}`);
  }

  async getProjectUsers(project: string): Promise<UserResponse[]> {
    const result = await this.request<{ user: UserResponse }[]>(`/${project}/assignments`);
    return result.map(u => u.user ?? u as unknown as UserResponse);
  }

  // === WRITE ===

  async createTicket(project: string, opts: {
    summary: string;
    description?: string;
    ticketType?: string;
    priorityId?: number;
    categoryId?: number;
    assigneeId?: number;
    milestoneId?: number;
  }): Promise<TicketResponse> {
    const parts = [`<summary>${escapeXml(opts.summary)}</summary>`];
    if (opts.description) parts.push(`<description><![CDATA[${opts.description}]]></description>`);
    if (opts.ticketType) parts.push(`<ticket-type>${escapeXml(opts.ticketType)}</ticket-type>`);
    if (opts.priorityId) parts.push(`<priority-id>${opts.priorityId}</priority-id>`);
    if (opts.categoryId) parts.push(`<category-id>${opts.categoryId}</category-id>`);
    if (opts.assigneeId) parts.push(`<assignee-id>${opts.assigneeId}</assignee-id>`);
    if (opts.milestoneId) parts.push(`<milestone-id>${opts.milestoneId}</milestone-id>`);

    const xml = `<ticket>${parts.join('')}</ticket>`;
    const result = await this.request<{ ticket: TicketResponse }>(`/${project}/tickets`, 'POST', xml);
    return result.ticket;
  }

  async updateTicket(project: string, ticketId: number, opts: {
    content?: string;
    statusId?: number;
    priorityId?: number;
    categoryId?: number;
    assigneeId?: number | null;
    milestoneId?: number | null;
    subject?: string;
    isPrivate?: boolean;
  }): Promise<unknown> {
    const parts: string[] = [];
    if (opts.content) parts.push(`<content><![CDATA[${opts.content}]]></content>`);

    const changes: string[] = [];
    if (opts.statusId !== undefined) changes.push(`<status-id>${opts.statusId}</status-id>`);
    if (opts.priorityId !== undefined) changes.push(`<priority-id>${opts.priorityId}</priority-id>`);
    if (opts.categoryId !== undefined) changes.push(`<category-id>${opts.categoryId}</category-id>`);
    if (opts.assigneeId !== undefined) changes.push(`<assignee-id>${opts.assigneeId ?? ''}</assignee-id>`);
    if (opts.milestoneId !== undefined) changes.push(`<milestone-id>${opts.milestoneId ?? ''}</milestone-id>`);
    if (opts.subject) changes.push(`<subject>${escapeXml(opts.subject)}</subject>`);

    if (changes.length > 0) parts.push(`<changes>${changes.join('')}</changes>`);
    if (opts.isPrivate) parts.push(`<private>1</private>`);

    const xml = `<ticket-note>${parts.join('')}</ticket-note>`;
    return this.request(`/${project}/tickets/${ticketId}/notes`, 'POST', xml);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
