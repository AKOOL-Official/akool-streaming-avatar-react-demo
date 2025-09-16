import { logger } from '../../../core/Logger';
import { NetworkStats } from '../../../components/NetworkQuality';
import { TRTCNetworkQuality, TRTCLocalStatistics, TRTCRemoteStatistics, TRTCStatsControllerCallbacks } from '../types';
import TRTC, { NetworkQuality, TRTCStatistics } from 'trtc-sdk-v5';

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
        this.callbacks.onLocalStatsUpdate?.(this.localStats);
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
          this.callbacks.onRemoteStatsUpdate?.(stat.userId, remoteStats);
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
      if ('uplinkNetworkQuality' in networkQuality) {
        baseStats.localNetwork = {
          uplinkNetworkQuality: (networkQuality as any).uplinkNetworkQuality,
          downlinkNetworkQuality: (networkQuality as any).downlinkNetworkQuality,
        };

        baseStats.connection = {
          roundTripTime: (networkQuality as any).downlinkRTT || (networkQuality as any).uplinkRTT || 0,
          packetLossRate: (networkQuality as any).downlinkLoss || (networkQuality as any).uplinkLoss || 0,
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
    baseStats.detailedStats = this.createDetailedStats(networkQuality, localStats, remoteStats);

    return baseStats;
  }

  private createDetailedStats(
    networkQuality: TRTCNetworkQuality | null,
    localStats: TRTCLocalStatistics | null,
    remoteStats: Map<string, TRTCRemoteStatistics>,
  ) {
    const detailedStats: any = {};

    // Video detailed stats - prioritize remote stats for better metrics
    if (remoteStats.size > 0) {
      const primaryRemote = Array.from(remoteStats.values())[0];
      if (primaryRemote) {
        detailedStats.video = {
          codec: 'H264', // TRTC typically uses H264
          bitrate: primaryRemote.videoBitrate || 0,
          frameRate: primaryRemote.frameRate || 0,
          resolution: {
            width: primaryRemote.width || 0,
            height: primaryRemote.height || 0,
          },
          packetLoss: this.getNetworkQualityLoss(networkQuality),
          rtt: this.getNetworkQualityRTT(networkQuality),
        };
      }
    } else if (localStats) {
      detailedStats.video = {
        codec: 'H264',
        bitrate: localStats.videoBitrate || 0,
        frameRate: localStats.frameRate || 0,
        resolution: {
          width: localStats.width || 0,
          height: localStats.height || 0,
        },
        packetLoss: this.getNetworkQualityLoss(networkQuality),
        rtt: this.getNetworkQualityRTT(networkQuality),
      };
    }

    // Audio detailed stats - prioritize remote stats for better metrics
    if (remoteStats.size > 0) {
      const primaryRemote = Array.from(remoteStats.values())[0];
      if (primaryRemote) {
        detailedStats.audio = {
          codec: 'OPUS', // TRTC typically uses OPUS
          bitrate: primaryRemote.audioBitrate || 0,
          packetLoss: this.getNetworkQualityLoss(networkQuality),
          volume: 0, // TRTC doesn't provide volume in stats
          rtt: this.getNetworkQualityRTT(networkQuality),
        };
      }
    } else if (localStats) {
      detailedStats.audio = {
        codec: 'OPUS',
        bitrate: localStats.audioBitrate || 0,
        packetLoss: this.getNetworkQualityLoss(networkQuality),
        volume: 0,
        rtt: this.getNetworkQualityRTT(networkQuality),
      };
    }

    // Network detailed stats
    if (networkQuality) {
      detailedStats.network = {
        rtt: this.getNetworkQualityRTT(networkQuality),
        packetLoss: this.getNetworkQualityLoss(networkQuality),
      };
    }

    return detailedStats;
  }

  private getNetworkQualityRTT(networkQuality: TRTCNetworkQuality | null): number {
    if (!networkQuality) return 0;

    // Handle both old and new data structures
    if ('downlinkRTT' in networkQuality) {
      return (networkQuality as any).downlinkRTT || (networkQuality as any).uplinkRTT || 0;
    }
    return networkQuality.delay || 0;
  }

  private getNetworkQualityLoss(networkQuality: TRTCNetworkQuality | null): number {
    if (!networkQuality) return 0;

    // Handle both old and new data structures
    if ('downlinkLoss' in networkQuality) {
      return (networkQuality as any).downlinkLoss || (networkQuality as any).uplinkLoss || 0;
    }
    return networkQuality.lossRate || 0;
  }

  // Note: mapQualityFromRTT function removed as SPEED_TEST event is not available

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
