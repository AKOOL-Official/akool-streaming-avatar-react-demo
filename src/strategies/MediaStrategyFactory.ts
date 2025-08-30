import { useMemo } from 'react';
import { IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { Room } from 'livekit-client';
import { StreamProviderType } from '../types/streamingProvider';
import { MediaStrategy } from './interfaces';
import { AgoraMediaStrategy } from './AgoraStrategy';
import { LiveKitMediaStrategy } from './LiveKitStrategy';

export class MediaStrategyFactory {
  static createStrategy(streamType: StreamProviderType, client?: IAgoraRTCClient, room?: Room): MediaStrategy {
    switch (streamType) {
      case 'agora':
        if (!client) {
          throw new Error('Agora client is required for Agora strategy');
        }
        return new AgoraMediaStrategy(client);

      case 'livekit':
        if (!room) {
          throw new Error('LiveKit room is required for LiveKit strategy');
        }
        return new LiveKitMediaStrategy(room);

      case 'trtc':
        throw new Error('TRTC strategy not implemented yet');

      default:
        throw new Error(`Unsupported stream provider type: ${streamType}`);
    }
  }
}

// Hook to create strategy based on current context
export const useMediaStrategy = (
  streamType: StreamProviderType,
  client?: IAgoraRTCClient,
  room?: Room,
): MediaStrategy => {
  // Memoize strategy creation to prevent excessive recreation
  const strategy = useMemo(() => {
    return MediaStrategyFactory.createStrategy(streamType, client, room);
  }, [streamType, client, room]);

  return strategy;
};
