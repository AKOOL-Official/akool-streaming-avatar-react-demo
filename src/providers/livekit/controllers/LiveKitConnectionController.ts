import { Room, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { isLiveKitCredentials, LiveKitConnectionControllerCallbacks } from '../types';

export class LiveKitConnectionController {
  private room: Room;
  private isConnected = false;
  private callbacks: LiveKitConnectionControllerCallbacks = {};

  constructor(room: Room) {
    this.room = room;
  }

  setCallbacks(callbacks: LiveKitConnectionControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  async connect(credentials: unknown): Promise<void> {
    try {
      if (!isLiveKitCredentials(credentials)) {
        throw new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Invalid LiveKit credentials provided');
      }

      logger.info('Starting LiveKit connection', {
        livekit_url: credentials.livekit_url,
        livekit_room_name: credentials.livekit_room_name,
        livekit_client_identity: credentials.livekit_client_identity,
      });

      // Set up event listeners before connecting
      this.setupEventListeners();

      const { livekit_url, livekit_token, livekit_room_name } = credentials;

      // Connect to the LiveKit room
      await this.room.connect(livekit_url, livekit_token, {
        // Configure connection options
        autoSubscribe: true,
      });

      this.isConnected = true;

      logger.info('Successfully connected to LiveKit room', {
        roomName: livekit_room_name,
        state: this.room.state,
      });

      // Check for existing remote tracks as fallback
      setTimeout(() => {
        this.attachExistingRemoteTracks();
      }, 1000);

      this.callbacks.onConnectionStateChanged?.(this.room.state);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.CONNECTION_FAILED,
              `Failed to connect to LiveKit room: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to connect to LiveKit room', {
        error: streamingError.message,
        code: streamingError.code,
      });

      this.callbacks.onConnectionError?.(streamingError);
      throw streamingError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from LiveKit room');

      // Remove event listeners first
      this.removeEventListeners();

      // Disconnect from the room
      if (this.isConnected && this.room.state === 'connected') {
        await this.room.disconnect();
      }

      this.isConnected = false;

      logger.info('Successfully disconnected from LiveKit room');
      this.callbacks.onConnectionStateChanged?.(this.room.state);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.CONNECTION_FAILED,
              `Error during disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Error during disconnect', {
        error: streamingError.message,
        code: streamingError.code,
      });

      // Still mark as disconnected even if there was an error
      this.isConnected = false;
      this.callbacks.onConnectionError?.(streamingError);
    }
  }

  async sendMessage(content: string): Promise<void> {
    try {
      if (!this.isConnected || this.room.state !== 'connected') {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Not connected to LiveKit room - cannot send message');
      }

      // Send message as data
      const messageData = {
        type: 'chat',
        content,
        timestamp: Date.now(),
        from: 'user',
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(messageData));

      await this.room.localParticipant.publishData(data, { reliable: true });

      logger.debug('Message sent successfully', {
        content,
        messageType: 'chat',
      });
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.API_REQUEST_FAILED,
              `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to send message', {
        error: streamingError.message,
        content,
      });
      throw streamingError;
    }
  }

  async sendInterrupt(): Promise<void> {
    try {
      if (!this.isConnected || this.room.state !== 'connected') {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Not connected to LiveKit room - cannot send interrupt');
      }

      // Send interrupt command as data
      const interruptData = {
        type: 'interrupt',
        timestamp: Date.now(),
        from: 'user',
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(interruptData));

      await this.room.localParticipant.publishData(data, { reliable: true });

      logger.debug('Interrupt sent successfully');
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.API_REQUEST_FAILED,
              `Failed to send interrupt: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to send interrupt', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    try {
      if (!this.isConnected || this.room.state !== 'connected') {
        throw new StreamingError(
          ErrorCode.CONNECTION_FAILED,
          'Not connected to LiveKit room - cannot set avatar parameters',
        );
      }

      // Send avatar parameters as data
      const parameterData = {
        type: 'avatar_params',
        metadata,
        timestamp: Date.now(),
        from: 'user',
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(parameterData));

      await this.room.localParticipant.publishData(data, { reliable: true });

      logger.debug('Avatar parameters set successfully', {
        metadata,
      });
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.API_REQUEST_FAILED,
              `Failed to set avatar parameters: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to set avatar parameters', {
        error: streamingError.message,
        metadata,
      });
      throw streamingError;
    }
  }

  private setupEventListeners(): void {
    // Room state changes
    this.room.on('disconnected', (reason) => {
      logger.info('LiveKit room disconnected', {
        reason,
      });

      this.isConnected = false;
      this.callbacks.onConnectionStateChanged?.(this.room.state);
    });

    // Connection quality changes
    this.room.on('connectionQualityChanged', (quality, participant) => {
      logger.debug('LiveKit connection quality changed', {
        quality,
        participant: participant?.identity,
      });
    });

    // Additional disconnected event handling (if needed)
    // Note: Already handled above in the main disconnected event

    // Reconnecting/reconnected events
    this.room.on('reconnecting', () => {
      logger.info('LiveKit room reconnecting');
      this.callbacks.onConnectionStateChanged?.(this.room.state);
    });

    this.room.on('reconnected', () => {
      logger.info('LiveKit room reconnected');
      this.isConnected = true;
      this.callbacks.onConnectionStateChanged?.(this.room.state);
    });
  }

  private removeEventListeners(): void {
    this.room.removeAllListeners('connectionQualityChanged');
    this.room.removeAllListeners('disconnected');
    this.room.removeAllListeners('reconnecting');
    this.room.removeAllListeners('reconnected');
  }

  // Getters
  get connected(): boolean {
    return this.isConnected && this.room.state === 'connected';
  }

  get connectionState(): string {
    return this.room.state;
  }

  get roomName(): string | undefined {
    return this.room.name;
  }

  get localParticipantIdentity(): string | undefined {
    return this.room.localParticipant?.identity;
  }

  // Check if room is ready for messages
  isReadyForMessages(): boolean {
    return this.connected && this.room.localParticipant !== undefined;
  }

  // Attach existing remote tracks (video and audio)
  private attachExistingRemoteTracks(): void {
    this.room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.kind === 'video' && publication.track instanceof RemoteVideoTrack) {
          const remoteVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
          if (remoteVideoElement) {
            try {
              publication.track.attach(remoteVideoElement);
              remoteVideoElement.play().catch(() => {
                // Autoplay might fail in some browsers, this is normal
              });
              logger.info('Attached existing remote video track');
            } catch (error) {
              logger.error('Failed to attach existing remote video track', { error });
            }
          }
        } else if (publication.kind === 'audio' && publication.track instanceof RemoteAudioTrack) {
          try {
            // For audio tracks, we need to attach to an audio element
            const audioElement = document.createElement('audio');
            audioElement.autoplay = true;
            audioElement.volume = 1.0;
            document.body.appendChild(audioElement);

            publication.track.attach(audioElement);
            logger.info('Started playing existing remote audio track', {
              trackSid: publication.trackSid,
              participant: participant.identity,
            });
          } catch (error) {
            logger.error('Failed to play existing remote audio track', { error });
          }
        }
      });
    });
  }

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    await this.disconnect();
    this.callbacks = {};
  }
}
