// TRTC-specific credential types
export interface TRTCCredentials {
  trtc_app_id: number;
  trtc_room_id: string;
  trtc_user_id: string;
  trtc_user_sig: string;
}

// Type guard for TRTC credentials
export function isTRTCCredentials(credentials: unknown): credentials is TRTCCredentials {
  const creds = credentials as TRTCCredentials;
  return !!(creds?.trtc_app_id && creds?.trtc_room_id && creds?.trtc_user_id && creds?.trtc_user_sig);
}
