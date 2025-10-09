import { logger } from '../../../core/Logger';
import { NetworkStats } from '../../../components/NetworkQuality';

// WebRTC stats interfaces
export interface VideoStats {
  codec?: string;
  bitrate?: number;
  frameRate?: number;
  resolution?: { width: number; height: number };
  packetLoss?: number;
  rtt?: number;
}

export interface AudioStats {
  codec?: string;
  bitrate?: number;
  packetLoss?: number;
  rtt?: number;
}

export interface ParsedWebRTCStats {
  video?: VideoStats;
  audio?: AudioStats;
  network?: {
    rtt?: number;
    packetLoss?: number;
  };
  rtt?: number;
}

// Stats controller callback interface
export interface StatsControllerCallbacks {
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
  onError?: (error: Error) => void;
}

// Abstract base class for WebRTC stats collection
export abstract class BaseStatsController {
  protected callbacks: StatsControllerCallbacks = {};
  protected statsCollectionInterval: NodeJS.Timeout | null = null;
  protected currentRTT = 0;
  protected currentPacketLoss = 0;

  constructor() {}

  setCallbacks(callbacks: StatsControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  // Abstract methods to be implemented by provider-specific controllers
  abstract startStatsCollection(): void;
  abstract stopStatsCollection(): void;
  abstract collectStats(): Promise<ParsedWebRTCStats | null>;

  // Common stats processing methods
  protected processStats(stats: ParsedWebRTCStats): NetworkStats {
    const connectionQuality = this.calculateConnectionQuality(stats);
    const detailedStats = this.createDetailedStats(stats);

    const networkStats = {
      connectionQuality,
      detailedStats,
    };

    // logger.info('Processed network stats', {
    //   connectionQuality,
    //   hasDetailedStats: !!detailedStats,
    //   videoStats: detailedStats?.video,
    //   audioStats: detailedStats?.audio,
    //   networkStats: detailedStats?.network
    // });

    return networkStats;
  }

  protected calculateConnectionQuality(stats: ParsedWebRTCStats): {
    score: number;
    uplink: 'excellent' | 'good' | 'fair' | 'poor';
    downlink: 'excellent' | 'good' | 'fair' | 'poor';
    rtt: number;
    packetLoss: number;
  } {
    const rtt = stats.rtt || this.currentRTT;
    const packetLoss = this.calculatePacketLoss(stats);

    // Update current values
    this.currentRTT = rtt;
    this.currentPacketLoss = packetLoss;

    // Calculate quality score based on RTT and packet loss
    let score = 100;

    // RTT scoring (lower is better)
    if (rtt > 300) score -= 40;
    else if (rtt > 150) score -= 20;
    else if (rtt > 100) score -= 10;

    // Packet loss scoring (lower is better)
    if (packetLoss > 10) score -= 30;
    else if (packetLoss > 5) score -= 20;
    else if (packetLoss > 1) score -= 10;

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine quality levels
    const uplink = this.getQualityLevel(score);
    const downlink = this.getQualityLevel(score);

    return {
      score,
      uplink,
      downlink,
      rtt,
      packetLoss,
    };
  }

  protected calculatePacketLoss(stats: ParsedWebRTCStats): number {
    // Use video packet loss if available, otherwise audio
    const videoLoss = stats.video?.packetLoss || 0;
    const audioLoss = stats.audio?.packetLoss || 0;

    // Return the higher packet loss value
    return Math.max(videoLoss, audioLoss);
  }

  protected getQualityLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  protected createDetailedStats(stats: ParsedWebRTCStats): {
    video?: {
      codec?: string;
      bitrate?: number;
      frameRate?: number;
      resolution?: { width: number; height: number };
    };
    audio?: {
      codec?: string;
      bitrate?: number;
    };
    network?: {
      rtt?: number;
      packetLoss?: number;
    };
  } {
    const detailedStats: {
      video?: {
        codec?: string;
        bitrate?: number;
        frameRate?: number;
        resolution?: { width: number; height: number };
        rtt?: number;
      };
      audio?: {
        codec?: string;
        bitrate?: number;
        rtt?: number;
      };
      network?: {
        rtt: number;
        packetLoss: number;
        uplinkQuality: number;
        downlinkQuality: number;
      };
    } = {};

    if (stats.video) {
      detailedStats.video = {
        codec: stats.video.codec,
        bitrate: stats.video.bitrate,
        frameRate: stats.video.frameRate,
        resolution: stats.video.resolution,
        rtt: stats.video.rtt, // Include RTT for video
      };
    }

    if (stats.audio) {
      detailedStats.audio = {
        codec: stats.audio.codec,
        bitrate: stats.audio.bitrate,
        rtt: stats.audio.rtt, // Include RTT for audio
      };
    }

    if (stats.network || stats.rtt !== undefined || this.currentPacketLoss > 0) {
      detailedStats.network = {
        rtt: stats.network?.rtt || stats.rtt || 0,
        packetLoss: stats.network?.packetLoss || this.currentPacketLoss,
        uplinkQuality: 0, // Default value
        downlinkQuality: 0, // Default value
      };
    }

    return detailedStats;
  }

  protected handleStatsError(error: unknown, context: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Stats collection error in ${context}`, {
      error: errorMessage,
      context,
    });

    const errorObj = error instanceof Error ? error : new Error(errorMessage);
    this.callbacks.onError?.(errorObj);
  }

  cleanup(): void {
    this.stopStatsCollection();
    this.callbacks = {};
    logger.info('Base stats controller cleanup completed');
  }
}
