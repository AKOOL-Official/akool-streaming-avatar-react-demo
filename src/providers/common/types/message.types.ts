// Shared message interfaces used by all streaming providers

export interface StreamMessage {
  v: number;
  type: string;
  mid?: string;
  idx?: number;
  fin?: boolean;
  pld: CommandPayload | ChatPayload | CommandResponsePayload | ChatResponsePayload;
}

export interface CommandPayload {
  cmd: string;
  data?: Record<string, unknown>;
}

export interface ChatPayload {
  text: string;
  meta?: Record<string, unknown>;
}

export interface CommandResponsePayload {
  cmd: string;
  code: number;
  msg?: string;
}

export interface ChatResponsePayload {
  text: string;
  from: 'bot' | 'user';
}

// Provider configuration for message handling
export interface MessageProviderConfig {
  maxEncodedSize: number;
  bytesPerSecond: number;
}

// Callback interfaces for message handling
export interface MessageControllerCallbacks {
  // Event callbacks
  onParticipantJoined?: (participant: unknown) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: unknown) => void;
  onMessageReceived?: (message: unknown) => void;
  onError?: (error: Error) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;

  // Messaging callbacks
  onCommandSent?: (cmd: string, data?: Record<string, unknown>) => void;
  onCommandResponse?: (cmd: string, code: number, message?: string) => void;
  onMessageResponse?: (response: ChatResponsePayload) => void;
  onSystemMessage?: (event: unknown) => void;
  onChatMessage?: (event: unknown) => void;
  onCommand?: (event: unknown) => void;
}
