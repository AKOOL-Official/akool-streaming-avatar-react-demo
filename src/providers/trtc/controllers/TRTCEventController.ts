import { logger } from '../../../core/Logger';
import { Participant } from '../../../types/streaming.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { TRTCEventControllerCallbacks } from '../types';
import { TRTCParticipantController } from './TRTCParticipantController';
import { TRTCVideoController } from './TRTCVideoController';
import TRTC from 'trtc-sdk-v5';

export class TRTCEventController {
  private client: TRTC;
  private participantController: TRTCParticipantController;
  private videoController?: TRTCVideoController; // Will be set after construction
  private callbacks: TRTCEventControllerCallbacks = {};
  private eventHandlers: Map<string, (...args: unknown[]) => void> = new Map();

  constructor(client: TRTC, participantController: TRTCParticipantController) {
    this.client = client;
    this.participantController = participantController;
    this.setupEventHandlers();
  }

  setVideoController(videoController: TRTCVideoController): void {
    this.videoController = videoController;
  }

  setCallbacks(callbacks: TRTCEventControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  private startRemoteVideoPlayback(userId: string): void {
    try {
      const remoteVideoElement = document.getElementById('remote-video') as HTMLElement;
      if (remoteVideoElement && this.videoController) {
        logger.info('Starting remote video playback for user', { userId });
        this.videoController.playRemoteVideo(userId, remoteVideoElement).catch((error: unknown) => {
          logger.error('Failed to start remote video playback', { error, userId });
        });
      } else if (!remoteVideoElement) {
        logger.warn('Remote video element not found, cannot start remote video playback', { userId });
      } else {
        logger.warn('Video controller not available, cannot start remote video playback', { userId });
      }
    } catch (error) {
      logger.error('Failed to start remote video playback', { error, userId });
    }
  }

  private stopRemoteVideoPlayback(userId: string): void {
    try {
      if (this.videoController) {
        logger.info('Stopping remote video playback for user', { userId });
        this.videoController.stopRemoteVideo(userId).catch((error: unknown) => {
          logger.error('Failed to stop remote video playback', { error, userId });
        });
      } else {
        logger.warn('Video controller not available, cannot stop remote video playback', { userId });
      }
    } catch (error) {
      logger.error('Failed to stop remote video playback', { error, userId });
    }
  }

  private setupEventHandlers(): void {
    // User join/leave events
    const onRemoteUserEnterRoom = (userId: string) => {
      logger.info('TRTC remote user entered room', { userId });

      try {
        const participant = this.participantController.addParticipant(userId, {
          hasAudio: false,
          hasVideo: false,
          isConnected: true,
        });

        this.callbacks.onParticipantJoined?.(participant);
      } catch (error) {
        logger.error('Failed to handle remote user enter', { error, userId });

        const streamingError = ErrorMapper.mapTRTCError(error);
        this.callbacks.onError?.(streamingError);
      }
    };

    const onRemoteUserLeaveRoom = (userId: string, reason: number) => {
      logger.info('TRTC remote user left room', { userId, reason });

      try {
        this.participantController.removeParticipant(userId);
        this.callbacks.onParticipantLeft?.(userId);
      } catch (error) {
        logger.error('Failed to handle remote user leave', { error, userId });

        const streamingError = ErrorMapper.mapTRTCError(error);
        this.callbacks.onError?.(streamingError);
      }
    };

    // Audio events
    const onUserAudioAvailable = (userId: string, available: boolean) => {
      logger.info('TRTC user audio availability changed', { userId, available });

      try {
        this.participantController.updateParticipant(userId, { hasAudio: available });
        this.callbacks.onParticipantAudioEnabled?.(userId, available);
      } catch (error) {
        logger.error('Failed to handle audio availability change', { error, userId, available });

        const streamingError = ErrorMapper.mapTRTCError(error);
        this.callbacks.onError?.(streamingError);
      }
    };

    // Video events
    const onUserVideoAvailable = (userId: string, available: boolean) => {
      logger.info('TRTC user video availability changed', { userId, available });

      try {
        this.participantController.updateParticipant(userId, { hasVideo: available });
        this.callbacks.onParticipantVideoEnabled?.(userId, available);

        // Auto-play remote video when available
        if (available) {
          this.startRemoteVideoPlayback(userId);
        } else {
          this.stopRemoteVideoPlayback(userId);
        }
      } catch (error) {
        logger.error('Failed to handle video availability change', { error, userId, available });

        const streamingError = ErrorMapper.mapTRTCError(error);
        this.callbacks.onError?.(streamingError);
      }
    };

    // Note: This event handler is commented out as the corresponding event may not be available in this SDK version
    // const onUserSubStreamAvailable = (userId: string, available: boolean) => {
    //   logger.info('TRTC user sub-stream availability changed', { userId, available });
    //
    //   try {
    //     // Sub-stream typically represents screen sharing
    //     this.participantController.updateParticipant(userId, {
    //       hasScreenShare: available
    //     });
    //   } catch (error) {
    //     logger.error('Failed to handle sub-stream availability change', { error, userId, available });
    //
    //     const streamingError = ErrorMapper.mapTRTCError(error);
    //     this.callbacks.onError?.(streamingError);
    //   }
    // };

    // Note: These connection event handlers are commented out as the corresponding events may not be available in this SDK version
    // const onConnectionLost = () => {
    //   logger.warn('TRTC connection lost');
    //
    //   const error = new StreamingError(
    //     ErrorCode.CONNECTION_LOST,
    //     'TRTC connection lost',
    //     { provider: 'trtc' }
    //   );
    //   this.callbacks.onError?.(error);
    // };

    // const onTryToReconnect = () => {
    //   logger.info('TRTC attempting to reconnect');
    // };

    // const onConnectionRecovery = () => {
    //   logger.info('TRTC connection recovered');
    // };

    // Note: Network quality events are handled by TRTCStatsController

    // Statistics events
    const onStatistics = (statistics: { localStatistics?: unknown; remoteStatistics?: Array<{ userId: string }> }) => {
      logger.debug('TRTC statistics update', { statistics });

      try {
        // Forward statistics to stats controller through participant updates
        if (statistics.localStatistics) {
          this.participantController.updateLocalParticipant({
            statistics: statistics.localStatistics as Record<string, unknown>,
          });
        }

        statistics.remoteStatistics?.forEach((stat: { userId: string }) => {
          if (stat.userId) {
            this.participantController.updateParticipant(stat.userId, {
              statistics: stat,
            });
          }
        });
      } catch (error) {
        logger.error('Failed to handle statistics update', { error });
      }
    };

    // Note: Error events are handled by TRTCConnectionController

    // Note: These event handlers are commented out as the corresponding events may not be available in this SDK version
    // const onWarning = (warningCode: number, warningMsg: string) => {
    //   logger.warn('TRTC SDK warning', { warningCode, warningMsg });
    // };

    // // Volume events
    // const onUserVoiceVolume = (userVolumes: Array<{ userId: string; volume: number }>) => {
    //   try {
    //     userVolumes.forEach(({ userId, volume }) => {
    //       if (userId === '') {
    //         // Local user
    //         this.participantController.updateLocalParticipant({ audioLevel: volume });
    //       } else {
    //         // Remote user
    //         this.participantController.updateParticipant(userId, { audioLevel: volume });
    //       }
    //     });
    //   } catch (error) {
    //     logger.error('Failed to handle voice volume update', { error });
    //   }
    // };

    // Register all event handlers directly
    this.client.on(TRTC.EVENT.REMOTE_USER_ENTER, (...args: unknown[]) => onRemoteUserEnterRoom(args[0] as string));
    this.client.on(TRTC.EVENT.REMOTE_USER_EXIT, (...args: unknown[]) =>
      onRemoteUserLeaveRoom(args[0] as string, args[1] as number),
    );
    this.client.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE, (...args: unknown[]) => {
      const event = args[0] as { userId: string; streamType: string } | undefined;
      if (event?.userId) {
        // For audio available, we assume it's available when the event fires
        onUserAudioAvailable(event.userId, true);
      } else {
        // Fallback to old format if needed
        onUserAudioAvailable(args[0] as string, args[1] as boolean);
      }
    });
    this.client.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, (...args: unknown[]) => {
      const event = args[0] as { userId: string; streamType: string } | undefined;
      if (event?.userId) {
        // For video available, we assume it's available when the event fires
        onUserVideoAvailable(event.userId, true);
      } else {
        // Fallback to old format if needed
        onUserVideoAvailable(args[0] as string, args[1] as boolean);
      }
    });
    // Note: USER_SUB_STREAM_AVAILABLE, CONNECTION_LOST, TRY_TO_RECONNECT, CONNECTION_RECOVERY may not be available in this SDK version
    // Note: NETWORK_QUALITY is handled by TRTCStatsController
    // Note: ERROR and WARNING are handled by TRTCConnectionController
    this.client.on(TRTC.EVENT.STATISTICS, onStatistics);
    // Note: WARNING and USER_VOICE_VOLUME may not be available in this SDK version
    // this.client.on(TRTC.EVENT.WARNING, (...args: unknown[]) => onWarning(args[0] as number, args[1] as string));
    // this.client.on(TRTC.EVENT.USER_VOICE_VOLUME, (...args: unknown[]) => onUserVoiceVolume(args[0] as Array<{ userId: string; volume: number; }>));

    logger.info('TRTC event handlers registered');
  }

  getParticipants(): Participant[] {
    return this.participantController.getAllParticipants();
  }

  getLocalParticipant(): Participant | null {
    return this.participantController.getLocalParticipant();
  }

  getParticipant(userId: string): Participant | null {
    return this.participantController.getParticipant(userId);
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC event controller');

      // Remove all event listeners
      this.eventHandlers.forEach((handler, eventName) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.client.off(eventName as any, handler);
      });

      this.eventHandlers.clear();
      this.callbacks = {};

      logger.info('TRTC event controller cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC event controller cleanup', { error });
    }
  }
}
