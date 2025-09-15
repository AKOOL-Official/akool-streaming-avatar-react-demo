import { Room, ConnectionQuality, Participant as LKParticipant, LocalParticipant } from 'livekit-client';
import { logger } from '../../../core/Logger';
import { Participant, ConnectionQuality as UnifiedConnectionQuality } from '../../../types/streaming.types';
import {
  BaseParticipantController,
  ParticipantControllerCallbacks,
} from '../../common/controllers/BaseParticipantController';

export type { ParticipantControllerCallbacks };

export class LiveKitParticipantController extends BaseParticipantController {
  constructor(_room: Room) {
    super();
  }

  setCallbacks(callbacks: ParticipantControllerCallbacks): void {
    super.setCallbacks(callbacks);
  }

  convertToUnifiedParticipant(participant: unknown): Participant {
    if (this.isLiveKitParticipant(participant)) {
      return this.convertLiveKitParticipant(participant);
    }

    // Fallback for unknown participant types
    logger.warn('Unknown participant type in LiveKitParticipantController', { participant });
    return this.createDefaultParticipant('unknown', 'Unknown Participant');
  }

  convertConnectionQuality(quality: unknown): UnifiedConnectionQuality {
    if (this.isConnectionQuality(quality)) {
      return this.convertLiveKitConnectionQuality(quality);
    }

    // Fallback for unknown quality types
    logger.warn('Unknown quality type in LiveKitParticipantController', { quality });
    return this.createDefaultConnectionQuality();
  }

  // LiveKit-specific conversion methods
  private convertLiveKitParticipant(participant: LKParticipant): Participant {
    return {
      id: participant.sid,
      displayName: participant.identity,
      isLocal: participant instanceof LocalParticipant,
      audioTracks: [], // Will be populated by audio controller
      videoTracks: [], // Will be populated by video controller
      connectionQuality: this.createDefaultConnectionQuality(),
      isSpeaking: false,
    };
  }

  private convertLiveKitConnectionQuality(quality: ConnectionQuality): UnifiedConnectionQuality {
    // Use real RTT data if available, otherwise fall back to estimated values
    const rtt = this.getEstimatedRTT(quality);
    const packetLoss = this.getEstimatedPacketLoss(quality);

    switch (quality) {
      case ConnectionQuality.Excellent:
        return { score: 100, uplink: 'excellent', downlink: 'excellent', rtt, packetLoss };
      case ConnectionQuality.Good:
        return { score: 75, uplink: 'good', downlink: 'good', rtt, packetLoss };
      case ConnectionQuality.Poor:
        return { score: 50, uplink: 'fair', downlink: 'fair', rtt, packetLoss };
      case ConnectionQuality.Lost:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt, packetLoss };
      case ConnectionQuality.Unknown:
      default:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt, packetLoss };
    }
  }

  private getEstimatedRTT(quality: ConnectionQuality): number {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 30;
      case ConnectionQuality.Good:
        return 60;
      case ConnectionQuality.Poor:
        return 150;
      case ConnectionQuality.Lost:
        return 500;
      default:
        return 0;
    }
  }

  private getEstimatedPacketLoss(quality: ConnectionQuality): number {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 0;
      case ConnectionQuality.Good:
        return 1;
      case ConnectionQuality.Poor:
        return 5;
      case ConnectionQuality.Lost:
        return 20;
      default:
        return 0;
    }
  }

  // Type guards
  private isLiveKitParticipant(participant: unknown): participant is LKParticipant {
    return (
      participant !== null &&
      typeof participant === 'object' &&
      'sid' in participant &&
      'identity' in participant &&
      'audioTracks' in participant &&
      'videoTracks' in participant
    );
  }

  private isConnectionQuality(quality: unknown): quality is ConnectionQuality {
    return typeof quality === 'string' && Object.values(ConnectionQuality).includes(quality as ConnectionQuality);
  }

  cleanup(): void {
    super.cleanup();
    logger.info('LiveKit participant controller cleanup completed');
  }
}
