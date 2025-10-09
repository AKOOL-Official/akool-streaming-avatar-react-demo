import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { Participant } from '../../../types/streaming.types';
import { TRTCParticipantControllerCallbacks } from '../types';

import TRTC from 'trtc-sdk-v5';

export interface ParticipantUpdate {
  hasAudio?: boolean;
  hasVideo?: boolean;
  hasScreenShare?: boolean;
  isConnected?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  networkQuality?: {
    uplink: number;
    downlink: number;
  };
  statistics?: Record<string, unknown>;
}

export class TRTCParticipantController {
  // private client: TRTC; // Not currently used but kept for future implementation
  private participants = new Map<string, Participant>();
  private localParticipant: Participant | null = null;
  private callbacks: TRTCParticipantControllerCallbacks = {};

  constructor(_client: TRTC) {
    // Client not currently used but kept for future implementation
  }

  setCallbacks(callbacks: TRTCParticipantControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  addParticipant(userId: string, initialState: ParticipantUpdate = {}): Participant {
    try {
      if (this.participants.has(userId)) {
        logger.debug('Participant already exists, updating', { userId });
        return this.updateParticipant(userId, initialState);
      }

      const participant: Participant = {
        id: userId,
        name: userId, // TRTC doesn't provide display names by default
        isLocal: false,
        hasAudio: initialState.hasAudio || false,
        hasVideo: initialState.hasVideo || false,
        hasScreenShare: initialState.hasScreenShare || false,
        isConnected: initialState.isConnected || true,
        isSpeaking: initialState.isSpeaking || false,
        audioLevel: initialState.audioLevel || 0,
        networkQuality: initialState.networkQuality || undefined,
        joinedAt: new Date(),
        metadata: {},
        videoTracks: [],
        audioTracks: [],
        connectionQuality: {
          score: 80,
          uplink: 'good',
          downlink: 'good',
          rtt: 0,
          packetLoss: 0,
        },
      };

      this.participants.set(userId, participant);
      this.callbacks.onParticipantAdded?.(participant);

      logger.info('TRTC participant added', { userId, participant });
      return participant;
    } catch (error) {
      logger.error('Failed to add TRTC participant', { error, userId });

      const streamingError = new StreamingError(ErrorCode.PARTICIPANT_ERROR, `Failed to add participant: ${userId}`, {
        provider: 'trtc',
        userId,
        originalError: error,
      });
      this.callbacks.onError?.(streamingError);
      throw streamingError;
    }
  }

  removeParticipant(userId: string): void {
    try {
      const participant = this.participants.get(userId);
      if (!participant) {
        logger.debug('Participant not found for removal', { userId });
        return;
      }

      this.participants.delete(userId);
      this.callbacks.onParticipantRemoved?.(userId);

      logger.info('TRTC participant removed', { userId });
    } catch (error) {
      logger.error('Failed to remove TRTC participant', { error, userId });

      const streamingError = new StreamingError(
        ErrorCode.PARTICIPANT_ERROR,
        `Failed to remove participant: ${userId}`,
        { provider: 'trtc', userId, originalError: error },
      );
      this.callbacks.onError?.(streamingError);
    }
  }

  updateParticipant(userId: string, updates: ParticipantUpdate): Participant {
    try {
      let participant = this.participants.get(userId);

      if (!participant) {
        // Auto-create participant if it doesn't exist
        logger.debug('Creating participant during update', { userId });
        participant = this.addParticipant(userId, updates);
        return participant;
      }

      // Apply updates
      const updatedParticipant: Participant = {
        ...participant,
        hasAudio: updates.hasAudio !== undefined ? updates.hasAudio : participant.hasAudio,
        hasVideo: updates.hasVideo !== undefined ? updates.hasVideo : participant.hasVideo,
        hasScreenShare: updates.hasScreenShare !== undefined ? updates.hasScreenShare : participant.hasScreenShare,
        isConnected: updates.isConnected !== undefined ? updates.isConnected : participant.isConnected,
        isSpeaking: updates.isSpeaking !== undefined ? updates.isSpeaking : participant.isSpeaking,
        audioLevel: updates.audioLevel !== undefined ? updates.audioLevel : participant.audioLevel,
        networkQuality: updates.networkQuality !== undefined ? updates.networkQuality : participant.networkQuality,
      };

      // Update metadata with statistics if provided
      if (updates.statistics) {
        updatedParticipant.metadata = {
          ...updatedParticipant.metadata,
          statistics: updates.statistics,
        };
      }

      this.participants.set(userId, updatedParticipant);
      this.callbacks.onParticipantUpdated?.(updatedParticipant);

      logger.debug('TRTC participant updated', { userId, updates });
      return updatedParticipant;
    } catch (error) {
      logger.error('Failed to update TRTC participant', { error, userId, updates });

      const streamingError = new StreamingError(
        ErrorCode.PARTICIPANT_ERROR,
        `Failed to update participant: ${userId}`,
        { provider: 'trtc', userId, updates: updates as Record<string, unknown>, originalError: error },
      );
      this.callbacks.onError?.(streamingError);
      throw streamingError;
    }
  }

  getParticipant(userId: string): Participant | null {
    return this.participants.get(userId) || null;
  }

  getAllParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  getConnectedParticipants(): Participant[] {
    return this.getAllParticipants().filter((p) => p.isConnected);
  }

  getParticipantCount(): number {
    return this.participants.size;
  }

  createLocalParticipant(userId: string, initialState: ParticipantUpdate = {}): Participant {
    try {
      const participant: Participant = {
        id: userId,
        name: userId,
        isLocal: true,
        hasAudio: initialState.hasAudio || false,
        hasVideo: initialState.hasVideo || false,
        hasScreenShare: initialState.hasScreenShare || false,
        isConnected: initialState.isConnected || true,
        isSpeaking: initialState.isSpeaking || false,
        audioLevel: initialState.audioLevel || 0,
        networkQuality: initialState.networkQuality || undefined,
        joinedAt: new Date(),
        metadata: {},
        videoTracks: [],
        audioTracks: [],
        connectionQuality: {
          score: 80,
          uplink: 'good',
          downlink: 'good',
          rtt: 0,
          packetLoss: 0,
        },
      };

      this.localParticipant = participant;
      this.callbacks.onParticipantAdded?.(participant);

      logger.info('TRTC local participant created', { userId, participant });
      return participant;
    } catch (error) {
      logger.error('Failed to create local TRTC participant', { error, userId });

      const streamingError = new StreamingError(
        ErrorCode.PARTICIPANT_ERROR,
        `Failed to create local participant: ${userId}`,
        { provider: 'trtc', userId, originalError: error },
      );
      this.callbacks.onError?.(streamingError);
      throw streamingError;
    }
  }

  updateLocalParticipant(updates: ParticipantUpdate): Participant | null {
    try {
      if (!this.localParticipant) {
        logger.warn('No local participant to update');
        return null;
      }

      const updatedParticipant: Participant = {
        ...this.localParticipant,
        hasAudio: updates.hasAudio !== undefined ? updates.hasAudio : this.localParticipant.hasAudio,
        hasVideo: updates.hasVideo !== undefined ? updates.hasVideo : this.localParticipant.hasVideo,
        hasScreenShare:
          updates.hasScreenShare !== undefined ? updates.hasScreenShare : this.localParticipant.hasScreenShare,
        isConnected: updates.isConnected !== undefined ? updates.isConnected : this.localParticipant.isConnected,
        isSpeaking: updates.isSpeaking !== undefined ? updates.isSpeaking : this.localParticipant.isSpeaking,
        audioLevel: updates.audioLevel !== undefined ? updates.audioLevel : this.localParticipant.audioLevel,
        networkQuality:
          updates.networkQuality !== undefined ? updates.networkQuality : this.localParticipant.networkQuality,
      };

      // Update metadata with statistics if provided
      if (updates.statistics) {
        updatedParticipant.metadata = {
          ...updatedParticipant.metadata,
          statistics: updates.statistics,
        };
      }

      this.localParticipant = updatedParticipant;
      this.callbacks.onParticipantUpdated?.(updatedParticipant);

      logger.debug('TRTC local participant updated', { updates });
      return updatedParticipant;
    } catch (error) {
      logger.error('Failed to update local TRTC participant', { error, updates });

      const streamingError = new StreamingError(ErrorCode.PARTICIPANT_ERROR, 'Failed to update local participant', {
        provider: 'trtc',
        updates: updates as Record<string, unknown>,
        originalError: error,
      });
      this.callbacks.onError?.(streamingError);
      throw streamingError;
    }
  }

  getLocalParticipant(): Participant | null {
    return this.localParticipant;
  }

  clearLocalParticipant(): void {
    if (this.localParticipant) {
      this.callbacks.onParticipantRemoved?.(this.localParticipant.id);
      this.localParticipant = null;
    }
  }

  clearAllParticipants(): void {
    try {
      const participantIds = Array.from(this.participants.keys());

      this.participants.clear();

      participantIds.forEach((userId) => {
        this.callbacks.onParticipantRemoved?.(userId);
      });

      this.clearLocalParticipant();

      logger.info('All TRTC participants cleared');
    } catch (error) {
      logger.error('Failed to clear all TRTC participants', { error });
    }
  }

  // Helper methods for common participant operations
  getParticipantsByAudioState(hasAudio: boolean): Participant[] {
    return this.getAllParticipants().filter((p) => p.hasAudio === hasAudio);
  }

  getParticipantsByVideoState(hasVideo: boolean): Participant[] {
    return this.getAllParticipants().filter((p) => p.hasVideo === hasVideo);
  }

  getSpeakingParticipants(): Participant[] {
    return this.getAllParticipants().filter((p) => p.isSpeaking);
  }

  getParticipantsWithScreenShare(): Participant[] {
    return this.getAllParticipants().filter((p) => p.hasScreenShare);
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC participant controller');

      this.clearAllParticipants();
      this.callbacks = {};

      logger.info('TRTC participant controller cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC participant controller cleanup', { error });
    }
  }
}
