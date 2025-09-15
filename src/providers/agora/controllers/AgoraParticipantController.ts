import { IAgoraRTCClient, IAgoraRTCRemoteUser, NetworkQuality } from 'agora-rtc-sdk-ng';
import { UID } from 'agora-rtc-sdk-ng/esm';
import { logger } from '../../../core/Logger';
import { Participant, ConnectionQuality } from '../../../types/streaming.types';
import {
  BaseParticipantController,
  ParticipantControllerCallbacks,
} from '../../common/controllers/BaseParticipantController';

export type { ParticipantControllerCallbacks };

export class AgoraParticipantController extends BaseParticipantController {
  constructor(_client: IAgoraRTCClient) {
    super();
  }

  setCallbacks(callbacks: ParticipantControllerCallbacks): void {
    super.setCallbacks(callbacks);
  }

  convertToUnifiedParticipant(participant: unknown): Participant {
    if (this.isAgoraUser(participant)) {
      return this.convertAgoraUserToParticipant(participant);
    }

    if (this.isAgoraUID(participant)) {
      return this.createParticipantFromUID(participant);
    }

    // Fallback for unknown participant types
    logger.warn('Unknown participant type in AgoraParticipantController', { participant });
    return this.createDefaultParticipant('unknown', 'Unknown Participant');
  }

  convertConnectionQuality(quality: unknown): ConnectionQuality {
    if (this.isNetworkQuality(quality)) {
      return this.convertNetworkQuality(quality);
    }

    // Fallback for unknown quality types
    logger.warn('Unknown quality type in AgoraParticipantController', { quality });
    return this.createDefaultConnectionQuality();
  }

  // Agora-specific conversion methods
  private convertAgoraUserToParticipant(user: IAgoraRTCRemoteUser): Participant {
    return {
      id: String(user.uid),
      displayName: `User ${user.uid}`,
      isLocal: false,
      audioTracks: [],
      videoTracks: [],
      connectionQuality: this.createDefaultConnectionQuality(),
      isSpeaking: false,
    };
  }

  private createParticipantFromUID(uid: UID): Participant {
    return {
      id: String(uid),
      displayName: `User ${uid}`,
      isLocal: false,
      audioTracks: [],
      videoTracks: [],
      connectionQuality: this.createDefaultConnectionQuality(),
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

  // Type guards
  private isAgoraUser(participant: unknown): participant is IAgoraRTCRemoteUser {
    return (
      participant !== null &&
      typeof participant === 'object' &&
      'uid' in participant &&
      'hasAudio' in participant &&
      'hasVideo' in participant
    );
  }

  private isAgoraUID(participant: unknown): participant is UID {
    return typeof participant === 'string' || typeof participant === 'number';
  }

  private isNetworkQuality(quality: unknown): quality is NetworkQuality {
    return (
      quality !== null &&
      typeof quality === 'object' &&
      'uplinkNetworkQuality' in quality &&
      'downlinkNetworkQuality' in quality
    );
  }

  cleanup(): void {
    super.cleanup();
    logger.info('Agora participant controller cleanup completed');
  }
}
