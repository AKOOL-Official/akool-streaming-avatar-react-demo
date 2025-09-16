// Factory function for creating TRTC provider with dynamic import
export async function createProvider(_credentials: unknown) {
  // Dynamically import TRTC SDK only when needed
  const TRTC = await import('trtc-sdk-v5');
  const trtcModule = await import('./TRTCStreamingProvider');
  const { logger } = await import('../../core/Logger');

  logger.info('Creating TRTC provider with real SDK');

  // Create real TRTC client instance
  const trtcClient = TRTC.default.create();

  // Create provider config
  const providerConfig = {
    client: trtcClient,
    messageConfig: {
      maxMessageSize: 1024,
      defaultCmdId: 1,
      reliable: true,
      ordered: true,
    },
  };

  return new trtcModule.TRTCStreamingProvider(providerConfig);
}

// Export all TRTC-specific types and classes
export * from './TRTCStreamingProvider';
export type {
  TRTCCredentials,
  // TRTCAudioControllerCallbacks is now unified as AudioControllerCallbacks in streaming.types.ts
  TRTCVideoControllerCallbacks,
  TRTCConnectionControllerCallbacks,
  TRTCEventControllerCallbacks,
  TRTCParticipantControllerCallbacks,
  TRTCStatsControllerCallbacks,
  TRTCNetworkQuality,
  TRTCLocalStatistics,
  TRTCRemoteStatistics,
} from './types';

// Controllers
export { TRTCAudioController } from './controllers/TRTCAudioController';
export { TRTCVideoController } from './controllers/TRTCVideoController';
export { TRTCConnectionController } from './controllers/TRTCConnectionController';
export { TRTCEventController } from './controllers/TRTCEventController';
export { TRTCParticipantController } from './controllers/TRTCParticipantController';
export { TRTCStatsController } from './controllers/TRTCStatsController';

// Adapters
export { TRTCMessageAdapter } from './adapters/TRTCMessageAdapter';

// Strategies
export { TRTCAudioStrategy } from './strategies/TRTCAudioStrategy';
export { TRTCVideoStrategy } from './strategies/TRTCVideoStrategy';
