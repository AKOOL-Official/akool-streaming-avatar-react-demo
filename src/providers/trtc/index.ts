import { StreamingProvider, StreamingCredentials } from '../../types/provider.interfaces';
import { TRTCStreamingProvider, TRTCProviderConfig } from './TRTCStreamingProvider';
import { logger } from '../../core/Logger';
// TRTCCredentials type is not needed as we use the actual TRTC SDK
import TRTC from 'trtc-sdk-v5';

// Using actual TRTC type from SDK

// Factory function for creating TRTC provider
export function createProvider(_credentials: StreamingCredentials): StreamingProvider {
  logger.info('Creating TRTC provider with real SDK');

  // Create real TRTC client instance
  const trtcClient = TRTC.create();

  // Create provider config
  const providerConfig: TRTCProviderConfig = {
    client: trtcClient,
    messageConfig: {
      maxMessageSize: 1024,
      defaultCmdId: 1,
      reliable: true,
      ordered: true,
    },
  };

  return new TRTCStreamingProvider(providerConfig);
}

// Export all TRTC-specific types and classes
export * from './TRTCStreamingProvider';
export type {
  TRTCCredentials,
  TRTCAudioControllerCallbacks,
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
