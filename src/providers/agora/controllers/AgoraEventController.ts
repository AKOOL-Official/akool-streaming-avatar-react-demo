import { IAgoraRTCClient, IAgoraRTCRemoteUser, NetworkQuality } from 'agora-rtc-sdk-ng';
import { logger } from '../../../core/Logger';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { Participant, ConnectionQuality } from '../../../types/streaming.types';
import { NetworkStats } from '../../../components/NetworkQuality';
import { BaseEventController, BaseEventControllerCallbacks } from '../../common/controllers/BaseEventController';
import { BaseParticipantController } from '../../common/controllers/BaseParticipantController';

// Agora-specific event controller callbacks
export interface AgoraEventControllerCallbacks extends BaseEventControllerCallbacks {
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
}

export class AgoraEventController extends BaseEventController {
  private client: IAgoraRTCClient;
  private participantController: BaseParticipantController;

  constructor(client: IAgoraRTCClient, participantController: BaseParticipantController) {
    super();
    this.client = client;
    this.participantController = participantController;
  }

  setCallbacks(callbacks: AgoraEventControllerCallbacks): void {
    super.setCallbacks(callbacks);
  }

  setupEventListeners(): void {
    if (this.isListening) return;

    // User media events
    this.client.on('user-published', this.handleUserPublished.bind(this));
    this.client.on('user-unpublished', this.handleUserUnpublished.bind(this));
    this.client.on('user-joined', this.handleUserJoined.bind(this));
    this.client.on('user-left', this.handleUserLeft.bind(this));

    // Network quality events
    this.client.on('network-quality', this.handleNetworkQuality.bind(this));

    // Exception handling
    this.client.on('exception', this.handleException.bind(this));

    this.isListening = true;
    logger.info('Started listening to Agora events');
  }

  removeEventListeners(): void {
    if (!this.isListening) return;

    this.client.removeAllListeners('user-published');
    this.client.removeAllListeners('user-unpublished');
    this.client.removeAllListeners('user-joined');
    this.client.removeAllListeners('user-left');
    this.client.removeAllListeners('network-quality');
    this.client.removeAllListeners('exception');

    this.isListening = false;
    logger.info('Stopped listening to Agora events');
  }

  // Event handling methods
  private async handleUserPublished(
    user: IAgoraRTCRemoteUser,
    mediaType: 'video' | 'audio' | 'datachannel',
  ): Promise<void> {
    try {
      this.logEvent('user-published', {
        uid: user.uid,
        mediaType,
      });

      // Subscribe to the user's media
      await this.client.subscribe(user, mediaType);

      // Handle video tracks specifically
      if (mediaType === 'video' && user.videoTrack) {
        // Play the remote video track in the remote video element
        user.videoTrack.play('remote-video');
        logger.info('Remote video track playing', { uid: user.uid });
      }

      // Handle audio tracks specifically
      if (mediaType === 'audio' && user.audioTrack) {
        // Play the remote audio track
        user.audioTrack.play();
        logger.info('Remote audio track playing', { uid: user.uid });
      }

      // Update participant with track information
      const participantId = String(user.uid);
      const participant = this.participantController.getParticipant(participantId);
      if (participant) {
        // Update participant with new track info
        this.participantController.updateParticipant(participantId, {
          ...participant,
          // Track information will be updated by audio/video controllers
        });
      }
    } catch (error) {
      this.handleError(error, 'handleUserPublished');
    }
  }

  private handleUserUnpublished(user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio' | 'datachannel'): void {
    try {
      this.logEvent('user-unpublished', {
        uid: user.uid,
        mediaType,
      });

      // Handle video tracks specifically
      if (mediaType === 'video' && user.videoTrack) {
        // Stop the remote video track
        user.videoTrack.stop();
        logger.info('Remote video track stopped', { uid: user.uid });
      }

      // Handle audio tracks specifically
      if (mediaType === 'audio' && user.audioTrack) {
        // Stop the remote audio track
        user.audioTrack.stop();
        logger.info('Remote audio track stopped', { uid: user.uid });
      }

      // Unsubscribe from the user's media
      this.client.unsubscribe(user, mediaType);

      // Update participant track information
      const participantId = String(user.uid);
      const participant = this.participantController.getParticipant(participantId);
      if (participant) {
        // Track information will be updated by audio/video controllers
        this.participantController.updateParticipant(participantId, {
          ...participant,
          // Track information will be cleared by audio/video controllers
        });
      }
    } catch (error) {
      this.handleError(error, 'handleUserUnpublished');
    }
  }

  private handleUserJoined(user: IAgoraRTCRemoteUser): void {
    try {
      this.logEvent('user-joined', {
        uid: user.uid,
      });

      const participant = this.createParticipantFromUser(user);
      this.participantController.addParticipant(participant);
    } catch (error) {
      this.handleError(error, 'handleUserJoined');
    }
  }

  private handleUserLeft(user: IAgoraRTCRemoteUser, reason: string): void {
    try {
      this.logEvent('user-left', {
        uid: user.uid,
        reason,
      });

      const participantId = String(user.uid);
      this.participantController.removeParticipant(participantId);
    } catch (error) {
      this.handleError(error, 'handleUserLeft');
    }
  }

  private handleNetworkQuality(stats: NetworkQuality): void {
    try {
      this.logEvent('network-quality', {
        uplink: stats.uplinkNetworkQuality,
        downlink: stats.downlinkNetworkQuality,
      });

      const connectionQuality = this.convertNetworkQuality(stats);
      this.updateConnectionQuality(connectionQuality);

      // Create network stats for detailed reporting
      const networkStats: NetworkStats = {
        connectionQuality,
        detailedStats: {
          network: {
            rtt: this.estimateRTT(stats),
            packetLoss: this.estimatePacketLoss(stats),
          },
        },
      };

      this.updateNetworkStats(networkStats);
    } catch (error) {
      this.handleError(error, 'handleNetworkQuality');
    }
  }

  private handleException(e: any): void {
    try {
      // Handle audio level warnings as non-critical errors
      if (e.code === 2002 || e.code === 4002) {
        // AUDIO_OUTPUT_LEVEL_TOO_LOW and AUDIO_OUTPUT_LEVEL_TOO_LOW_RECOVER
        logger.warn('Agora audio level warning (non-critical)', {
          code: e.code,
          message: e.msg,
          uid: e.uid,
        });
        // Don't call onError for audio level warnings
        return;
      }

      this.logEvent('exception', {
        error: e,
      });

      const streamingError = ErrorMapper.mapAgoraError(e);
      this.callbacks.onError?.(streamingError);
    } catch (error) {
      this.handleError(error, 'handleException');
    }
  }

  // Utility methods
  private createParticipantFromUser(user: IAgoraRTCRemoteUser): Participant {
    return {
      id: String(user.uid),
      displayName: `User ${user.uid}`,
      isLocal: false,
      audioTracks: [],
      videoTracks: [],
      connectionQuality: { score: 0, uplink: 'poor', downlink: 'poor', rtt: 0, packetLoss: 0 },
      isSpeaking: false,
    };
  }

  private convertNetworkQuality(quality: NetworkQuality): ConnectionQuality {
    const uplinkScore = this.convertQualityScore(quality.uplinkNetworkQuality);
    const downlinkScore = this.convertQualityScore(quality.downlinkNetworkQuality);
    const avgScore = Math.round((uplinkScore + downlinkScore) / 2);

    return {
      score: avgScore,
      uplink: this.getQualityLevel(uplinkScore),
      downlink: this.getQualityLevel(downlinkScore),
      rtt: this.estimateRTT(quality),
      packetLoss: this.estimatePacketLoss(quality),
    };
  }

  private convertQualityScore(quality: number): number {
    // Agora quality: 0=unknown, 1=excellent, 2=good, 3=poor, 4=bad, 5=very bad, 6=down
    switch (quality) {
      case 1:
        return 100;
      case 2:
        return 75;
      case 3:
        return 50;
      case 4:
        return 25;
      case 5:
        return 10;
      case 6:
        return 0;
      default:
        return 0;
    }
  }

  private getQualityLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  private estimateRTT(quality: NetworkQuality): number {
    // Rough estimation based on quality scores
    const avgQuality = (quality.uplinkNetworkQuality + quality.downlinkNetworkQuality) / 2;
    if (avgQuality <= 1) return 30;
    if (avgQuality <= 2) return 60;
    if (avgQuality <= 3) return 150;
    if (avgQuality <= 4) return 300;
    return 500;
  }

  private estimatePacketLoss(quality: NetworkQuality): number {
    // Rough estimation based on quality scores
    const avgQuality = (quality.uplinkNetworkQuality + quality.downlinkNetworkQuality) / 2;
    if (avgQuality <= 1) return 0;
    if (avgQuality <= 2) return 1;
    if (avgQuality <= 3) return 5;
    if (avgQuality <= 4) return 10;
    return 20;
  }

  cleanup(): void {
    this.removeEventListeners();
    this.callbacks = {};
    logger.info('Agora event controller cleanup completed');
  }
}
