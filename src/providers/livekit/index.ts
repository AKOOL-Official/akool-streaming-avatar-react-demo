import { Room } from 'livekit-client';
import { LiveKitStreamingProvider } from './LiveKitStreamingProvider';
import { StreamingProvider } from '../../types/provider.interfaces';
import { logger } from '../../core/Logger';

export function createProvider(): StreamingProvider {
  logger.info('Creating LiveKit provider');

  // Create a new Room instance with default configuration
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  return new LiveKitStreamingProvider(room);
}

// Export all LiveKit-specific types and classes
export * from './LiveKitStreamingProvider';
export * from './types';
export * from './controllers/LiveKitAudioController';
export * from './controllers/LiveKitVideoController';
export * from './controllers/LiveKitConnectionController';
export * from './controllers/LiveKitEventHandler';
