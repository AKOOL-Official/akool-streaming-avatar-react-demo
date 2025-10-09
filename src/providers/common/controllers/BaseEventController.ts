import { logger } from '../../../core/Logger';
import { Participant, ConnectionQuality } from '../../../types/streaming.types';
import { NetworkStats } from '../../../components/NetworkQuality';
import { BaseController } from './BaseController';
import { ErrorHandlingConfig } from '../../../types/error.types';

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
export abstract class BaseEventController extends BaseController {
  protected callbacks: BaseEventControllerCallbacks = {};
  protected isListening = false;

  constructor(errorHandlingConfig?: ErrorHandlingConfig) {
    super(errorHandlingConfig);
  }

  setCallbacks(callbacks: BaseEventControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  // Abstract methods to be implemented by provider-specific controllers
  abstract setupEventListeners(): void;
  abstract removeEventListeners(): void;

  // Implement BaseController abstract methods
  protected async onInitialize(): Promise<void> {
    this.setupEventListeners();
    this.isListening = true;
  }

  protected async onDestroy(): Promise<void> {
    this.removeEventListeners();
    this.isListening = false;
  }

  // Legacy cleanup method for backward compatibility
  async cleanup(): Promise<void> {
    await this.destroy();
  }

  // Common utility methods
  protected handleEventError(error: unknown, context: string): void {
    this.handleError(error, this.constructor.name, context);

    if (this.callbacks.onError) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.callbacks.onError(new Error(errorMessage));
    }
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
