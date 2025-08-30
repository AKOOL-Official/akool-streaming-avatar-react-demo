import {
  StreamingProvider,
  StreamProviderType,
  StreamingState,
  StreamingEventHandlers,
  CommandType,
  CommandPayload,
  Metadata,
  ChatResponsePayload,
} from '../types/streamingProvider';
import { log } from '../utils/messageUtils';

/**
 * Base class for streaming providers with shared functionality
 */
export abstract class BaseStreamingProvider implements StreamingProvider {
  public abstract readonly providerType: StreamProviderType;
  protected handlers?: StreamingEventHandlers;
  protected _state: StreamingState;

  constructor() {
    this._state = {
      isJoined: false,
      connected: false,
      remoteStats: null,
      participants: [],
      networkQuality: null,
    };
  }

  public get state(): StreamingState {
    return { ...this._state };
  }

  protected updateState(newState: Partial<StreamingState>) {
    this._state = { ...this._state, ...newState };
  }

  // Abstract methods that must be implemented by concrete providers
  public abstract connect(credentials: unknown, handlers?: StreamingEventHandlers): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract publishVideo(track: unknown): Promise<void>;
  public abstract unpublishVideo(): Promise<void>;
  public abstract subscribeToRemoteVideo(containerId: string): Promise<void>;
  public abstract unsubscribeFromRemoteVideo(): Promise<void>;
  public abstract sendMessage(messageId: string, content: string): Promise<void>;
  public abstract isConnected(): boolean;
  public abstract canSendMessages(): boolean;

  // Common implementations
  public isJoined(): boolean {
    return this._state.isJoined;
  }

  public async cleanup(): Promise<void> {
    await this.disconnect();
  }

  public async sendCommand(
    command: CommandPayload,
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void> {
    if (command.cmd === CommandType.SET_PARAMS && command.data) {
      await this.setAvatarParams(command.data, onCommandSend);
    } else if (command.cmd === CommandType.INTERRUPT) {
      await this.interruptResponse(onCommandSend);
    } else {
      throw new Error(`Unsupported command: ${command.cmd}`);
    }
  }

  public abstract setAvatarParams(
    meta: Metadata,
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void>;

  public abstract interruptResponse(
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void>;

  // Common message handling methods
  protected handleCommandResponse(
    cmd: CommandType,
    code: number,
    msg: string | undefined,
    messageId: string,
    uid: string,
  ) {
    log(`cmd-response, cmd=${cmd}, code=${code}, msg=${msg}`);

    const status = code === 1000 ? '✅' : '❌';
    const statusText = code === 1000 ? 'Success' : 'Failed';
    const responseText = `${status} ${cmd}: ${statusText}${msg ? ` (${msg})` : ''}`;
    const systemType = cmd === 'interrupt' ? 'interrupt_ack' : 'set_params_ack';

    this.handlers?.onSystemMessage?.(`cmd_ack_${messageId}`, responseText, systemType, { uid });
  }

  protected handleCommandSend(
    cmd: CommandType,
    data: Record<string, unknown> | undefined,
    messageId: string,
    uid: string,
  ) {
    const dataStr = data ? ` with data: ${JSON.stringify(data)}` : '';
    const systemType = cmd === 'interrupt' ? 'interrupt' : 'set_params';
    const messageText = cmd === 'set-params' && data ? `📤 ${cmd}${dataStr} ℹ️` : `📤 ${cmd}${dataStr}`;
    const metadata = cmd === 'set-params' && data ? { fullParams: data } : undefined;

    this.handlers?.onSystemMessage?.(`cmd_send_${messageId}`, messageText, systemType, { uid, ...metadata });
  }

  protected handleChatMessage(text: string, from: string | undefined, messageId: string, uid: string) {
    const responsePayload: ChatResponsePayload = {
      text,
      from: (from === 'bot' ? 'bot' : 'user') as 'bot' | 'user', // Preserve original from: 'bot' = avatar response, 'user' = STT result
    };

    // Ensure avatar responses get unique message IDs to avoid appending to user messages
    const finalMessageId = `reply_${messageId}`;

    this.handlers?.onStreamMessage?.(
      text,
      {
        uid,
        identity: uid.toString(),
      },
      responsePayload,
      finalMessageId,
    );
  }

  protected handleEventMessage(event: string, messageId: string, uid: string, eventData?: Record<string, unknown>) {
    log(`event, event=${event}`);

    if (event === 'audio_start') {
      this.handlers?.onSystemMessage?.(`event_${messageId}`, '🎤 Avatar started speaking', 'avatar_audio_start', {
        uid,
      });
      // Update speaking state
      this.handlers?.onAudioStateChange?.(true);
    } else if (event === 'audio_end') {
      this.handlers?.onSystemMessage?.(`event_${messageId}`, '✅ Avatar finished speaking', 'avatar_audio_end', {
        uid,
      });
      // Update speaking state
      this.handlers?.onAudioStateChange?.(false);
    } else {
      // Handle other events generically
      this.handlers?.onSystemMessage?.(`event_${messageId}`, `📋 Event: ${event}`, 'event', { uid, eventData });
    }
  }
}
