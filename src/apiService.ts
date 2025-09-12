// Import types for use in implementation
import type { Voice, Language, Avatar, Knowledge, SessionOptions, Session } from './types/api.schemas';

// Re-export types from api.schemas.ts to maintain backward compatibility
export type { ApiResponse, Voice, Language, Avatar, Knowledge, SessionOptions, Session } from './types/api.schemas';

export class ApiService {
  private openapiHost: string;
  private openapiToken: string;
  private notificationCallback?: (message: string, title?: string) => void;

  constructor(openapiHost: string, openapiToken: string) {
    this.openapiHost = openapiHost;
    this.openapiToken = openapiToken;
  }

  setNotificationCallback(callback: (message: string, title?: string) => void): void {
    this.notificationCallback = callback;
  }

  private async fetchApi<T>(endpoint: string, method: string, body?: object): Promise<T> {
    const response = await fetch(`${this.openapiHost}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.openapiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const responseBody = await response.json();
    if (responseBody.code != 1000) {
      if (this.notificationCallback) {
        this.notificationCallback(responseBody.msg, 'API Error');
      }
      throw new Error(responseBody.msg);
    }
    return responseBody.data;
  }

  public async createSession(data: SessionOptions): Promise<Session> {
    return this.fetchApi<Session>('/api/open/v4/liveAvatar/session/create', 'POST', data);
  }

  public async closeSession(id: string): Promise<void> {
    return this.fetchApi<void>('/api/open/v4/liveAvatar/session/close', 'POST', {
      id,
    });
  }

  public async getLangList(): Promise<Language[]> {
    const data = await this.fetchApi<{ lang_list: Language[] }>('/api/open/v3/language/list', 'GET');
    return data?.lang_list ?? [];
  }

  public async getKnowledgeList(): Promise<Knowledge[]> {
    const data = await this.fetchApi<{ knowledge_list: Knowledge[] }>('/api/open/v4/knowledge/list', 'GET');
    return data?.knowledge_list ?? [];
  }

  public async getVoiceList(): Promise<Voice[]> {
    const data = await this.fetchApi<Voice[]>('/api/open/v3/voice/list?from=3', 'GET');
    return data ?? [];
  }

  public async getAvatarList(): Promise<Avatar[]> {
    const data = await this.fetchApi<{ result: Avatar[] }>(
      `/api/open/v4/liveAvatar/avatar/list?page=1&size=100`,
      'GET',
    );
    return data?.result ?? [];
  }
}
