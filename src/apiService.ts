export type AgoraCredentials = {
  agora_uid: number;
  agora_app_id: string;
  agora_channel: string;
  agora_token: string;
};

export type LivekitCredentials = {
  livekit_url: string;
  livekit_room_name: string;
  livekit_token: string;
  livekit_server_identity: string;
  livekit_livekit_identity: string;
};

export type TRTCCredentials = {
  trtc_app_id: string;
  trtc_room_id: string;
  trtc_user_id: string;
  trtc_user_sig: string;
};

export type Credentials = AgoraCredentials | LivekitCredentials | TRTCCredentials;

export type Session = {
  _id: string;
  // @deprecated, use credentials instead
  stream_urls?: Credentials;
  credentials: Credentials;
};

export type ApiResponse<T> = {
  code: number;
  msg: string;
  data: T;
};

export type Voice = {
  accent: string;
  description: string;
  language: string;
  preview: string;
  voice_id: string;
  name: string;
};

export type Language = {
  lang_code: string;
  lang_name: string;
  url: string;
};

export type Avatar = {
  name: string;
  from: number;
  gender: string;
  url: string;
  avatar_id: string;
  voice_id: string;
  thumbnailUrl: string;
  available: boolean;
};

export type Knowledge = {
  _id: string;
  name: string;
};

export type SessionOptions = {
  stream_type: 'agora' | 'livekit' | 'trtc';
  avatar_id: string;
  duration: number;
  knowledge_id?: string;
  voice_id?: string;
  voice_url?: string;
  language?: string;
  mode_type?: number;
  background_url?: string;
  voice_params?: Record<string, unknown>;
};

export class ApiService {
  private openapiHost: string;
  private openapiToken: string;

  constructor(openapiHost: string, openapiToken: string) {
    this.openapiHost = openapiHost;
    this.openapiToken = openapiToken;
  }

  private async fetchApi(endpoint: string, method: string, body?: object) {
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
      alert(responseBody.msg);
      throw new Error(responseBody.msg);
    }
    return responseBody.data;
  }

  public async createSession(data: SessionOptions): Promise<Session> {
    return this.fetchApi('/api/open/v4/liveAvatar/session/create', 'POST', data);
  }

  public async closeSession(id: string) {
    return this.fetchApi('/api/open/v4/liveAvatar/session/close', 'POST', {
      id,
    });
  }

  public async getLangList(): Promise<Language[]> {
    const data = await this.fetchApi('/api/open/v3/language/list', 'GET');
    return data?.lang_list;
  }

  public async getKnowledgeList(): Promise<Knowledge[]> {
    const data = await this.fetchApi('/api/open/v4/knowledge/list', 'GET');
    return data?.knowledge_list;
  }

  public async getVoiceList(): Promise<Voice[]> {
    return this.fetchApi('/api/open/v3/voice/list?from=3', 'GET');
  }

  public async getAvatarList(): Promise<Avatar[]> {
    const data = await this.fetchApi(`/api/open/v4/liveAvatar/avatar/list?page=1&size=100`, 'GET');
    return data?.result;
  }
}
