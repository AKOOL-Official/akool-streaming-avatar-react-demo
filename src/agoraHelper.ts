import { IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { CommandType, Metadata } from './types/streamingProvider';
import {
  log,
  createCommandMessage,
  splitMessageIntoChunks,
  encodeMessage,
  withRetry,
  rateLimit,
} from './utils/messageUtils';

export interface RTCClient extends IAgoraRTCClient {
  sendStreamMessage(msg: Uint8Array | string, flag: boolean): Promise<void>;
}

// Helper function to check if client is ready to send stream messages
export function isClientReady(client: RTCClient): boolean {
  return client.connectionState === 'CONNECTED' && client.uid !== undefined;
}

export async function setAvatarParams(
  client: RTCClient,
  meta: Metadata,
  onCommandSend?: (cmd: CommandType, data?: Record<string, unknown>) => void,
) {
  return withRetry(
    async () => {
      // Remove empty or undefined values from meta
      const cleanedMeta = Object.fromEntries(Object.entries(meta).filter(([_, value]) => !!value));

      const message = createCommandMessage(CommandType.SET_PARAMS, cleanedMeta);
      const jsondata = JSON.stringify(message);
      log(`setAvatarParams, size=${jsondata.length}, data=${jsondata}`);

      // Notify about command being sent
      onCommandSend?.(CommandType.SET_PARAMS, cleanedMeta);

      return client.sendStreamMessage(jsondata, false);
    },
    () => isClientReady(client),
    {
      operationName: 'setAvatarParams',
      getDebugInfo: () => ({
        connectionState: client.connectionState,
        uid: client.uid,
      }),
    },
  );
}

export async function interruptResponse(
  client: RTCClient,
  onCommandSend?: (cmd: CommandType, data?: Record<string, unknown>) => void,
) {
  return withRetry(
    async () => {
      const message = createCommandMessage(CommandType.INTERRUPT);
      const jsondata = JSON.stringify(message);
      log(`interruptResponse, size=${jsondata.length}, data=${jsondata}`);

      // Notify about command being sent
      onCommandSend?.(CommandType.INTERRUPT);

      return client.sendStreamMessage(jsondata, false);
    },
    () => isClientReady(client),
    {
      operationName: 'interruptResponse',
      getDebugInfo: () => ({
        connectionState: client.connectionState,
        uid: client.uid,
      }),
    },
  );
}

export async function sendMessageToAvatar(client: RTCClient, messageId: string, content: string) {
  return withRetry(
    async () => {
      const chunks = splitMessageIntoChunks(content, messageId);

      // Send chunks with rate limiting
      for (let i = 0; i < chunks.length; i++) {
        const isLastChunk = i === chunks.length - 1;
        const encodedChunk = encodeMessage(chunks[i], messageId, i, isLastChunk);
        const chunkSize = encodedChunk.length;
        const startTime = Date.now();

        log(`Sending chunk ${i + 1}/${chunks.length}, size=${chunkSize} bytes`);

        try {
          await client.sendStreamMessage(encodedChunk, false);
        } catch (error: unknown) {
          throw new Error(`Failed to send chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        if (!isLastChunk) {
          await rateLimit(chunkSize, startTime);
        }
      }
    },
    () => isClientReady(client),
    {
      operationName: 'sendMessageToAvatar',
      getDebugInfo: () => ({
        connectionState: client.connectionState,
        uid: client.uid,
      }),
    },
  );
}
