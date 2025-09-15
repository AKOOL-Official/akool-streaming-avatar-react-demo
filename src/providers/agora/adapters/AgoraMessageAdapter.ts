import { IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { logger } from '../../../core/Logger';
import { MessageAdapter } from '../../common/adapters/MessageAdapter';

export class AgoraMessageAdapter implements MessageAdapter {
  private client: IAgoraRTCClient;
  private messageCallback?: (data: Uint8Array) => void;

  constructor(client: IAgoraRTCClient) {
    this.client = client;
  }

  async sendData(data: Uint8Array): Promise<void> {
    try {
      // Convert Uint8Array to string for Agora's sendStreamMessage
      const text = new TextDecoder().decode(data);

      await (
        this.client as unknown as { sendStreamMessage: (data: string, reliable: boolean) => Promise<void> }
      ).sendStreamMessage(text, false);

      logger.debug('Message sent via Agora', { dataSize: data.length });
    } catch (error) {
      logger.error('Failed to send data via Agora', {
        error: error instanceof Error ? error.message : String(error),
        dataSize: data.length,
      });
      throw error;
    }
  }

  isReady(): boolean {
    return this.client.connectionState === 'CONNECTED' && this.client.uid !== undefined;
  }

  setupMessageListener(callback: (data: Uint8Array) => void): void {
    this.messageCallback = callback;

    // Set up Agora's stream message listener
    this.client.on('stream-message', (_uid: number, data: Uint8Array) => {
      if (this.messageCallback) {
        this.messageCallback(data);
      }
    });

    logger.debug('Agora message listener setup complete');
  }

  removeMessageListener(): void {
    if (this.messageCallback) {
      this.client.off('stream-message', this.messageCallback);
    }
    this.messageCallback = undefined;
    logger.debug('Agora message listener removed');
  }

  cleanup(): void {
    this.removeMessageListener();
    logger.info('Agora message adapter cleanup completed');
  }
}
