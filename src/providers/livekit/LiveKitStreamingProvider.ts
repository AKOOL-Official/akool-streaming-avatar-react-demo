import { Room } from 'livekit-client';
import { BaseStreamingProvider } from '../BaseStreamingProvider';
import { StreamingCredentials, StreamingEventHandlers } from '../../types/provider.interfaces';
import { StreamProviderType, VideoTrack, AudioTrack, VideoConfig, AudioConfig } from '../../types/streaming.types';
import { logger } from '../../core/Logger';
import { StreamingError, ErrorCode } from '../../types/error.types';

import { LiveKitAudioController } from './controllers/LiveKitAudioController';
import { LiveKitVideoController } from './controllers/LiveKitVideoController';
import { LiveKitConnectionController } from './controllers/LiveKitConnectionController';
import { LiveKitEventHandler } from './controllers/LiveKitEventHandler';
import { isLiveKitCredentials } from './types';

export class LiveKitStreamingProvider extends BaseStreamingProvider {
  public readonly providerType: StreamProviderType = 'livekit';

  private audioController: LiveKitAudioController;
  private videoController: LiveKitVideoController;
  private connectionController: LiveKitConnectionController;
  private eventHandler: LiveKitEventHandler;

  constructor(private room: Room) {
    super();

    // Initialize controllers following established pattern
    this.audioController = new LiveKitAudioController(this.room);
    this.videoController = new LiveKitVideoController(this.room);
    this.connectionController = new LiveKitConnectionController(this.room);
    this.eventHandler = new LiveKitEventHandler(this.room, this.eventBus);

    this.setupRoomEventHandlers();
  }

  async connect(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): Promise<void> {
    try {
      logger.info('Starting LiveKit connection', { credentials });

      if (!isLiveKitCredentials(credentials)) {
        throw new StreamingError(ErrorCode.PROVIDER_INITIALIZATION_FAILED, 'Invalid LiveKit credentials provided');
      }

      this.updateState({ isConnecting: true, error: null });

      // Register event handlers
      if (handlers) {
        this.registerEventHandlers(handlers);
      }

      // Delegate connection to controller
      await this.connectionController.connect(credentials);

      this.updateState({
        isJoined: true,
        isConnecting: false,
      });

      logger.info('LiveKit connection successful');
    } catch (error) {
      logger.error('LiveKit connection failed', { error });
      this.updateState({
        isConnecting: false,
        error:
          error instanceof StreamingError
            ? error
            : new StreamingError(
                ErrorCode.CONNECTION_FAILED,
                error instanceof Error ? error.message : 'Connection failed',
              ),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from LiveKit');

      await this.connectionController.disconnect();

      this.updateState({
        isJoined: false,
        isConnecting: false,
        participants: [],
        localParticipant: null,
        error: null,
      });

      logger.info('LiveKit disconnection successful');
    } catch (error) {
      logger.error('LiveKit disconnection failed', { error });
      throw error instanceof Error ? error : new Error('Disconnection failed');
    }
  }

  // Video management - delegate to controllers
  async enableVideo(config?: VideoConfig): Promise<VideoTrack> {
    return this.videoController.enableVideo(config);
  }

  async disableVideo(): Promise<void> {
    return this.videoController.disableVideo();
  }

  async playVideo(elementId: string): Promise<void> {
    return this.videoController.playVideo(elementId);
  }

  async stopVideo(): Promise<void> {
    return this.videoController.stopVideo();
  }

  async publishVideo(track: VideoTrack): Promise<void> {
    return this.videoController.publishVideo(track);
  }

  async unpublishVideo(): Promise<void> {
    return this.videoController.unpublishVideo();
  }

  // Audio management - delegate to controllers
  async enableAudio(config?: AudioConfig): Promise<AudioTrack> {
    return this.audioController.enableAudio(config);
  }

  async disableAudio(): Promise<void> {
    return this.audioController.disableAudio();
  }

  async publishAudio(track: AudioTrack): Promise<void> {
    return this.audioController.publishAudio(track);
  }

  async unpublishAudio(): Promise<void> {
    return this.audioController.unpublishAudio();
  }

  // Audio enhancement features
  async enableNoiseReduction(): Promise<void> {
    return this.audioController.enableNoiseReduction();
  }

  async disableNoiseReduction(): Promise<void> {
    return this.audioController.disableNoiseReduction();
  }

  async dumpAudio(): Promise<void> {
    return this.audioController.dumpAudio();
  }

  // Communication - delegate to controllers
  async sendMessage(content: string): Promise<void> {
    return this.connectionController.sendMessage(content);
  }

  async sendInterrupt(): Promise<void> {
    return this.connectionController.sendInterrupt();
  }

  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    return this.connectionController.setAvatarParameters(metadata);
  }

  private setupRoomEventHandlers(): void {
    // Delegate event handling to the event handler controller
    this.eventHandler.setupEventHandlers();
  }
}
