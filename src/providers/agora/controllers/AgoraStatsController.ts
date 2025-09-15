import { IAgoraRTCClient, NetworkQuality } from 'agora-rtc-sdk-ng';
import { logger } from '../../../core/Logger';
import {
  BaseStatsController,
  ParsedWebRTCStats,
  StatsControllerCallbacks,
} from '../../common/controllers/BaseStatsController';

export type { StatsControllerCallbacks };

export class AgoraStatsController extends BaseStatsController {
  private client: IAgoraRTCClient;
  private isListening = false;

  constructor(client: IAgoraRTCClient) {
    super();
    this.client = client;
  }

  setCallbacks(callbacks: StatsControllerCallbacks): void {
    super.setCallbacks(callbacks);
  }

  startStatsCollection(): void {
    if (this.isListening) {
      logger.warn('Stats collection already running');
      return;
    }

    logger.info('Starting Agora stats collection');

    // Listen to Agora's network-quality event for real-time updates
    this.client.on('network-quality', this.handleNetworkQuality.bind(this));
    this.isListening = true;
  }

  stopStatsCollection(): void {
    if (this.isListening) {
      this.client.removeAllListeners('network-quality');
      this.isListening = false;
      logger.info('Stopped Agora stats collection');
    }
  }

  private handleNetworkQuality(stats: NetworkQuality): void {
    try {
      const videoStats = this.client.getRemoteVideoStats();
      const audioStats = this.client.getRemoteAudioStats();

      const firstVideoStats = Object.values(videoStats)[0] || {};
      const firstAudioStats = Object.values(audioStats)[0] || {};

      // Calculate RTT from video/audio stats (end2EndDelay is the most accurate RTT measurement)
      const videoRtt = firstVideoStats.end2EndDelay || 0;
      const audioRtt = firstAudioStats.end2EndDelay || 0;
      const avgRtt = videoRtt > 0 && audioRtt > 0 ? (videoRtt + audioRtt) / 2 : Math.max(videoRtt, audioRtt);

      // Use Agora's network quality values directly
      const connectionQuality = {
        score: this.mapQualityToScore(stats.downlinkNetworkQuality || 0),
        uplink: this.mapQualityToString(stats.uplinkNetworkQuality || 0),
        downlink: this.mapQualityToString(stats.downlinkNetworkQuality || 0),
        rtt: avgRtt,
        packetLoss: ((firstVideoStats.packetLossRate || 0) + (firstAudioStats.packetLossRate || 0)) / 2,
      };

      const detailedStats: {
        video?: {
          codec?: string;
          bitrate?: number;
          frameRate?: number;
          resolution?: { width: number; height: number };
          packetLoss?: number;
          rtt?: number;
        };
        audio?: {
          codec?: string;
          bitrate?: number;
          packetLoss?: number;
          volume?: number;
          rtt?: number;
        };
      } = {};

      // Add video stats if available
      if (Object.keys(videoStats).length > 0) {
        detailedStats.video = {
          codec: firstVideoStats.codecType,
          bitrate: firstVideoStats.receiveBitrate,
          frameRate: firstVideoStats.receiveFrameRate,
          resolution: {
            width: firstVideoStats.receiveResolutionWidth,
            height: firstVideoStats.receiveResolutionHeight,
          },
          packetLoss: firstVideoStats.packetLossRate,
          rtt: firstVideoStats.end2EndDelay,
        };
      }

      // Add audio stats if available
      if (Object.keys(audioStats).length > 0) {
        detailedStats.audio = {
          codec: firstAudioStats.codecType,
          bitrate: firstAudioStats.receiveBitrate,
          packetLoss: firstAudioStats.packetLossRate,
          volume: firstAudioStats.receiveLevel,
          rtt: firstAudioStats.end2EndDelay,
        };
      }

      const networkStats = {
        connectionQuality,
        detailedStats: detailedStats,
      };

      this.callbacks.onNetworkStatsUpdate?.(networkStats);

      logger.debug('Processed Agora network quality', {
        uplinkQuality: stats.uplinkNetworkQuality,
        downlinkQuality: stats.downlinkNetworkQuality,
        connectionScore: connectionQuality.score,
        rtt: avgRtt,
        hasVideo: Object.keys(videoStats).length > 0,
        hasAudio: Object.keys(audioStats).length > 0,
        videoBitrate: firstVideoStats.receiveBitrate,
        audioBitrate: firstAudioStats.receiveBitrate,
        videoRtt: firstVideoStats.end2EndDelay,
        audioRtt: firstAudioStats.end2EndDelay,
      });
    } catch (error) {
      this.handleStatsError(error, 'handleNetworkQuality');
    }
  }

  private mapQualityToScore(quality: number): number {
    const qualityMap = { 0: 100, 1: 100, 2: 80, 3: 60, 4: 40, 5: 20, 6: 0 };
    return qualityMap[quality as keyof typeof qualityMap] || 0;
  }

  private mapQualityToString(quality: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (quality <= 2) return 'excellent';
    if (quality <= 3) return 'good';
    if (quality <= 4) return 'fair';
    return 'poor';
  }

  async collectStats(): Promise<ParsedWebRTCStats | null> {
    // This method is not used in the event-based approach
    // The handleNetworkQuality method handles stats collection
    return null;
  }

  cleanup(): void {
    this.stopStatsCollection();
    super.cleanup();
    logger.info('Agora stats controller cleanup completed');
  }
}
