import { logger } from '../../../core/Logger';
import { NetworkStats } from '../../../components/NetworkQuality';
import {
  TRTCNetworkQuality,
  TRTCLocalStatistics,
  TRTCRemoteStatistics,
  TRTCStatsControllerCallbacks,
  TRTCLocalStats,
  TRTCRemoteStats,
} from '../types';
import TRTC, { NetworkQuality, TRTCStatistics } from 'trtc-sdk-v5';

// TRTC SDK NetworkQuality interface (based on actual SDK structure)
interface TRTCNetworkQualityData {
  uplinkNetworkQuality: number;
  downlinkNetworkQuality: number;
  downlinkRTT?: number;
  uplinkRTT?: number;
  downlinkLoss?: number;
  uplinkLoss?: number;
}

// Detailed stats interface for TRTC
interface TRTCDetailedStats {
  localAudio?: TRTCLocalStats;
  localVideo?: TRTCLocalStats;
  remoteAudio?: Record<string, TRTCRemoteStats>;
  remoteVideo?: Record<string, TRTCRemoteStats>;
  video?: {
    codecType?: string;
    transportDelay?: number;
    end2EndDelay?: number;
    receiveDelay?: number;
    receiveFrameRate?: number;
    receiveResolutionWidth?: number;
    receiveResolutionHeight?: number;
    receiveBitrate?: number;
    packetLossRate?: number;
    totalFreezeTime?: number;
    freezeRate?: number;
    sendFrameRate?: number;
    sendResolutionWidth?: number;
    sendResolutionHeight?: number;
    sendBitrate?: number;
    jitterBufferDelay?: number;
  };
  audio?: {
    codecType?: string;
    transportDelay?: number;
    end2EndDelay?: number;
    receiveDelay?: number;
    receiveBitrate?: number;
    packetLossRate?: number;
    sendBitrate?: number;
    jitterBufferDelay?: number;
  };
  network?: {
    rtt: number;
    packetLoss: number;
    uplinkQuality: number;
    downlinkQuality: number;
  };
}

export class TRTCStatsController {
  private client: TRTC;
  private callbacks: TRTCStatsControllerCallbacks = {};
  private networkQualityData: TRTCNetworkQuality | null = null;
  private localStats: TRTCLocalStatistics | null = null;
  private remoteStats = new Map<string, TRTCRemoteStatistics>();
  private isCollecting = false;

  constructor(client: TRTC) {
    this.client = client;
    this.setupEventHandlers();
  }

  setCallbacks(callbacks: TRTCStatsControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  private async collectStats(): Promise<NetworkStats> {
    try {
      return this.createTRTCStats(this.networkQualityData, this.localStats, this.remoteStats);
    } catch (error) {
      logger.error('Failed to collect TRTC stats', { error });
      return this.createTRTCStats(null, null, new Map());
    }
  }

  private handleStatsUpdate(stats: NetworkStats): void {
    logger.debug('TRTC network stats created', {
      hasLocalNetwork: !!stats.localNetwork,
      hasConnection: !!stats.connection,
      hasVideo: !!stats.video,
      hasAudio: !!stats.audio,
      hasDetailedStats: !!stats.detailedStats,
      rtt: stats.connection?.roundTripTime,
      packetLoss: stats.connection?.packetLossRate,
      detailedVideo: stats.detailedStats?.video
        ? {
            codec: stats.detailedStats.video.codec,
            bitrate: stats.detailedStats.video.bitrate,
            frameRate: stats.detailedStats.video.frameRate,
            resolution: stats.detailedStats.video.resolution,
          }
        : null,
      detailedAudio: stats.detailedStats?.audio
        ? {
            codec: stats.detailedStats.audio.codec,
            bitrate: stats.detailedStats.audio.bitrate,
            packetLoss: stats.detailedStats.audio.packetLoss,
          }
        : null,
    });
    this.callbacks.onNetworkStatsUpdate?.(stats);
  }

  private setupEventHandlers(): void {
    // Network quality events
    this.client.on(TRTC.EVENT.NETWORK_QUALITY, this.handleNetworkQuality);
    this.client.on(TRTC.EVENT.STATISTICS, this.handleStatistics);
  }

  private handleNetworkQuality = (networkQuality: NetworkQuality) => {
    try {
      // Convert TRTC NetworkQuality to our internal format
      this.networkQualityData = {
        userId: 'local', // NetworkQuality doesn't have userId
        txQuality: networkQuality.uplinkNetworkQuality || 0,
        rxQuality: networkQuality.downlinkNetworkQuality || 0,
        delay: networkQuality.downlinkRTT || networkQuality.uplinkRTT || 0,
        lossRate: networkQuality.downlinkLoss || networkQuality.uplinkLoss || 0,
      };

      logger.debug('TRTC network quality update', {
        uplinkQuality: networkQuality.uplinkNetworkQuality,
        downlinkQuality: networkQuality.downlinkNetworkQuality,
        rtt: networkQuality.downlinkRTT || networkQuality.uplinkRTT,
        loss: networkQuality.downlinkLoss || networkQuality.uplinkLoss,
      });

      // Trigger immediate stats update
      this.triggerStatsCollection();
    } catch (error) {
      logger.error('Failed to handle TRTC network quality update', { error });
    }
  };

  private handleStatistics = (stats: TRTCStatistics) => {
    try {
      // Convert TRTCStatistics to our expected format
      if (stats.localStatistics) {
        const localVideo = stats.localStatistics.video?.[0];
        this.localStats = {
          width: localVideo?.width || 0,
          height: localVideo?.height || 0,
          frameRate: localVideo?.frameRate || 0,
          videoBitrate: localVideo?.bitrate || 0,
          audioSampleRate: 48000, // Default for TRTC
          audioBitrate: stats.localStatistics.audio?.bitrate || 0,
          streamType: 0,
        };
        const convertedStats = this.convertLocalStatsToTRTCLocalStats(this.localStats);
        if (convertedStats) {
          this.callbacks.onLocalStatsUpdate?.(convertedStats);
        }
      }

      if (stats.remoteStatistics) {
        stats.remoteStatistics.forEach((stat) => {
          const remoteVideo = stat.video?.[0];
          const remoteStats: TRTCRemoteStatistics = {
            userId: stat.userId,
            finalLoss: 0,
            width: remoteVideo?.width || 0,
            height: remoteVideo?.height || 0,
            frameRate: remoteVideo?.frameRate || 0,
            videoBitrate: remoteVideo?.bitrate || 0,
            audioSampleRate: 48000,
            audioBitrate: stat.audio?.bitrate || 0,
            streamType: 0,
            jitterBufferDelay: 0, // TRTC SDK v5 doesn't provide jitterBufferDelay in this structure
            audioTotalBlockTime: 0,
            videoTotalBlockTime: 0,
            audioBlockRate: 0,
            videoBlockRate: 0,
          };
          this.remoteStats.set(stat.userId, remoteStats);
          this.callbacks.onRemoteStatsUpdate?.(stat.userId, this.convertRemoteStatsToTRTCRemoteStats(remoteStats));
        });
      }

      logger.debug('TRTC statistics update', {
        hasLocal: !!stats.localStatistics,
        remoteCount: stats.remoteStatistics?.length || 0,
        rtt: stats.rtt,
        upLoss: stats.upLoss,
        downLoss: stats.downLoss,
      });

      // Trigger immediate stats update
      this.triggerStatsCollection();
    } catch (error) {
      logger.error('Failed to handle TRTC statistics update', { error });
    }
  };

  private async triggerStatsCollection(): Promise<void> {
    try {
      const stats = await this.collectStats();
      this.handleStatsUpdate(stats);
    } catch (error) {
      logger.error('Failed to trigger TRTC stats collection', { error });
    }
  }

  private createTRTCStats(
    networkQuality: TRTCNetworkQuality | null,
    localStats: TRTCLocalStatistics | null,
    remoteStats: Map<string, TRTCRemoteStatistics>,
  ): NetworkStats {
    const baseStats: NetworkStats = {
      providerType: 'trtc',
      timestamp: Date.now(),
    };

    // Network quality mapping - handle both old and new data structures
    if (networkQuality) {
      // Check if it's the new data structure from logs
      if ('uplinkNetworkQuality' in networkQuality && 'downlinkNetworkQuality' in networkQuality) {
        const qualityData = networkQuality as unknown as TRTCNetworkQualityData;
        baseStats.localNetwork = {
          uplinkNetworkQuality: qualityData.uplinkNetworkQuality,
          downlinkNetworkQuality: qualityData.downlinkNetworkQuality,
        };

        baseStats.connection = {
          roundTripTime: qualityData.downlinkRTT || qualityData.uplinkRTT || 0,
          packetLossRate: qualityData.downlinkLoss || qualityData.uplinkLoss || 0,
        };
      } else {
        // Old data structure
        baseStats.localNetwork = {
          uplinkNetworkQuality: networkQuality.txQuality,
          downlinkNetworkQuality: networkQuality.rxQuality,
        };

        baseStats.connection = {
          roundTripTime: networkQuality.delay,
          packetLossRate: networkQuality.lossRate,
        };
      }
    }

    // Local video statistics
    if (localStats) {
      baseStats.video = {
        codecType: 'H264', // TRTC typically uses H264
        transportDelay: networkQuality?.delay || 0,
        end2EndDelay: networkQuality?.delay || 0,
        receiveDelay: 0, // Not applicable for local
        receiveFrameRate: localStats.frameRate,
        receiveResolutionWidth: localStats.width,
        receiveResolutionHeight: localStats.height,
        receiveBitrate: localStats.videoBitrate,
        packetLossRate: networkQuality?.lossRate || 0,
        totalFreezeTime: 0, // Not available in local stats
        freezeRate: 0, // Not available in local stats

        // Additional local stats
        sendFrameRate: localStats.frameRate,
        sendResolutionWidth: localStats.width,
        sendResolutionHeight: localStats.height,
        sendBitrate: localStats.videoBitrate,
      };

      baseStats.audio = {
        codecType: 'OPUS', // TRTC typically uses OPUS for audio
        transportDelay: networkQuality?.delay || 0,
        end2EndDelay: networkQuality?.delay || 0,
        receiveDelay: 0, // Not applicable for local
        receiveBitrate: localStats.audioBitrate,
        packetLossRate: networkQuality?.lossRate || 0,
        receiveLevel: 0, // Not available in local stats

        // Additional local stats
        sendBitrate: localStats.audioBitrate,
        sampleRate: localStats.audioSampleRate,
      };
    }

    // Remote statistics (aggregate if multiple remote users)
    if (remoteStats.size > 0) {
      const remoteStatsArray = Array.from(remoteStats.values());
      const primaryRemote = remoteStatsArray[0]; // Use first remote user as primary

      if (primaryRemote) {
        baseStats.video = {
          ...baseStats.video,
          receiveFrameRate: primaryRemote.frameRate,
          receiveResolutionWidth: primaryRemote.width,
          receiveResolutionHeight: primaryRemote.height,
          receiveBitrate: primaryRemote.videoBitrate,
          totalFreezeTime: primaryRemote.videoTotalBlockTime,
          freezeRate: primaryRemote.videoBlockRate,
          jitterBufferDelay: primaryRemote.jitterBufferDelay,
        };

        baseStats.audio = {
          ...baseStats.audio,
          receiveBitrate: primaryRemote.audioBitrate,
          receiveLevel: 0, // TRTC doesn't provide audio level in stats
          totalFreezeTime: primaryRemote.audioTotalBlockTime,
          freezeRate: primaryRemote.audioBlockRate,
          sampleRate: primaryRemote.audioSampleRate,
        };
      }
    }

    // Add detailed stats for comprehensive metrics display
    baseStats.detailedStats = this.convertDetailedStatsToNetworkStatsFormat(
      this.createDetailedStats(networkQuality, localStats, remoteStats),
    );

    return baseStats;
  }

  private createDetailedStats(
    networkQuality: TRTCNetworkQuality | null,
    localStats: TRTCLocalStatistics | null,
    remoteStats: Map<string, TRTCRemoteStatistics>,
  ) {
    const detailedStats: TRTCDetailedStats = {};

    // Video detailed stats - prioritize remote stats for better metrics
    if (remoteStats.size > 0) {
      const primaryRemote = Array.from(remoteStats.values())[0];
      if (primaryRemote) {
        detailedStats.video = {
          codecType: 'H264', // TRTC typically uses H264
          receiveBitrate: primaryRemote.videoBitrate || 0,
          receiveFrameRate: primaryRemote.frameRate || 0,
          receiveResolutionWidth: primaryRemote.width || 0,
          receiveResolutionHeight: primaryRemote.height || 0,
          packetLossRate: this.getNetworkQualityLoss(networkQuality),
          transportDelay: this.getNetworkQualityRTT(networkQuality),
        };
      }
    } else if (localStats) {
      detailedStats.video = {
        codecType: 'H264',
        sendBitrate: localStats.videoBitrate || 0,
        sendFrameRate: localStats.frameRate || 0,
        sendResolutionWidth: localStats.width || 0,
        sendResolutionHeight: localStats.height || 0,
        packetLossRate: this.getNetworkQualityLoss(networkQuality),
        transportDelay: this.getNetworkQualityRTT(networkQuality),
      };
    }

    // Audio detailed stats - prioritize remote stats for better metrics
    if (remoteStats.size > 0) {
      const primaryRemote = Array.from(remoteStats.values())[0];
      if (primaryRemote) {
        detailedStats.audio = {
          codecType: 'OPUS', // TRTC typically uses OPUS
          receiveBitrate: primaryRemote.audioBitrate || 0,
          packetLossRate: this.getNetworkQualityLoss(networkQuality),
          transportDelay: this.getNetworkQualityRTT(networkQuality),
        };
      }
    } else if (localStats) {
      detailedStats.audio = {
        codecType: 'OPUS',
        sendBitrate: localStats.audioBitrate || 0,
        packetLossRate: this.getNetworkQualityLoss(networkQuality),
        transportDelay: this.getNetworkQualityRTT(networkQuality),
      };
    }

    // Network detailed stats
    if (networkQuality) {
      detailedStats.network = {
        rtt: this.getNetworkQualityRTT(networkQuality),
        packetLoss: this.getNetworkQualityLoss(networkQuality),
        uplinkQuality: networkQuality?.txQuality || 0,
        downlinkQuality: networkQuality?.rxQuality || 0,
      };
    }

    return detailedStats;
  }

  private getNetworkQualityRTT(networkQuality: TRTCNetworkQuality | null): number {
    if (!networkQuality) return 0;

    // Handle both old and new data structures
    if ('downlinkRTT' in networkQuality && 'uplinkNetworkQuality' in networkQuality) {
      const qualityData = networkQuality as unknown as TRTCNetworkQualityData;
      return qualityData.downlinkRTT || qualityData.uplinkRTT || 0;
    }
    return networkQuality.delay || 0;
  }

  private getNetworkQualityLoss(networkQuality: TRTCNetworkQuality | null): number {
    if (!networkQuality) return 0;

    // Handle both old and new data structures
    if ('downlinkLoss' in networkQuality && 'uplinkNetworkQuality' in networkQuality) {
      const qualityData = networkQuality as unknown as TRTCNetworkQualityData;
      return qualityData.downlinkLoss || qualityData.uplinkLoss || 0;
    }
    return networkQuality.lossRate || 0;
  }

  // Note: mapQualityFromRTT function removed as SPEED_TEST event is not available

  private convertLocalStatsToTRTCLocalStats(localStats: TRTCLocalStatistics | null): TRTCLocalStats | null {
    if (!localStats) return null;

    return {
      audioLevel: 0, // TRTC doesn't provide audio level
      audioEnergy: 0, // TRTC doesn't provide audio energy
      audioVolume: 0, // TRTC doesn't provide audio volume
      audioBitrate: localStats.audioBitrate || 0,
      audioPacketLossRate: 0, // TRTC doesn't provide packet loss for local audio
      videoBitrate: localStats.videoBitrate || 0,
      videoFrameRate: localStats.frameRate || 0,
      videoWidth: localStats.width || 0,
      videoHeight: localStats.height || 0,
      videoPacketLossRate: 0, // TRTC doesn't provide packet loss for local video
      rtt: 0, // RTT is provided separately
      cpuUsage: 0, // TRTC doesn't provide CPU usage
      memoryUsage: 0, // TRTC doesn't provide memory usage
    };
  }

  private convertRemoteStatsToTRTCRemoteStats(remoteStats: TRTCRemoteStatistics): TRTCRemoteStats {
    return {
      userId: remoteStats.userId,
      audioLevel: 0, // TRTC doesn't provide audio level
      audioEnergy: 0, // TRTC doesn't provide audio energy
      audioVolume: 0, // TRTC doesn't provide audio volume
      audioBitrate: remoteStats.audioBitrate || 0,
      audioPacketLossRate: 0, // TRTC doesn't provide packet loss for remote audio
      videoBitrate: remoteStats.videoBitrate || 0,
      videoFrameRate: remoteStats.frameRate || 0,
      videoWidth: remoteStats.width || 0,
      videoHeight: remoteStats.height || 0,
      videoPacketLossRate: 0, // TRTC doesn't provide packet loss for remote video
      rtt: 0, // RTT is provided separately
      cpuUsage: 0, // TRTC doesn't provide CPU usage
      memoryUsage: 0, // TRTC doesn't provide memory usage
    };
  }

  private convertDetailedStatsToNetworkStatsFormat(detailedStats: TRTCDetailedStats): {
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
    network?: {
      rtt: number;
      packetLoss: number;
      uplinkQuality: number;
      downlinkQuality: number;
    };
  } {
    const result: {
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
      network?: {
        rtt: number;
        packetLoss: number;
        uplinkQuality: number;
        downlinkQuality: number;
      };
    } = {};

    if (detailedStats.video) {
      result.video = {
        codec: detailedStats.video.codecType,
        bitrate: detailedStats.video.receiveBitrate || detailedStats.video.sendBitrate,
        frameRate: detailedStats.video.receiveFrameRate || detailedStats.video.sendFrameRate,
        resolution: {
          width: detailedStats.video.receiveResolutionWidth || detailedStats.video.sendResolutionWidth || 0,
          height: detailedStats.video.receiveResolutionHeight || detailedStats.video.sendResolutionHeight || 0,
        },
        packetLoss: detailedStats.video.packetLossRate,
        rtt: detailedStats.video.transportDelay,
      };
    }

    if (detailedStats.audio) {
      result.audio = {
        codec: detailedStats.audio.codecType,
        bitrate: detailedStats.audio.receiveBitrate || detailedStats.audio.sendBitrate,
        packetLoss: detailedStats.audio.packetLossRate,
        volume: 0, // TRTC doesn't provide volume
        rtt: detailedStats.audio.transportDelay,
      };
    }

    if (detailedStats.network) {
      result.network = detailedStats.network;
    }

    return result;
  }

  async startCollecting(): Promise<void> {
    try {
      if (this.isCollecting) {
        logger.debug('TRTC stats collection already running');
        return;
      }

      this.isCollecting = true;

      // TRTC SDK v5 emits network quality and statistics events directly
      // No need for interval polling - events will trigger stats updates automatically
      logger.info('TRTC stats collection started - using event-driven updates');
    } catch (error) {
      logger.error('Failed to start TRTC stats collection', { error });
      throw error;
    }
  }

  async stopCollecting(): Promise<void> {
    try {
      if (!this.isCollecting) {
        logger.debug('TRTC stats collection not running');
        return;
      }

      this.isCollecting = false;

      // No interval to clear since we're using event-driven updates
      logger.info('TRTC stats collection stopped');
    } catch (error) {
      logger.error('Failed to stop TRTC stats collection', { error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC stats controller');

      await this.stopCollecting();

      // Remove event listeners
      this.client.off(TRTC.EVENT.NETWORK_QUALITY, this.handleNetworkQuality);
      this.client.off(TRTC.EVENT.STATISTICS, this.handleStatistics);

      // Clear data
      this.networkQualityData = null;
      this.localStats = null;
      this.remoteStats.clear();
      this.callbacks = {};

      logger.info('TRTC stats controller cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC stats controller cleanup', { error });
    }
  }
}
