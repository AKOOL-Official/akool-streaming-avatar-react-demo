import { Room } from 'livekit-client';
import { LiveKitStreamingProvider, LiveKitProviderConfig } from './LiveKitStreamingProvider';
import { StreamingProvider } from '../../types/provider.interfaces';
import { logger } from '../../core/Logger';

export function createProvider(): StreamingProvider {
  logger.info('Creating LiveKit provider');

  // Create a new Room instance with default configuration
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  // Create provider config with the room
  const config: LiveKitProviderConfig = {
    room,
  };

  return new LiveKitStreamingProvider(config);
}

// Export all LiveKit-specific types and classes
export * from './LiveKitStreamingProvider';
export type {
  LiveKitCredentials,
  LiveKitConfig,
  LiveKitAudioControllerCallbacks,
  LiveKitVideoControllerCallbacks,
  LiveKitConnectionControllerCallbacks,
} from './types';
export * from './controllers/LiveKitAudioController';
export * from './controllers/LiveKitVideoController';
export * from './controllers/LiveKitConnectionController';

// Strategies
export { LiveKitAudioStrategy } from './strategies/LiveKitAudioStrategy';
export { LiveKitVideoStrategy } from './strategies/LiveKitVideoStrategy';
