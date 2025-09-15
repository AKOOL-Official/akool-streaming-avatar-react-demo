import { logger } from '../../../core/Logger';
import { Participant, ConnectionQuality } from '../../../types/streaming.types';

// Participant controller callback interface
export interface ParticipantControllerCallbacks {
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onError?: (error: Error) => void;
}

// Abstract base class for participant management
export abstract class BaseParticipantController {
  protected callbacks: ParticipantControllerCallbacks = {};
  protected participants: Map<string, Participant> = new Map();

  constructor() {}

  setCallbacks(callbacks: ParticipantControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  // Abstract methods to be implemented by provider-specific controllers
  abstract convertToUnifiedParticipant(participant: unknown): Participant;
  abstract convertConnectionQuality(quality: unknown): ConnectionQuality;

  // Common participant management methods
  public addParticipant(participant: Participant): void {
    this.participants.set(participant.id, participant);
    this.callbacks.onParticipantJoined?.(participant);

    logger.debug('Participant added', {
      participantId: participant.id,
      displayName: participant.displayName,
      isLocal: participant.isLocal,
    });
  }

  public removeParticipant(participantId: string): void {
    const participant = this.participants.get(participantId);
    if (participant) {
      this.participants.delete(participantId);
      this.callbacks.onParticipantLeft?.(participantId);

      logger.debug('Participant removed', {
        participantId,
        displayName: participant.displayName,
      });
    }
  }

  public updateParticipant(participantId: string, updates: Partial<Participant>): void {
    const participant = this.participants.get(participantId);
    if (participant) {
      const updatedParticipant = { ...participant, ...updates };
      this.participants.set(participantId, updatedParticipant);

      logger.debug('Participant updated', {
        participantId,
        updates,
      });
    }
  }

  public updateParticipantConnectionQuality(participantId: string, quality: ConnectionQuality): void {
    this.updateParticipant(participantId, { connectionQuality: quality });
  }

  public updateParticipantSpeakingState(participantId: string, isSpeaking: boolean): void {
    this.updateParticipant(participantId, { isSpeaking });
  }

  protected updateParticipantAudioTracks(participantId: string, audioTracks: any[]): void {
    this.updateParticipant(participantId, { audioTracks });
  }

  protected updateParticipantVideoTracks(participantId: string, videoTracks: any[]): void {
    this.updateParticipant(participantId, { videoTracks });
  }

  // Getters for participant data
  getParticipant(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  getAllParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  getLocalParticipant(): Participant | undefined {
    return Array.from(this.participants.values()).find((p) => p.isLocal);
  }

  getRemoteParticipants(): Participant[] {
    return Array.from(this.participants.values()).filter((p) => !p.isLocal);
  }

  // Common utility methods
  protected createDefaultParticipant(id: string, displayName: string, isLocal: boolean = false): Participant {
    return {
      id,
      displayName,
      isLocal,
      audioTracks: [],
      videoTracks: [],
      connectionQuality: { score: 0, uplink: 'poor', downlink: 'poor', rtt: 0, packetLoss: 0 },
      isSpeaking: false,
    };
  }

  protected createDefaultConnectionQuality(): ConnectionQuality {
    return {
      score: 0,
      uplink: 'poor',
      downlink: 'poor',
      rtt: 0,
      packetLoss: 0,
    };
  }

  protected handleParticipantError(error: unknown, context: string, participantId?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Participant error in ${context}`, {
      error: errorMessage,
      context,
      participantId,
    });

    const errorObj = error instanceof Error ? error : new Error(errorMessage);
    this.callbacks.onError?.(errorObj);
  }

  // Cleanup method
  cleanup(): void {
    this.participants.clear();
    this.callbacks = {};
    logger.info('Base participant controller cleanup completed');
  }
}
