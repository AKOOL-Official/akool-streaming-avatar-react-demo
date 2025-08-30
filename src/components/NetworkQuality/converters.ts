import { NetworkStats, UnifiedNetworkQuality, UnifiedVideoStats, UnifiedAudioStats, LegacyNetworkStats } from './index';

// Export LegacyNetworkStats for external use
export type { LegacyNetworkStats } from './index';

/**
 * Convert Agora network stats to unified format
 */
export function convertAgoraStats(agoraStats: LegacyNetworkStats): NetworkStats {
  const localNetwork: UnifiedNetworkQuality = {
    uplinkNetworkQuality: agoraStats.localNetwork.uplinkNetworkQuality,
    downlinkNetworkQuality: agoraStats.localNetwork.downlinkNetworkQuality,
  };

  const remoteNetwork: UnifiedNetworkQuality = {
    uplinkNetworkQuality: agoraStats.remoteNetwork.uplinkNetworkQuality,
    downlinkNetworkQuality: agoraStats.remoteNetwork.downlinkNetworkQuality,
  };

  const video: UnifiedVideoStats = {
    codecType: agoraStats.video.codecType,
    transportDelay: agoraStats.video.transportDelay,
    end2EndDelay: agoraStats.video.end2EndDelay,
    receiveDelay: agoraStats.video.receiveDelay,
    receiveFrameRate: agoraStats.video.receiveFrameRate,
    receiveResolutionWidth: agoraStats.video.receiveResolutionWidth,
    receiveResolutionHeight: agoraStats.video.receiveResolutionHeight,
    receiveBitrate: agoraStats.video.receiveBitrate,
    packetLossRate: agoraStats.video.packetLossRate,
    totalFreezeTime: agoraStats.video.totalFreezeTime,
    freezeRate: agoraStats.video.freezeRate,
  };

  const audio: UnifiedAudioStats = {
    codecType: agoraStats.audio.codecType,
    transportDelay: agoraStats.audio.transportDelay,
    end2EndDelay: agoraStats.audio.end2EndDelay,
    receiveDelay: agoraStats.audio.receiveDelay,
    receiveBitrate: agoraStats.audio.receiveBitrate,
    packetLossRate: agoraStats.audio.packetLossRate,
    receiveLevel: agoraStats.audio.receiveLevel,
  };

  return {
    providerType: 'agora',
    localNetwork,
    remoteNetwork,
    video,
    audio,
  };
}

/**
 * Create basic LiveKit network stats
 * LiveKit has limited stats compared to Agora, so we provide what's available
 */
export function createLiveKitStats(localQuality?: number, remoteQuality?: number): NetworkStats {
  const baseStats: NetworkStats = {
    providerType: 'livekit',
  };

  if (localQuality !== undefined) {
    baseStats.localNetwork = {
      uplinkNetworkQuality: localQuality,
      downlinkNetworkQuality: localQuality,
    };
  }

  if (remoteQuality !== undefined) {
    baseStats.remoteNetwork = {
      uplinkNetworkQuality: remoteQuality,
      downlinkNetworkQuality: remoteQuality,
    };
  }

  // LiveKit doesn't provide detailed video/audio stats like Agora
  // These would need to be collected from WebRTC stats API if needed
  return baseStats;
}

/**
 * Map LiveKit connection quality to Agora-style numeric scale (0-6)
 */
export function mapLiveKitQuality(quality: string): number {
  switch (quality) {
    case 'excellent':
      return 6;
    case 'good':
      return 5;
    case 'poor':
      return 3;
    case 'unknown':
    default:
      return 0;
  }
}
