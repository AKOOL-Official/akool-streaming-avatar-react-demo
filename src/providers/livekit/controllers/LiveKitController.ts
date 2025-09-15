import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  RemoteAudioTrack,
  RemoteTrackPublication,
  ConnectionQuality as LKConnectionQuality,
  Participant as LKParticipant,
} from 'livekit-client';
import { logger } from '../../../core/Logger';
import { Participant, ConnectionQuality } from '../../../types/streaming.types';
import { NetworkStats } from '../../../components/NetworkQuality';
import { CommonMessageController } from '../../common/CommonMessageController';
import { LiveKitMessageAdapter } from '../adapters/LiveKitMessageAdapter';
import { MessageProviderConfig } from '../../common/types/message.types';

// WebRTC stats interfaces
interface VideoStats {
  codec?: string;
  bitrate?: number;
  frameRate?: number;
  resolution?: { width: number; height: number };
  packetLoss?: number;
  rtt?: number;
}

interface AudioStats {
  codec?: string;
  bitrate?: number;
  packetLoss?: number;
  rtt?: number;
}

interface ParsedWebRTCStats {
  video?: VideoStats;
  audio?: AudioStats;
  rtt?: number;
}

// Unified callback interface
export interface LiveKitControllerCallbacks {
  // Event callbacks
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
  onError?: (error: Error) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;

  // Messaging callbacks (delegated to CommonMessageController)
  onCommandSent?: (cmd: string, data?: Record<string, unknown>) => void;
  onCommandResponse?: (cmd: string, code: number, message?: string) => void;
  onMessageResponse?: (response: { text: string; from: 'bot' | 'user' }) => void;
  onSystemMessage?: (event: unknown) => void;
  onChatMessage?: (event: unknown) => void;
  onCommand?: (event: unknown) => void;
  onMessageReceived?: (message: unknown) => void;
}

export class LiveKitController {
  private room: Room;
  private callbacks: LiveKitControllerCallbacks = {};
  private isListening = false;
  private statsCollectionInterval: NodeJS.Timeout | null = null;
  private currentRTT = 0;
  private currentPacketLoss = 0;
  private messageController: CommonMessageController;

  // LiveKit-specific configuration
  private static readonly LIVEKIT_CONFIG: MessageProviderConfig = {
    maxEncodedSize: 950, // Will be fixed later
    bytesPerSecond: 6000, // Will be fixed later
  };

  constructor(room: Room) {
    this.room = room;
    const messageAdapter = new LiveKitMessageAdapter(room);
    this.messageController = new CommonMessageController(messageAdapter, LiveKitController.LIVEKIT_CONFIG);
  }

  setCallbacks(callbacks: LiveKitControllerCallbacks): void {
    this.callbacks = callbacks;
    this.setupEventListeners();
    this.startStatsCollection();

    // Delegate message callbacks to CommonMessageController
    this.messageController.setCallbacks({
      onParticipantJoined: callbacks.onParticipantJoined
        ? (participant) => callbacks.onParticipantJoined?.(participant as Participant)
        : undefined,
      onParticipantLeft: callbacks.onParticipantLeft,
      onConnectionQualityChanged: callbacks.onConnectionQualityChanged
        ? (quality) => callbacks.onConnectionQualityChanged?.(quality as ConnectionQuality)
        : undefined,
      onMessageReceived: callbacks.onMessageReceived,
      onError: callbacks.onError,
      onSpeakingStateChanged: callbacks.onSpeakingStateChanged,
      onCommandSent: callbacks.onCommandSent,
      onCommandResponse: callbacks.onCommandResponse,
      onMessageResponse: callbacks.onMessageResponse,
      onSystemMessage: callbacks.onSystemMessage,
      onChatMessage: callbacks.onChatMessage,
      onCommand: callbacks.onCommand,
    });
  }

  private setupEventListeners(): void {
    if (this.isListening) return;

    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected.bind(this));
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected.bind(this));

    // Track events
    this.room.on(RoomEvent.TrackPublished, this.handleTrackPublished.bind(this));
    this.room.on(RoomEvent.TrackUnpublished, this.handleTrackUnpublished.bind(this));

    // Connection quality events
    this.room.on(RoomEvent.ConnectionQualityChanged, this.handleConnectionQualityChanged.bind(this));

    // Speaking events - temporarily disabled due to signature mismatch
    // this.room.on(RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakersChanged.bind(this));

    this.isListening = true;
    logger.info('Started listening to LiveKit events');
  }

  private handleParticipantConnected(participant: RemoteParticipant): void {
    try {
      logger.debug('LiveKit participant connected', {
        identity: participant.identity,
        sid: participant.sid,
      });

      const unifiedParticipant: Participant = this.convertToUnifiedParticipant(participant);
      this.callbacks.onParticipantJoined?.(unifiedParticipant);
    } catch (error) {
      logger.error('Error handling participant connected', {
        error: error instanceof Error ? error.message : String(error),
        identity: participant.identity,
      });
    }
  }

  private handleParticipantDisconnected(participant: RemoteParticipant): void {
    try {
      logger.debug('LiveKit participant disconnected', {
        identity: participant.identity,
        sid: participant.sid,
      });

      this.callbacks.onParticipantLeft?.(participant.sid);
    } catch (error) {
      logger.error('Error handling participant disconnected', {
        error: error instanceof Error ? error.message : String(error),
        identity: participant.identity,
      });
    }
  }

  private handleTrackPublished(publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    logger.debug('LiveKit track published', {
      trackSid: publication.trackSid,
      kind: publication.kind,
      participant: participant.identity,
    });

    // Handle remote audio track playback
    if (publication.kind === 'audio' && publication.track instanceof RemoteAudioTrack) {
      try {
        // For audio tracks, we need to attach to an audio element or use attach() method
        // LiveKit audio tracks don't have a direct play() method
        const audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        document.body.appendChild(audioElement);

        publication.track.attach(audioElement);
        logger.info('Remote audio track started playing', {
          trackSid: publication.trackSid,
          participant: participant.identity,
        });
      } catch (error) {
        logger.error('Failed to play remote audio track', {
          error: error instanceof Error ? error.message : String(error),
          trackSid: publication.trackSid,
        });
      }
    }
  }

  private handleTrackUnpublished(): void {
    // Track unpublication handling can be delegated to specific controllers
    logger.debug('LiveKit track unpublished');
  }

  private handleConnectionQualityChanged(quality: LKConnectionQuality, participant: LKParticipant): void {
    try {
      const unifiedQuality = this.convertConnectionQuality(quality);
      logger.debug('LiveKit connection quality changed', {
        quality: unifiedQuality,
        participant: participant.identity,
        originalQuality: quality,
      });
      this.callbacks.onConnectionQualityChanged?.(unifiedQuality);
    } catch (error) {
      logger.error('Error handling connection quality change', {
        error: error instanceof Error ? error.message : String(error),
        participant: participant.identity,
        quality,
      });
    }
  }

  // private handleActiveSpeakersChanged(speakers: (LocalParticipant | RemoteParticipant)[]): void {
  //   try {
  //     const isSpeaking = speakers.length > 0;
  //     logger.debug('LiveKit active speakers changed', { speakerCount: speakers.length, isSpeaking });
  //     this.callbacks.onSpeakingStateChanged?.(isSpeaking);
  //   } catch (error) {
  //     logger.error('Error handling active speakers change', { error: error instanceof Error ? error.message : String(error) });
  //   }
  // }

  // Message handling is now delegated to CommonMessageController

  // Message handling methods - delegated to CommonMessageController
  async sendMessage(messageId: string, content: string): Promise<void> {
    return this.messageController.sendMessage(messageId, content);
  }

  async interruptResponse(): Promise<void> {
    return this.messageController.interruptResponse();
  }

  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    return this.messageController.setAvatarParameters(metadata);
  }

  private convertToUnifiedParticipant(participant: RemoteParticipant | LocalParticipant): Participant {
    return {
      id: participant.sid,
      displayName: participant.identity,
      isLocal: participant instanceof LocalParticipant,
      audioTracks: [], // Will be populated by track controllers
      videoTracks: [], // Will be populated by track controllers
      connectionQuality: { score: 0, uplink: 'poor', downlink: 'poor', rtt: 0, packetLoss: 0 }, // Will be updated by connection quality events
    };
  }

  private convertConnectionQuality(quality: LKConnectionQuality): ConnectionQuality {
    // Use real RTT data if available, otherwise fall back to estimated values
    const rtt = this.currentRTT > 0 ? this.currentRTT : this.getEstimatedRTT(quality);
    const packetLoss = this.currentPacketLoss > 0 ? this.currentPacketLoss : this.getEstimatedPacketLoss(quality);

    switch (quality) {
      case LKConnectionQuality.Excellent:
        return { score: 100, uplink: 'excellent', downlink: 'excellent', rtt, packetLoss };
      case LKConnectionQuality.Good:
        return { score: 75, uplink: 'good', downlink: 'good', rtt, packetLoss };
      case LKConnectionQuality.Poor:
        return { score: 50, uplink: 'fair', downlink: 'fair', rtt, packetLoss };
      case LKConnectionQuality.Lost:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt, packetLoss };
      case LKConnectionQuality.Unknown:
      default:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt, packetLoss };
    }
  }

  private getEstimatedRTT(quality: LKConnectionQuality): number {
    switch (quality) {
      case LKConnectionQuality.Excellent:
        return 30;
      case LKConnectionQuality.Good:
        return 60;
      case LKConnectionQuality.Poor:
        return 150;
      case LKConnectionQuality.Lost:
        return 500;
      default:
        return 0;
    }
  }

  private getEstimatedPacketLoss(quality: LKConnectionQuality): number {
    switch (quality) {
      case LKConnectionQuality.Excellent:
        return 0;
      case LKConnectionQuality.Good:
        return 1;
      case LKConnectionQuality.Poor:
        return 5;
      case LKConnectionQuality.Lost:
        return 20;
      default:
        return 0;
    }
  }

  private startStatsCollection(): void {
    if (this.statsCollectionInterval) return;

    // Collect stats every 2 seconds
    this.statsCollectionInterval = setInterval(() => {
      this.collectWebRTCStats();
    }, 2000);

    logger.info('Started LiveKit WebRTC stats collection');
  }

  private stopStatsCollection(): void {
    if (this.statsCollectionInterval) {
      clearInterval(this.statsCollectionInterval);
      this.statsCollectionInterval = null;
      logger.info('Stopped LiveKit WebRTC stats collection');
    }
  }

  private async collectWebRTCStats(): Promise<void> {
    try {
      // Check if room is connected
      if (!this.room || this.room.state !== 'connected') {
        logger.debug('Room not connected, skipping stats collection');
        return;
      }

      // Check if there are remote participants
      const remoteParticipants = Array.from(this.room.remoteParticipants.values());
      if (remoteParticipants.length === 0) {
        logger.debug('No remote participants found, skipping stats collection');
        return;
      }

      let statsCollected = false;
      let videoStats: VideoStats | null = null;
      let audioStats: AudioStats | null = null;

      // Try to get stats from remote tracks
      for (const participant of remoteParticipants) {
        const videoTracks = Array.from(participant.videoTrackPublications.values());
        const audioTracks = Array.from(participant.audioTrackPublications.values());

        // Get video track stats
        for (const publication of videoTracks) {
          if (publication.track && publication.isSubscribed) {
            try {
              const track = publication.track as { receiver?: { getStats(): Promise<RTCStatsReport> } };
              if (track.receiver) {
                const stats = await track.receiver.getStats();
                const metricsData = this.parseWebRTCStats(stats);
                if (metricsData) {
                  videoStats = metricsData;
                  statsCollected = true;
                  break;
                }
              }
            } catch (error) {
              logger.debug('Error getting video track stats', {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        // Get audio track stats
        for (const publication of audioTracks) {
          if (publication.track && publication.isSubscribed) {
            try {
              const track = publication.track as { receiver?: { getStats(): Promise<RTCStatsReport> } };
              if (track.receiver) {
                const stats = await track.receiver.getStats();
                const metricsData = this.parseWebRTCStats(stats);
                if (metricsData) {
                  audioStats = metricsData;
                  statsCollected = true;
                  break;
                }
              }
            } catch (error) {
              logger.debug('Error getting audio track stats', {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        if (statsCollected) break;
      }

      if (statsCollected) {
        this.updateNetworkStatsFromMetrics(videoStats, audioStats);
      }
    } catch (error) {
      logger.error('Error collecting WebRTC stats', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private parseWebRTCStats(stats: RTCStatsReport): ParsedWebRTCStats | null {
    try {
      const metrics: ParsedWebRTCStats = {};

      for (const [, stat] of stats) {
        if (stat.type === 'inbound-rtp') {
          // Video or audio inbound stats
          if (stat.kind === 'video') {
            metrics.video = {
              codec: stat.codecId || 'unknown',
              bitrate: stat.bytesReceived ? (stat.bytesReceived * 8) / 2000 : 0, // Convert to kbps
              frameRate: stat.framesPerSecond || 0,
              resolution: {
                width: stat.frameWidth || 0,
                height: stat.frameHeight || 0,
              },
              packetLoss: stat.packetsLost ? (stat.packetsLost / (stat.packetsReceived + stat.packetsLost)) * 100 : 0,
              rtt: stat.roundTripTime ? stat.roundTripTime * 1000 : 0, // Convert to ms
            };
          } else if (stat.kind === 'audio') {
            metrics.audio = {
              codec: stat.codecId || 'unknown',
              bitrate: stat.bytesReceived ? (stat.bytesReceived * 8) / 2000 : 0, // Convert to kbps
              packetLoss: stat.packetsLost ? (stat.packetsLost / (stat.packetsReceived + stat.packetsLost)) * 100 : 0,
              rtt: stat.roundTripTime ? stat.roundTripTime * 1000 : 0, // Convert to ms
            };
          }
        } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
          // RTT from candidate pair
          if (stat.currentRoundTripTime) {
            metrics.rtt = stat.currentRoundTripTime * 1000; // Convert to ms
          }
        }
      }

      return Object.keys(metrics).length > 0 ? metrics : null;
    } catch (error) {
      logger.error('Error parsing WebRTC stats', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private updateNetworkStatsFromMetrics(videoStats: VideoStats | null, audioStats: AudioStats | null): void {
    try {
      // Extract RTT and packet loss from stats
      const videoRTT = videoStats?.rtt || 0;
      const audioRTT = audioStats?.rtt || 0;
      const videoPacketLoss = videoStats?.packetLoss || 0;
      const audioPacketLoss = audioStats?.packetLoss || 0;

      // Use the most recent RTT data
      this.currentRTT = videoRTT > 0 ? videoRTT : audioRTT;
      this.currentPacketLoss = videoPacketLoss > 0 ? videoPacketLoss : audioPacketLoss;

      // Create network stats update
      const networkStats: NetworkStats = {
        connectionQuality: this.convertConnectionQuality(LKConnectionQuality.Unknown), // Will be updated by connection quality events
        detailedStats: {
          video: videoStats
            ? {
                codec: videoStats.codec,
                bitrate: videoStats.bitrate,
                frameRate: videoStats.frameRate,
                resolution: videoStats.resolution,
                packetLoss: videoStats.packetLoss,
                rtt: videoStats.rtt,
              }
            : undefined,
          audio: audioStats
            ? {
                codec: audioStats.codec,
                bitrate: audioStats.bitrate,
                packetLoss: audioStats.packetLoss,
                rtt: audioStats.rtt,
              }
            : undefined,
        },
      };

      this.callbacks.onNetworkStatsUpdate?.(networkStats);
    } catch (error) {
      logger.error('Error updating network stats from metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  cleanup(): void {
    logger.debug('Cleaning up LiveKit controller');

    // Stop stats collection
    this.stopStatsCollection();

    // Remove all event listeners
    this.room.removeAllListeners(RoomEvent.ParticipantConnected);
    this.room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    this.room.removeAllListeners(RoomEvent.TrackPublished);
    this.room.removeAllListeners(RoomEvent.TrackUnpublished);
    this.room.removeAllListeners(RoomEvent.ConnectionQualityChanged);
    // this.room.removeAllListeners(RoomEvent.ActiveSpeakersChanged);

    // Clean up message controller
    this.messageController.cleanup();

    this.isListening = false;
    this.callbacks = {};

    logger.info('LiveKit controller cleanup completed');
  }
}
