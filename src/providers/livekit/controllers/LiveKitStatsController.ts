import { Room } from 'livekit-client';
import { logger } from '../../../core/Logger';
import {
  BaseStatsController,
  ParsedWebRTCStats,
  StatsControllerCallbacks,
} from '../../common/controllers/BaseStatsController';

export type { StatsControllerCallbacks };

export class LiveKitStatsController extends BaseStatsController {
  private room: Room;

  constructor(room: Room) {
    super();
    this.room = room;
  }

  setCallbacks(callbacks: StatsControllerCallbacks): void {
    super.setCallbacks(callbacks);
  }

  startStatsCollection(): void {
    if (this.statsCollectionInterval) {
      logger.warn('Stats collection already running');
      return;
    }

    logger.info('Starting LiveKit stats collection');

    this.statsCollectionInterval = setInterval(async () => {
      try {
        const stats = await this.collectStats();
        if (stats) {
          const networkStats = this.processStats(stats);
          this.callbacks.onNetworkStatsUpdate?.(networkStats);
        }
      } catch (error) {
        this.handleStatsError(error, 'LiveKitStatsController');
      }
    }, 1000); // Collect stats every second
  }

  stopStatsCollection(): void {
    if (this.statsCollectionInterval) {
      clearInterval(this.statsCollectionInterval);
      this.statsCollectionInterval = null;
      logger.info('Stopped LiveKit stats collection');
    }
  }

  async collectStats(): Promise<ParsedWebRTCStats | null> {
    try {
      const parsedStats: ParsedWebRTCStats = {};

      // Get stats from the room's local participant
      if (this.room.localParticipant) {
        const localParticipant = this.room.localParticipant;

        // Get video track stats - using correct LiveKit API
        const videoTracks = Array.from(localParticipant.videoTrackPublications.values());
        if (videoTracks.length > 0) {
          const videoTrackPublication = videoTracks[0];
          const videoTrack = videoTrackPublication?.track;
          if (videoTrack) {
            // Get video track stats from the underlying MediaStreamTrack
            const videoStats = await this.getTrackStats(videoTrack as unknown as MediaStreamTrack);
            if (videoStats) {
              parsedStats.video = {
                codec: videoStats.codec || 'unknown',
                bitrate: videoStats.bitrate || 0,
                frameRate: videoStats.frameRate || 0,
                resolution: {
                  width: videoStats.width || 0,
                  height: videoStats.height || 0,
                },
                packetLoss: videoStats.packetLoss || 0,
                rtt: videoStats.rtt || 0,
              };
            }
          }
        }

        // Get audio track stats - using correct LiveKit API
        const audioTracks = Array.from(localParticipant.audioTrackPublications.values());
        if (audioTracks.length > 0) {
          const audioTrackPublication = audioTracks[0];
          const audioTrack = audioTrackPublication?.track;
          if (audioTrack) {
            // Get audio track stats from the underlying MediaStreamTrack
            const audioStats = await this.getTrackStats(audioTrack as unknown as MediaStreamTrack);
            if (audioStats) {
              parsedStats.audio = {
                codec: audioStats.codec || 'unknown',
                bitrate: audioStats.bitrate || 0,
                packetLoss: audioStats.packetLoss || 0,
                rtt: audioStats.rtt || 0,
              };
            }
          }
        }

        // Get connection quality as RTT estimate
        const connectionQuality = localParticipant.connectionQuality;
        if (connectionQuality && connectionQuality !== 'unknown') {
          // Convert LiveKit connection quality to RTT estimate
          parsedStats.rtt = this.connectionQualityToRTT(connectionQuality);
        }
      }

      // logger.info('Collected LiveKit stats', {
      //   hasVideo: !!parsedStats.video,
      //   hasAudio: !!parsedStats.audio,
      //   rtt: parsedStats.rtt,
      //   videoBitrate: parsedStats.video?.bitrate,
      //   audioBitrate: parsedStats.audio?.bitrate,
      //   connectionQuality: this.room.localParticipant?.connectionQuality
      // });
      return parsedStats;
    } catch (error) {
      this.handleStatsError(error, 'collectStats');
      return null;
    }
  }

  private async getTrackStats(track: MediaStreamTrack): Promise<any> {
    try {
      // Get stats from the track's sender
      const sender = (track as any).getSender ? (track as any).getSender() : null;
      if (sender) {
        const stats = await sender.getStats();
        const statsData: any = {};

        stats.forEach((report: any) => {
          if (report.type === 'outbound-rtp') {
            statsData.bitrate = report.bytesSent * 8; // Convert to bits per second
            statsData.frameRate = report.framesPerSecond || 0;
            statsData.codec = report.codecId || 'unknown';
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            statsData.rtt = report.currentRoundTripTime * 1000; // Convert to milliseconds
            statsData.packetLoss = (report.packetsLost / (report.packetsSent + report.packetsLost)) * 100;
          }
        });

        return statsData;
      }
    } catch (error) {
      logger.debug('Failed to get track stats', { error });
    }
    return null;
  }

  private connectionQualityToRTT(quality: string): number {
    // Convert LiveKit connection quality to RTT estimate
    switch (quality) {
      case 'excellent':
        return 30;
      case 'good':
        return 60;
      case 'poor':
        return 150;
      case 'unknown':
        return 100;
      default:
        return 100;
    }
  }

  cleanup(): void {
    super.cleanup();
    logger.info('LiveKit stats controller cleanup completed');
  }
}
