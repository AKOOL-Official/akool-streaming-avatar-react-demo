import { logger } from '../../../core/Logger';
// import { BaseStatsController, StatsControllerCallbacks } from '../../common/controllers/BaseStatsController';
import { NetworkStats } from '../../../components/NetworkQuality';
import { TRTCNetworkQuality, TRTCLocalStatistics, TRTCRemoteStatistics, TRTCStatsControllerCallbacks } from '../types';

// TRTC SDK v5 client interface (simplified)
interface TRTCClient {
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
  getNetworkQuality(): Promise<TRTCNetworkQuality>;
}

export class TRTCStatsController {
  private client: TRTCClient;
  private callbacks: TRTCStatsControllerCallbacks = {};
  private statsInterval: number | null = null;
  private networkQualityData: TRTCNetworkQuality | null = null;
  private localStats: TRTCLocalStatistics | null = null;
  private remoteStats = new Map<string, TRTCRemoteStatistics>();
  private isCollecting = false;
  private readonly updateInterval: number;

  constructor(client: TRTCClient, updateInterval = 1000) {
    this.client = client;
    this.updateInterval = updateInterval;
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
    this.callbacks.onNetworkStatsUpdate?.(stats);
  }

  private setupEventHandlers(): void {
    // Network quality events
    this.client.on('onNetworkQuality', (...args: unknown[]) => {
      const [localQuality, remoteQuality] = args as [TRTCNetworkQuality, TRTCNetworkQuality[]];
      try {
        this.networkQualityData = localQuality;

        logger.debug('TRTC network quality update', {
          local: localQuality,
          remoteCount: remoteQuality?.length || 0,
        });

        // Trigger immediate stats update
        this.triggerStatsCollection();
      } catch (error) {
        logger.error('Failed to handle TRTC network quality update', { error });
      }
    });

    // Local statistics events
    this.client.on('onStatistics', (...args: unknown[]) => {
      const statistics = args[0] as {
        localStatistics?: TRTCLocalStatistics;
        remoteStatistics?: TRTCRemoteStatistics[];
      };
      try {
        if (statistics.localStatistics) {
          this.localStats = statistics.localStatistics;
          this.callbacks.onLocalStatsUpdate?.(statistics.localStatistics);
        }

        if (statistics.remoteStatistics) {
          statistics.remoteStatistics.forEach((stat) => {
            this.remoteStats.set(stat.userId, stat);
            this.callbacks.onRemoteStatsUpdate?.(stat.userId, stat);
          });
        }

        logger.debug('TRTC statistics update', {
          hasLocal: !!statistics.localStatistics,
          remoteCount: statistics.remoteStatistics?.length || 0,
        });

        // Trigger immediate stats update
        this.triggerStatsCollection();
      } catch (error) {
        logger.error('Failed to handle TRTC statistics update', { error });
      }
    });

    // Speed test events (if available)
    this.client.on('onSpeedTest', (result: any) => {
      try {
        logger.info('TRTC speed test result', { result });

        // Convert speed test to network quality for immediate feedback
        if (result.success) {
          const speedTestQuality: TRTCNetworkQuality = {
            userId: '',
            txQuality: this.mapQualityFromRTT(result.rtt),
            rxQuality: this.mapQualityFromRTT(result.rtt),
            delay: result.rtt,
            lossRate: (result.upLostRate + result.downLostRate) / 2,
          };

          this.networkQualityData = speedTestQuality;
          this.triggerStatsCollection();
        }
      } catch (error) {
        logger.error('Failed to handle TRTC speed test result', { error });
      }
    });
  }

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

    // Network quality mapping
    if (networkQuality) {
      baseStats.localNetwork = {
        uplinkNetworkQuality: networkQuality.txQuality,
        downlinkNetworkQuality: networkQuality.rxQuality,
      };

      baseStats.connection = {
        roundTripTime: networkQuality.delay,
        packetLossRate: networkQuality.lossRate,
      };
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

    return baseStats;
  }

  private mapQualityFromRTT(rtt: number): number {
    // Map RTT to TRTC quality scale (1-6, where 6 is best)
    if (rtt < 50) return 6; // Excellent
    if (rtt < 100) return 5; // Good
    if (rtt < 200) return 4; // Fair
    if (rtt < 400) return 3; // Poor
    if (rtt < 800) return 2; // Bad
    return 1; // Very bad
  }

  async startCollecting(): Promise<void> {
    try {
      if (this.isCollecting) {
        logger.debug('TRTC stats collection already running');
        return;
      }

      this.isCollecting = true;

      // Start additional TRTC-specific collection
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
      }

      this.statsInterval = window.setInterval(async () => {
        try {
          // Manually trigger network quality check if needed
          // TRTC v5 may not have automatic quality reporting
          await this.triggerStatsCollection();
        } catch (error) {
          logger.error('Error during TRTC stats collection interval', { error });
        }
      }, this.updateInterval);

      logger.info('TRTC stats collection started');
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

      if (this.statsInterval) {
        clearInterval(this.statsInterval);
        this.statsInterval = null;
      }

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
      this.client.off('onNetworkQuality');
      this.client.off('onStatistics');
      this.client.off('onSpeedTest');

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
