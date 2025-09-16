import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../types/provider.interfaces';
import { ChatMessage } from '../../types/streaming.types';

// System message event fixtures
export const avatarAudioStartEvent: SystemMessageEvent = {
  messageId: 'sys-msg-001',
  text: 'Avatar audio started',
  eventType: 'avatar_audio_start',
  metadata: {
    duration: 0,
    timestamp: Date.now(),
  },
};

export const avatarAudioEndEvent: SystemMessageEvent = {
  messageId: 'sys-msg-002',
  text: 'Avatar audio ended',
  eventType: 'avatar_audio_end',
  metadata: {
    duration: 5000,
    timestamp: Date.now(),
  },
};

export const setParamsEvent: SystemMessageEvent = {
  messageId: 'sys-msg-003',
  text: 'Avatar parameters set',
  eventType: 'set_params',
  metadata: {
    avatarId: 'avatar-001',
    voice: 'en-US-standard-A',
    personality: 'friendly',
    timestamp: Date.now(),
  },
};

export const setParamsAckEvent: SystemMessageEvent = {
  messageId: 'sys-msg-004',
  text: 'Avatar parameters acknowledged',
  eventType: 'set_params_ack',
  metadata: {
    success: true,
    timestamp: Date.now(),
  },
};

export const interruptEvent: SystemMessageEvent = {
  messageId: 'sys-msg-005',
  text: 'Avatar interrupted',
  eventType: 'interrupt',
  metadata: {
    reason: 'user_request',
    timestamp: Date.now(),
  },
};

export const interruptAckEvent: SystemMessageEvent = {
  messageId: 'sys-msg-006',
  text: 'Avatar interrupt acknowledged',
  eventType: 'interrupt_ack',
  metadata: {
    success: true,
    timestamp: Date.now(),
  },
};

// Chat message event fixtures
export const userChatEvent: ChatMessageEvent = {
  messageId: 'chat-msg-001',
  text: 'Hello, how are you today?',
  from: 'user',
};

export const avatarChatEvent: ChatMessageEvent = {
  messageId: 'chat-msg-002',
  text: 'Hello! I am doing well, thank you for asking. How can I help you today?',
  from: 'avatar',
};

export const longUserChatEvent: ChatMessageEvent = {
  messageId: 'chat-msg-003',
  text: 'This is a very long message that contains multiple sentences and should test how the system handles lengthy user input. It includes various topics and questions that the avatar should be able to process and respond to appropriately.',
  from: 'user',
};

export const emptyUserChatEvent: ChatMessageEvent = {
  messageId: 'chat-msg-004',
  text: '',
  from: 'user',
};

export const specialCharsChatEvent: ChatMessageEvent = {
  messageId: 'chat-msg-005',
  text: 'Hello! 🎉 Can you help me with special characters? éñü @#$%^&*()',
  from: 'user',
};

export const unicodeChatEvent: ChatMessageEvent = {
  messageId: 'chat-msg-006',
  text: '你好！こんにちは！안녕하세요！مرحبا！',
  from: 'user',
};

// Command event fixtures
export const successfulCommandEvent: CommandEvent = {
  command: 'start_session',
  data: {
    sessionId: 'session-001',
    userId: 'user-123',
  },
  success: true,
  message: 'Session started successfully',
};

export const failedCommandEvent: CommandEvent = {
  command: 'start_session',
  data: {
    sessionId: 'session-002',
    userId: 'user-456',
  },
  success: false,
  message: 'Failed to start session: Invalid credentials',
};

export const setAvatarCommandEvent: CommandEvent = {
  command: 'set_avatar',
  data: {
    avatarId: 'avatar-001',
    voice: 'en-US-standard-A',
    personality: 'professional',
  },
  success: true,
  message: 'Avatar configuration updated',
};

export const sendMessageCommandEvent: CommandEvent = {
  command: 'send_message',
  data: {
    messageId: 'msg-001',
    content: 'Test message content',
    metadata: {
      timestamp: Date.now(),
      messageType: 'text',
    },
  },
  success: true,
  message: 'Message sent successfully',
};

export const interruptCommandEvent: CommandEvent = {
  command: 'interrupt',
  data: {
    reason: 'user_request',
    timestamp: Date.now(),
  },
  success: true,
  message: 'Avatar interrupted successfully',
};

export const errorCommandEvent: CommandEvent = {
  command: 'unknown_command',
  data: {},
  success: false,
  message: 'Unknown command type',
};

// Factory functions for creating test events
export const createSystemMessageEvent = (
  eventType: SystemMessageEvent['eventType'],
  overrides: Partial<SystemMessageEvent> = {},
): SystemMessageEvent => ({
  messageId: `sys-msg-${Math.random().toString(36).substr(2, 9)}`,
  text: `System message: ${eventType}`,
  eventType,
  metadata: {
    timestamp: Date.now(),
  },
  ...overrides,
});

export const createChatMessageEvent = (
  from: 'user' | 'avatar',
  text: string,
  overrides: Partial<ChatMessageEvent> = {},
): ChatMessageEvent => ({
  messageId: `chat-msg-${Math.random().toString(36).substr(2, 9)}`,
  text,
  from,
  ...overrides,
});

export const createCommandEvent = (
  command: string,
  success: boolean = true,
  overrides: Partial<CommandEvent> = {},
): CommandEvent => ({
  command,
  data: {},
  success,
  message: success ? `${command} completed successfully` : `${command} failed`,
  ...overrides,
});

// Chat message conversion helpers
export const chatEventToChatMessage = (event: ChatMessageEvent): ChatMessage => ({
  id: event.messageId,
  content: event.text,
  timestamp: Date.now(),
  fromParticipant: event.from === 'user' ? 'user' : 'avatar',
  type: 'text',
});

export const systemEventToChatMessage = (event: SystemMessageEvent): ChatMessage => ({
  id: event.messageId,
  content: event.text,
  timestamp: (event.metadata?.timestamp as number) || Date.now(),
  fromParticipant: 'system',
  type: 'system',
});

// Event sequences for testing workflows
export const avatarConversationSequence = [
  createChatMessageEvent('user', 'Hello, can you help me?'),
  createSystemMessageEvent('avatar_audio_start'),
  createChatMessageEvent('avatar', 'Hello! I would be happy to help you. What do you need assistance with?'),
  createSystemMessageEvent('avatar_audio_end'),
  createChatMessageEvent('user', 'I have a question about your capabilities'),
  createSystemMessageEvent('avatar_audio_start'),
  createChatMessageEvent('avatar', 'I can help you with a wide range of topics. Feel free to ask me anything!'),
  createSystemMessageEvent('avatar_audio_end'),
];

export const avatarInterruptSequence = [
  createChatMessageEvent('user', 'Let me ask you a very long question that might take a while to answer...'),
  createSystemMessageEvent('avatar_audio_start'),
  createChatMessageEvent(
    'avatar',
    'I understand you have a detailed question. Let me provide you with a comprehensive answer that covers...',
  ),
  createSystemMessageEvent('interrupt', {
    metadata: { reason: 'user_request' },
  }),
  createSystemMessageEvent('interrupt_ack', {
    metadata: { success: true },
  }),
  createSystemMessageEvent('avatar_audio_end'),
  createChatMessageEvent('user', 'Actually, let me ask something simpler'),
];

export const avatarParameterUpdateSequence = [
  createCommandEvent('set_avatar', true, {
    data: {
      avatarId: 'avatar-002',
      voice: 'en-US-neural-B',
      personality: 'casual',
    },
  }),
  createSystemMessageEvent('set_params', {
    metadata: {
      avatarId: 'avatar-002',
      voice: 'en-US-neural-B',
      personality: 'casual',
    },
  }),
  createSystemMessageEvent('set_params_ack', {
    metadata: { success: true },
  }),
];

export const errorHandlingSequence = [
  createCommandEvent('start_session', false, {
    message: 'Network connection failed',
  }),
  createCommandEvent('retry_connection', true),
  createCommandEvent('start_session', true),
];

// Mock event generators for stress testing
export const generateChatEventStream = (count: number, userToAvatarRatio: number = 0.5): ChatMessageEvent[] => {
  const events: ChatMessageEvent[] = [];

  for (let i = 0; i < count; i++) {
    const isUserMessage = Math.random() < userToAvatarRatio;
    const from = isUserMessage ? 'user' : 'avatar';
    const text = isUserMessage
      ? `User message ${i + 1}: This is a test message from the user.`
      : `Avatar response ${i + 1}: Thank you for your message. I understand and here is my response.`;

    events.push(createChatMessageEvent(from, text));
  }

  return events;
};

export const generateSystemEventStream = (count: number): SystemMessageEvent[] => {
  const eventTypes: SystemMessageEvent['eventType'][] = [
    'avatar_audio_start',
    'avatar_audio_end',
    'set_params',
    'set_params_ack',
    'interrupt',
    'interrupt_ack',
  ];

  const events: SystemMessageEvent[] = [];

  for (let i = 0; i < count; i++) {
    const eventType = eventTypes[i % eventTypes.length];
    if (eventType) {
      events.push(createSystemMessageEvent(eventType));
    }
  }

  return events;
};

// Event validation helpers
export const isValidSystemMessageEvent = (event: SystemMessageEvent): boolean => {
  return !!(
    event.messageId &&
    event.text &&
    event.eventType &&
    ['avatar_audio_start', 'avatar_audio_end', 'set_params', 'set_params_ack', 'interrupt', 'interrupt_ack'].includes(
      event.eventType,
    )
  );
};

export const isValidChatMessageEvent = (event: ChatMessageEvent): boolean => {
  return !!(event.messageId && event.text !== undefined && event.from && ['user', 'avatar'].includes(event.from));
};

export const isValidCommandEvent = (event: CommandEvent): boolean => {
  return !!(event.command && typeof event.success === 'boolean');
};
