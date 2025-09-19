// Import types for use in implementation
import type {
  Voice,
  EnhancedVoice,
  VoiceGroup,
  Language,
  Avatar,
  Knowledge,
  SessionOptions,
  Session,
} from './types/api.schemas';

// Re-export types from api.schemas.ts to maintain backward compatibility
export type {
  ApiResponse,
  Voice,
  EnhancedVoice,
  VoiceGroup,
  Language,
  Avatar,
  Knowledge,
  SessionOptions,
  Session,
} from './types/api.schemas';

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

    // Use a type-safe JSON parser
    const responseText = await response.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Invalid JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate response structure
    if (typeof responseData !== 'object' || responseData === null) {
      throw new Error('Invalid API response: not an object');
    }

    const obj = responseData as Record<string, unknown>;

    if (typeof obj.code !== 'number') {
      throw new Error('Invalid API response: missing or invalid code');
    }

    if (typeof obj.msg !== 'string') {
      throw new Error('Invalid API response: missing or invalid msg');
    }

    if (!('data' in obj)) {
      throw new Error('Invalid API response: missing data');
    }

    // Create a properly typed response object
    const code = obj.code as number;
    const msg = obj.msg as string;
    const data = obj.data;

    if (code != 1000) {
      if (this.notificationCallback) {
        this.notificationCallback(msg, 'API Error');
      }
      throw new Error(msg);
    }
    return data as T;
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

  /**
   * Get voice list
   * @param type - Voice type, 1 for VoiceClone, 2 for Akool Voices
   * @returns Voice list
   */
  public async getVoiceList(type: number = 2): Promise<Voice[]> {
    const data = await this.fetchApi<{ result: Voice[] }>(
      `/api/open/v4/voice/list?support_stream=1&type=${type}`,
      'GET',
    );
    return data?.result ?? [];
  }

  /**
   * Get all voices (both types) with enhanced information
   * @returns Enhanced voice list grouped by type
   */
  public async getAllVoices(): Promise<VoiceGroup[]> {
    try {
      // Fetch both voice types in parallel
      const [voiceCloneVoices, akoolVoices] = await Promise.all([this.getVoiceList(1), this.getVoiceList(2)]);

      // Transform to enhanced voices with type information
      const enhancedVoiceClone: EnhancedVoice[] = voiceCloneVoices.map((voice) => ({
        ...voice,
        type: 1 as const,
      }));

      const enhancedAkoolVoices: EnhancedVoice[] = akoolVoices.map((voice) => ({
        ...voice,
        type: 2 as const,
      }));

      // Group voices by type
      const voiceGroups: VoiceGroup[] = [
        {
          type: 1,
          label: 'VoiceClone (Custom Voices)',
          voices: enhancedVoiceClone,
        },
        {
          type: 2,
          label: 'Akool Voices (Pre-built)',
          voices: enhancedAkoolVoices,
        },
      ];

      return voiceGroups;
    } catch (error) {
      if (this.notificationCallback) {
        this.notificationCallback('Failed to load voice list', 'Error');
      }
      throw error;
    }
  }

  public async getAvatarList(): Promise<Avatar[]> {
    const data = await this.fetchApi<{ result: Avatar[] }>(
      `/api/open/v4/liveAvatar/avatar/list?page=1&size=100`,
      'GET',
    );
    return data?.result ?? [];
  }
}
