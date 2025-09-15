import { logger } from '../../../core/Logger';
import { Participant, ConnectionQuality } from '../../../types/streaming.types';
import { NetworkStats } from '../../../components/NetworkQuality';

// Common event callback interface
export interface BaseEventControllerCallbacks {
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
  onError?: (error: Error) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;
}

// Abstract base class for event handling
export abstract class BaseEventController {
  protected callbacks: BaseEventControllerCallbacks = {};
  protected isListening = false;

  constructor() {}

  setCallbacks(callbacks: BaseEventControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  // Abstract methods to be implemented by provider-specific controllers
  abstract setupEventListeners(): void;
  abstract removeEventListeners(): void;
  abstract cleanup(): void;

  // Common utility methods
  protected handleError(error: unknown, context: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in ${context}`, {
      error: errorMessage,
      context,
    });

    const errorObj = error instanceof Error ? error : new Error(errorMessage);
    this.callbacks.onError?.(errorObj);
  }

  protected logEvent(eventName: string, data?: Record<string, unknown>): void {
    logger.debug(`Event: ${eventName}`, data);
  }

  protected updateSpeakingState(isSpeaking: boolean): void {
    this.callbacks.onSpeakingStateChanged?.(isSpeaking);
  }

  protected updateConnectionQuality(quality: ConnectionQuality): void {
    this.callbacks.onConnectionQualityChanged?.(quality);
  }

  protected updateNetworkStats(stats: NetworkStats): void {
    this.callbacks.onNetworkStatsUpdate?.(stats);
  }

  protected notifyParticipantJoined(participant: Participant): void {
    this.callbacks.onParticipantJoined?.(participant);
  }

  protected notifyParticipantLeft(participantId: string): void {
    this.callbacks.onParticipantLeft?.(participantId);
  }
}
