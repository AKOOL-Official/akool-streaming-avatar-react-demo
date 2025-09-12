// LiveKit-specific credential types
export interface LivekitCredentials {
  livekit_url: string;
  livekit_token: string;
  livekit_room_name: string;
  livekit_server_identity?: string;
  livekit_client_identity?: string;
}

// Type guard for LiveKit credentials
export function isLivekitCredentials(credentials: unknown): credentials is LivekitCredentials {
  const creds = credentials as LivekitCredentials;
  return !!(creds?.livekit_url && creds?.livekit_token && creds?.livekit_room_name);
}
