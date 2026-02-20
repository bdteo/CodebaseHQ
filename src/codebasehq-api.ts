import { XMLParser } from 'fast-xml-parser';

export class CodebaseHQClient {
  private readonly baseUrl = 'https://api3.codebasehq.com';
  private readonly authHeader: string;
  private readonly parser: XMLParser;

  constructor(account: string, username: string, apiKey: string) {
    const credentials = Buffer.from(`${account}/${username}:${apiKey}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
  }

  private async request<T>(endpoint: string, method: string = 'GET', body?: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'Accept': 'application/xml',
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CodebaseHQ API error (${response.status}): ${errorText}`);
    }

    const xml = await response.text();
    return this.parser.parse(xml) as T;
  }

  async getProjects(): Promise<unknown> {
    return this.request('/projects');
  }

  async getProject(permalink: string): Promise<unknown> {
    return this.request(`/${permalink}`);
  }

  async getTickets(projectPermalink: string, query?: string): Promise<unknown> {
    const q = query ? `?query=${encodeURIComponent(query)}` : '';
    return this.request(`/${projectPermalink}/tickets${q}`);
  }

  async getTicket(projectPermalink: string, ticketId: number): Promise<unknown> {
    return this.request(`/${projectPermalink}/tickets/${ticketId}`);
  }

  async getTicketNotes(projectPermalink: string, ticketId: number): Promise<unknown> {
    return this.request(`/${projectPermalink}/tickets/${ticketId}/notes`);
  }

  async getRepositories(projectPermalink: string): Promise<unknown> {
    return this.request(`/${projectPermalink}/repositories`);
  }

  async getMilestones(projectPermalink: string): Promise<unknown> {
    return this.request(`/${projectPermalink}/milestones`);
  }

  async getTimeSessions(projectPermalink: string): Promise<unknown> {
    return this.request(`/${projectPermalink}/time_sessions`);
  }

  async getActivityFeed(): Promise<unknown> {
    return this.request('/activity');
  }
}
