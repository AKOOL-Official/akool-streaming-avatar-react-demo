import { Room, RoomEvent } from 'livekit-client';
import { logger } from '../../../core/Logger';
import { MessageAdapter } from '../../common/adapters/MessageAdapter';

export class LiveKitMessageAdapter implements MessageAdapter {
  private room: Room;
  private messageCallback?: (data: Uint8Array) => void;

  constructor(room: Room) {
    this.room = room;
  }

  async sendData(data: Uint8Array): Promise<void> {
    try {
      await this.room.localParticipant.publishData(data, { reliable: true });
      logger.debug('Message sent via LiveKit', { dataSize: data.length });
    } catch (error) {
      logger.error('Failed to send data via LiveKit', {
        error: error instanceof Error ? error.message : String(error),
        dataSize: data.length,
      });
      throw error;
    }
  }

  isReady(): boolean {
    return this.room.state === 'connected';
  }

  setupMessageListener(callback: (data: Uint8Array) => void): void {
    this.messageCallback = callback;

    // Set up LiveKit's data received listener
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      if (this.messageCallback) {
        this.messageCallback(payload);
      }
    });

    logger.debug('LiveKit message listener setup complete');
  }

  removeMessageListener(): void {
    this.room.removeAllListeners(RoomEvent.DataReceived);
    this.messageCallback = undefined;
    logger.debug('LiveKit message listener removed');
  }

  cleanup(): void {
    this.removeMessageListener();
    logger.info('LiveKit message adapter cleanup completed');
  }
}
