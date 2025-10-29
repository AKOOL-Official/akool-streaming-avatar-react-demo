import { Room, RoomEvent } from 'livekit-client';
import { logger } from '../../../core/Logger';
import { MessageAdapter } from '../../common/adapters/MessageAdapter';

export class LiveKitMessageAdapter implements MessageAdapter {
  private room: Room;
  private messageCallback?: (data: Uint8Array) => void;
  private listenerFunction?: (payload: Uint8Array) => void;

  constructor(room: Room) {
    this.room = room;
  }

  async sendData(data: Uint8Array): Promise<void> {
    try {
      // Check if room is connected and local participant is ready
      if (this.room.state !== 'connected') {
        throw new Error(`Room not connected, current state: ${this.room.state}`);
      }

      // Check if local participant exists and is ready
      if (!this.room.localParticipant) {
        throw new Error('Local participant not available');
      }

      // Check if local participant can publish data
      if (!this.room.localParticipant.permissions?.canPublish) {
        throw new Error('Local participant does not have publish permissions');
      }

      // Connection quality check is optional - we'll proceed even if unknown
      // as it can be 'unknown' briefly after connection establishment

      await this.room.localParticipant.publishData(data, { reliable: true });
      logger.debug('Message sent via LiveKit', { dataSize: data.length });
    } catch (error) {
      logger.error('Failed to send data via LiveKit', {
        error: error instanceof Error ? error.message : String(error),
        dataSize: data.length,
        roomState: this.room.state,
        localParticipant: this.room.localParticipant
          ? {
              identity: this.room.localParticipant.identity,
              permissions: this.room.localParticipant.permissions,
              connectionQuality: this.room.localParticipant.connectionQuality,
            }
          : 'not available',
      });
      throw error;
    }
  }

  isReady(): boolean {
    return (
      this.room.state === 'connected' &&
      this.room.localParticipant !== null &&
      this.room.localParticipant.permissions?.canPublish === true
      // Removed connectionQuality check as it can be 'unknown' briefly after connection
    );
  }

  setupMessageListener(callback: (data: Uint8Array) => void): void {
    // Remove existing listener if any
    if (this.listenerFunction) {
      this.room.off(RoomEvent.DataReceived, this.listenerFunction);
    }

    // Store the callback and create listener function
    this.messageCallback = callback;

    // Create and store the listener function
    this.listenerFunction = (payload: Uint8Array) => {
      if (this.messageCallback) {
        this.messageCallback(payload);
      }
    };

    // Set up LiveKit's data received listener
    this.room.on(RoomEvent.DataReceived, this.listenerFunction);

    logger.debug('LiveKit message listener setup complete');
  }

  removeMessageListener(): void {
    if (this.listenerFunction) {
      this.room.off(RoomEvent.DataReceived, this.listenerFunction);
      this.listenerFunction = undefined;
    }
    this.messageCallback = undefined;
    logger.debug('LiveKit message listener removed');
  }

  cleanup(): void {
    this.removeMessageListener();
    logger.info('LiveKit message adapter cleanup completed');
  }
}
