import { StreamingProvider, StreamingCredentials } from '../../types/provider.interfaces';
import { TRTCStreamingProvider, TRTCProviderConfig } from './TRTCStreamingProvider';
import { logger } from '../../core/Logger';
import { TRTCParams, TRTCNetworkQuality, TRTCCredentials } from './types';
import TRTC from 'trtc-sdk-v5';

// TRTC SDK v5 client interface
interface TRTCClient {
  enterRoom(params: TRTCParams): Promise<void>;
  exitRoom(): Promise<void>;
  startLocalAudio(quality?: number): Promise<void>;
  stopLocalAudio(): void;
  muteLocalAudio(mute: boolean): void;
  startLocalVideo(config?: Record<string, unknown>): Promise<void>;
  stopLocalVideo(): void;
  muteLocalVideo(mute: boolean): void;
  sendCustomCmdMsg(cmdId: number, data: ArrayBuffer, reliable?: boolean, ordered?: boolean): Promise<void>;
  sendSEIMsg(data: ArrayBuffer, repeatCount?: number): Promise<void>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
  getConnectionState(): 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';
  setAudioCaptureVolume(volume: number): void;
  setVideoEncoderParam(param: Record<string, unknown>): void;
  enableAudioVolumeEvaluation(intervalMs: number): void;
  getSDKVersion(): string;
  getNetworkQuality(): Promise<TRTCNetworkQuality>;
  startRemoteView(userId: string, streamType: string, view: HTMLElement): void;
  stopRemoteView(userId: string, streamType: string): void;
}

// Factory function for creating TRTC provider
export function createProvider(credentials: StreamingCredentials): StreamingProvider {
  const trtcCredentials = credentials as TRTCCredentials;
  logger.info('Creating TRTC provider with real SDK');

  // Create real TRTC client instance
  const trtcClient = TRTC.create();

  // Wrap the TRTC client to match our interface
  const client: TRTCClient = {
    enterRoom: async (params: TRTCParams) => {
      await trtcClient.enterRoom({
        sdkAppId: trtcCredentials.trtc_app_id,
        userId: trtcCredentials.trtc_user_id,
        userSig: trtcCredentials.trtc_user_sig,
        strRoomId: params.strRoomId,
      });
    },
    exitRoom: async () => {
      await trtcClient.exitRoom();
    },
    startLocalAudio: async (_quality?: number) => {
      await trtcClient.startLocalAudio();
    },
    stopLocalAudio: () => {
      trtcClient.stopLocalAudio();
    },
    muteLocalAudio: (mute: boolean) => {
      trtcClient.updateLocalAudio({ mute: mute });
    },
    startLocalVideo: async (config?: Record<string, unknown>) => {
      await trtcClient.startLocalVideo({
        view: config?.view as HTMLElement,
      });
    },
    stopLocalVideo: () => {
      trtcClient.stopLocalVideo();
    },
    muteLocalVideo: (mute: boolean) => {
      trtcClient.updateLocalVideo({ mute: mute });
    },
    sendCustomCmdMsg: async (cmdId: number, data: ArrayBuffer, _reliable?: boolean, _ordered?: boolean) => {
      await trtcClient.sendCustomMessage({
        cmdId,
        data,
      });
    },
    sendSEIMsg: async (data: ArrayBuffer, _repeatCount?: number) => {
      await trtcClient.sendSEIMessage(data);
    },
    on: (event: string, callback: (...args: unknown[]) => void) => {
      trtcClient.on(event as any, callback);
    },
    off: (event: string, callback?: (...args: unknown[]) => void) => {
      if (callback) {
        trtcClient.off(event as any, callback);
      }
    },
    getConnectionState: () => {
      return 'CONNECTED' as 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';
    },
    setAudioCaptureVolume: (volume: number) => {
      trtcClient.updateLocalAudio({ volume: volume / 100 } as any);
    },
    setVideoEncoderParam: (param: Record<string, unknown>) => {
      trtcClient.updateLocalVideo(param as any);
    },
    enableAudioVolumeEvaluation: (intervalMs: number) => {
      trtcClient.enableAudioVolumeEvaluation(intervalMs);
    },
    getSDKVersion: () => {
      return '5.13.0';
    },
    getNetworkQuality: async () => {
      return {
        userId: 'local',
        txQuality: 1,
        rxQuality: 1,
        delay: 0,
        lossRate: 0,
      };
    },
    startRemoteView: (userId: string, streamType: string, view: HTMLElement) => {
      trtcClient.startRemoteVideo({
        userId,
        view,
        streamType: streamType as any,
      });
    },
    stopRemoteView: (userId: string, streamType: string) => {
      trtcClient.stopRemoteVideo({
        userId,
        streamType: streamType as any,
      });
    },
  };

  // Create provider config
  const providerConfig: TRTCProviderConfig = {
    client,
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
