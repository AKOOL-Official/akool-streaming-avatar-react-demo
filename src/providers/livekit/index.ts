// Factory function for provider creation with dynamic import
export async function createProvider() {
  // Dynamically import LiveKit SDK only when needed
  const { Room } = await import('livekit-client');
  const livekitModule = await import('./LiveKitStreamingProvider');
  const { logger } = await import('../../core/Logger');

  logger.info('Creating LiveKit provider');

  // Create a new Room instance with default configuration
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  // Create provider config with the room
  const config = {
    room,
  };

  return new livekitModule.LiveKitStreamingProvider(config);
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
