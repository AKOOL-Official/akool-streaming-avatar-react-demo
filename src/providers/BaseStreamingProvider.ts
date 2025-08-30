import {
  StreamingProvider,
  StreamProviderType,
  StreamingState,
  StreamingEventHandlers,
  CommandType,
  CommandPayload,
  Metadata,
} from '../types/streamingProvider';
import { formatCommandResponse, formatCommandSend, formatChatMessage, formatEventMessage } from '../utils/messageUtils';

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

  // Common message handling methods using shared utilities
  protected handleCommandResponse(
    cmd: CommandType,
    code: number,
    msg: string | undefined,
    messageId: string,
    uid: string,
  ) {
    if (!this.handlers) return;
    formatCommandResponse(cmd, code, msg, messageId, uid, this.handlers);
  }

  protected handleCommandSend(
    cmd: CommandType,
    data: Record<string, unknown> | undefined,
    messageId: string,
    uid: string,
  ) {
    if (!this.handlers) return;
    formatCommandSend(cmd, data, messageId, uid, this.handlers);
  }

  protected handleChatMessage(text: string, from: string | undefined, messageId: string, uid: string) {
    if (!this.handlers) return;
    formatChatMessage(text, from, messageId, uid, this.handlers);
  }

  protected handleEventMessage(event: string, messageId: string, uid: string, eventData?: Record<string, unknown>) {
    if (!this.handlers) return;
    formatEventMessage(event, messageId, uid, eventData, this.handlers);
  }
}
