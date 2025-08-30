import {
  Room,
  LocalVideoTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  ConnectionQuality,
  RoomEvent,
} from 'livekit-client';
import {
  StreamProviderType,
  StreamingEventHandlers,
  VideoTrack,
  ParticipantInfo,
  CommandPayload,
  Metadata,
  NetworkQuality,
} from '../types/streamingProvider';
import { BaseStreamingProvider } from './BaseStreamingProvider';
import { LivekitCredentials, Credentials } from '../apiService';
import { createLiveKitStats } from '../components/NetworkQuality/converters';
import {
  setAvatarParams,
  interruptResponse,
  sendMessageToAvatar,
  registerMessageHandlers,
  unregisterMessageHandlers,
} from '../livekitHelper';
import { log } from '../utils/messageUtils';

export class LiveKitStreamingProvider extends BaseStreamingProvider {
  public readonly providerType: StreamProviderType = 'livekit';
  private room: Room;
  private localConnectionQuality: number = 0;
  private remoteConnectionQuality: number = 0;
  private statsCollectionInterval: NodeJS.Timeout | null = null;

  constructor(room: Room) {
    super();
    log('LiveKitStreamingProvider constructor called');

    this.room = room;
    this.setupEventListeners();
  }

  private updateNetworkStats() {
    // Create LiveKit network stats with available quality information
    const remoteStats = createLiveKitStats(this.localConnectionQuality, this.remoteConnectionQuality);

    this.updateState({ remoteStats });
  }

  private combineVideoAndAudioStats(audioMetrics: unknown) {
    try {
      // Get current stats and add audio to them
      const currentStats = this._state.remoteStats;
      if (currentStats) {
        const audioStats = this.extractAudioStats(audioMetrics);
        if (audioStats) {
          log('Combining audio stats with existing video stats');
          
          // Directly enhance existing stats instead of recreating them
          const enhancedAudioStats = this.createEnhancedLiveKitStats(null, audioStats);
          
          const combinedStats = {
            ...currentStats,
            audio: enhancedAudioStats.audio,
          };
          
          this.updateState({ remoteStats: combinedStats });
          log('Combined video and audio stats successfully:', combinedStats);
        }
      }
    } catch (error) {
      log('Error combining audio stats:', error);
    }
  }

  private updateNetworkStatsFromMetrics(metrics: unknown) {
    try {
      // Extract video and audio stats from metrics
      const videoStats = this.extractVideoStats(metrics);
      const audioStats = this.extractAudioStats(metrics);

      log('Extracted video stats:', videoStats);
      log('Extracted audio stats:', audioStats);

      // Create enhanced network stats with detailed metrics
      const remoteStats = this.createEnhancedLiveKitStats(videoStats, audioStats);

      this.updateState({ remoteStats });

      log('Updated LiveKit stats - video:', !!remoteStats.video, 'audio:', !!remoteStats.audio);
      
      // Debug specific delay values that reach the UI
      if (remoteStats.video) {
        log('Video delays in final stats:', {
          end2EndDelay: remoteStats.video.end2EndDelay,
          receiveDelay: remoteStats.video.receiveDelay,
          transportDelay: remoteStats.video.transportDelay
        });
      }
      if (remoteStats.audio) {
        log('Audio delays in final stats:', {
          end2EndDelay: remoteStats.audio.end2EndDelay,
          receiveDelay: remoteStats.audio.receiveDelay,
          transportDelay: remoteStats.audio.transportDelay
        });
      }
      
      // Trigger state sync notification if handlers are available
      if (this.handlers?.onNetworkQuality) {
        this.handlers.onNetworkQuality({
          uplinkQuality: this.localConnectionQuality,
          downlinkQuality: this.remoteConnectionQuality
        });
      }
    } catch (error) {
      log('Error processing LiveKit metrics:', error);
      // Fallback to basic stats if metrics processing fails
      this.updateNetworkStats();
    }
  }

  private extractVideoStats(metrics: unknown): unknown {
    // LiveKit metrics might contain video sender/receiver stats
    // Look for video-related metrics in the metrics object
    if (metrics && typeof metrics === 'object') {
      // Try to find video receiver stats
      for (const [key, value] of Object.entries(metrics)) {
        if (key.includes('video') && value && typeof value === 'object') {
          const stats = value as Record<string, unknown>;
          // Look for standard WebRTC stats properties
          if (stats.kind === 'video' || stats.mediaType === 'video') {
            return {
              codecName: stats.codecName || stats.mimeType,
              framesReceived: stats.framesReceived,
              framesDecoded: stats.framesDecoded,
              frameWidth: stats.frameWidth,
              frameHeight: stats.frameHeight,
              framerate: stats.framerate || stats.framesPerSecond,
              bytesReceived: stats.bytesReceived,
              packetsReceived: stats.packetsReceived,
              packetsLost: stats.packetsLost,
              jitter: stats.jitter,
              totalDecodeTime: stats.totalDecodeTime,
              // Add more delay-related properties
              playoutDelay: stats.playoutDelay,
              processingDelay: stats.processingDelay,
              totalProcessingDelay: stats.totalProcessingDelay,
              totalInterFrameDelay: stats.totalInterFrameDelay,
              totalAssemblyTime: stats.totalAssemblyTime,
            };
          }
        }
      }
    }
    return null;
  }

  private extractAudioStats(metrics: unknown): unknown {
    // Look for audio-related metrics
    if (metrics && typeof metrics === 'object') {
      for (const [key, value] of Object.entries(metrics)) {
        if (key.includes('audio') && value && typeof value === 'object') {
          const stats = value as Record<string, unknown>;
          if (stats.kind === 'audio' || stats.mediaType === 'audio') {
            return {
              codecName: stats.codecName || stats.mimeType,
              bytesReceived: stats.bytesReceived,
              packetsReceived: stats.packetsReceived,
              packetsLost: stats.packetsLost,
              jitter: stats.jitter,
              audioLevel: stats.audioLevel,
              totalAudioEnergy: stats.totalAudioEnergy,
              // Add more delay-related properties
              playoutDelay: stats.playoutDelay,
              processingDelay: stats.processingDelay,
              totalProcessingDelay: stats.totalProcessingDelay,
              totalSamplesReceived: stats.totalSamplesReceived,
              concealedSamples: stats.concealedSamples,
            };
          }
        }
      }
    }
    return null;
  }

  private createEnhancedLiveKitStats(videoStats: unknown, audioStats: unknown) {
    const baseStats = createLiveKitStats(this.localConnectionQuality, this.remoteConnectionQuality);

    log('Creating enhanced stats with video:', !!videoStats, 'audio:', !!audioStats);

    // Enhance with detailed metrics if available
    if (videoStats && typeof videoStats === 'object') {
      const vStats = videoStats as Record<string, unknown>;
      log('Processing video stats keys:', Object.keys(vStats));
      
      // Calculate proper delay metrics from WebRTC stats
      const calculateDelay = () => {
        // Use playout delay if available (most accurate for end-to-end)
        if (typeof vStats.playoutDelay === 'number' && vStats.playoutDelay > 0) {
          return vStats.playoutDelay * 1000; // Convert to ms
        }
        // Use processing delay if available
        if (typeof vStats.processingDelay === 'number' && vStats.processingDelay > 0) {
          return vStats.processingDelay * 1000; // Convert to ms
        }
        // Use total processing delay if available
        if (typeof vStats.totalProcessingDelay === 'number' && vStats.totalProcessingDelay > 0) {
          return vStats.totalProcessingDelay * 1000; // Convert to ms
        }
        // Fallback to jitter if no other delay metrics available
        if (typeof vStats.jitter === 'number' && vStats.jitter > 0) {
          return vStats.jitter * 1000; // Convert to ms
        }
        return 0;
      };

      const calculatedDelay = calculateDelay();
      log('Video delay calculation - playoutDelay:', vStats.playoutDelay, 'processingDelay:', vStats.processingDelay, 'jitter:', vStats.jitter, 'calculated:', calculatedDelay);
      
      const videoStatsObj = {
        codecType: vStats.codecName as string,
        receiveFrameRate: vStats.framerate as number,
        receiveResolutionWidth: vStats.frameWidth as number,
        receiveResolutionHeight: vStats.frameHeight as number,
        receiveBitrate: vStats.bytesReceived ? (vStats.bytesReceived as number) * 8 : undefined, // Convert bytes to bits
        packetLossRate: this.calculatePacketLossRate(vStats.packetsReceived as number, vStats.packetsLost as number),
        end2EndDelay: calculatedDelay,
        receiveDelay: calculatedDelay,
        transportDelay: calculatedDelay,
      };
      
      // Only add video stats if we have meaningful data
      const hasVideoData = videoStatsObj.codecType || videoStatsObj.receiveFrameRate || videoStatsObj.receiveBitrate;
      if (hasVideoData) {
        baseStats.video = videoStatsObj;
        log('Added video stats with codec:', videoStatsObj.codecType);
      } else {
        log('Video stats extracted but no meaningful data found');
      }
    }

    if (audioStats && typeof audioStats === 'object') {
      const aStats = audioStats as Record<string, unknown>;
      log('Processing audio stats keys:', Object.keys(aStats));
      
      // Calculate proper delay metrics for audio
      const calculateAudioDelay = () => {
        // Use playout delay if available (most accurate for end-to-end)
        if (typeof aStats.playoutDelay === 'number' && aStats.playoutDelay > 0) {
          return aStats.playoutDelay * 1000; // Convert to ms
        }
        // Use processing delay if available
        if (typeof aStats.processingDelay === 'number' && aStats.processingDelay > 0) {
          return aStats.processingDelay * 1000; // Convert to ms
        }
        // Use total processing delay if available
        if (typeof aStats.totalProcessingDelay === 'number' && aStats.totalProcessingDelay > 0) {
          return aStats.totalProcessingDelay * 1000; // Convert to ms
        }
        // Fallback to jitter if no other delay metrics available
        if (typeof aStats.jitter === 'number' && aStats.jitter > 0) {
          return aStats.jitter * 1000; // Convert to ms
        }
        return 0;
      };

      const calculatedAudioDelay = calculateAudioDelay();
      log('Audio delay calculation - playoutDelay:', aStats.playoutDelay, 'processingDelay:', aStats.processingDelay, 'jitter:', aStats.jitter, 'calculated:', calculatedAudioDelay);

      const audioStatsObj = {
        codecType: aStats.codecName as string,
        receiveBitrate: aStats.bytesReceived ? (aStats.bytesReceived as number) * 8 : undefined,
        packetLossRate: this.calculatePacketLossRate(aStats.packetsReceived as number, aStats.packetsLost as number),
        end2EndDelay: calculatedAudioDelay,
        receiveDelay: calculatedAudioDelay,
        receiveLevel: aStats.audioLevel as number,
        transportDelay: calculatedAudioDelay,
      };
      
      // Only add audio stats if we have meaningful data
      const hasAudioData = audioStatsObj.codecType || audioStatsObj.receiveBitrate || (audioStatsObj.receiveLevel !== undefined);
      if (hasAudioData) {
        baseStats.audio = audioStatsObj;
        log('Added audio stats with codec:', audioStatsObj.codecType);
      } else {
        log('Audio stats extracted but no meaningful data found');
      }
    }

    log('Final enhanced stats object:', baseStats);
    return baseStats;
  }

  private calculatePacketLossRate(packetsReceived?: number, packetsLost?: number): number | undefined {
    if (packetsReceived !== undefined && packetsLost !== undefined && packetsReceived > 0) {
      const totalPackets = packetsReceived + packetsLost;
      return (packetsLost / totalPackets) * 100;
    }
    return undefined;
  }

  private startStatsCollection() {
    // Start collecting stats every 2 seconds
    log('startStatsCollection called, room state:', this.room.state);

    if (this.statsCollectionInterval) {
      log('Clearing existing stats collection interval');
      clearInterval(this.statsCollectionInterval);
    }

    // Only start if room is connected
    if (this.room.state !== 'connected') {
      log('Room not connected, not starting stats collection');
      return;
    }

    // Check if there are remote participants before starting stats collection
    const remoteParticipants = Array.from(this.room.remoteParticipants.values());
    if (remoteParticipants.length === 0) {
      log('No remote participants yet, delaying stats collection');
      return;
    }

    log('Starting stats collection interval with', remoteParticipants.length, 'remote participants');
    this.statsCollectionInterval = setInterval(() => {
      this.collectWebRTCStats();
    }, 2000);
  }

  private stopStatsCollection() {
    if (this.statsCollectionInterval) {
      log('Stopping stats collection interval');
      clearInterval(this.statsCollectionInterval);
      this.statsCollectionInterval = null;
    } else {
      log('No stats collection interval to stop');
    }
  }

  private async collectWebRTCStats() {
    try {
      // Check if room is connected first
      if (!this.room || this.room.state !== 'connected') {
        log('Room not connected, skipping stats collection');
        return;
      }

      // Check if there are remote participants before attempting stats collection
      const remoteParticipants = Array.from(this.room.remoteParticipants.values());
      if (remoteParticipants.length === 0) {
        // Stop stats collection if no remote participants - no point in continuing
        log('No remote participants found, stopping stats collection');
        this.stopStatsCollection();
        return;
      }

      // Try to get stats from remote tracks directly (more reliable approach)
      let statsCollected = false;
      
      for (const participant of remoteParticipants) {
        const videoTracks = Array.from(participant.videoTrackPublications.values());
        const audioTracks = Array.from(participant.audioTrackPublications.values());
        
        log(`Checking participant ${participant.identity}: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
        
        // Try to get stats from video tracks first
        for (const publication of videoTracks) {
          if (publication.track && publication.isSubscribed) {
            try {
              // Access the track's receiver for WebRTC stats
              const track = publication.track as RemoteVideoTrack;
              if (track.receiver) {
                const stats = await track.receiver.getStats();
                const metricsData = this.parseWebRTCStats(stats);
                if (metricsData) {
                  log('Successfully collected video track stats from', participant.identity);
                  this.updateNetworkStatsFromMetrics(metricsData);
                  statsCollected = true;
                  break;
                }
              } else {
                log('Video track receiver not available for', participant.identity);
              }
            } catch (error) {
              log('Error getting video track stats for', participant.identity, error);
            }
          } else {
            log(`Video track not ready - subscribed: ${publication.isSubscribed}, track exists: ${!!publication.track}`);
          }
        }
        
        // Always try to collect audio stats separately (audio might be available even if video was collected)
        for (const publication of audioTracks) {
          if (publication.track && publication.isSubscribed) {
            try {
              const track = publication.track as RemoteAudioTrack;
              if (track.receiver) {
                const audioStats = await track.receiver.getStats();
                const audioMetricsData = this.parseWebRTCStats(audioStats);
                if (audioMetricsData && Object.keys(audioMetricsData).some(key => key.includes('audio'))) {
                  log('Successfully collected audio track stats from', participant.identity);
                  // If we already have video stats, combine them; otherwise use audio alone
                  if (statsCollected) {
                    // Combine audio with existing video stats
                    this.combineVideoAndAudioStats(audioMetricsData);
                  } else {
                    this.updateNetworkStatsFromMetrics(audioMetricsData);
                    statsCollected = true;
                  }
                  break;
                } else {
                  log('Audio track receiver exists but no audio inbound-rtp stats found for', participant.identity);
                }
              } else {
                log('Audio track receiver not available for', participant.identity);
              }
            } catch (error) {
              log('Error getting audio track stats for', participant.identity, error);
            }
          }
        }
        
        if (statsCollected) break;
      }

      if (!statsCollected) {
        log('No subscribed remote tracks available for stats collection');
        // Fallback to basic network quality stats
        this.updateNetworkStats();
      }
    } catch (error) {
      log('Error collecting WebRTC stats:', error);
    }
  }

  private parseWebRTCStats(stats: RTCStatsReport): Record<string, unknown> | null {
    const metricsData: Record<string, unknown> = {};
    const statTypes: string[] = [];

    // First pass: collect all stat types for debugging
    for (const [, stat] of stats) {
      if (!statTypes.includes(stat.type)) {
        statTypes.push(stat.type);
      }
    }

    log('Available WebRTC stat types:', statTypes);

    // Debug: Log all inbound-rtp entries to understand what's available
    const inboundRtpStats: unknown[] = [];
    for (const [, stat] of stats) {
      if (stat.type === 'inbound-rtp') {
        inboundRtpStats.push({
          mediaType: stat.mediaType || stat.kind,
          ssrc: stat.ssrc,
          codecId: stat.codecId,
          hasAudioLevel: 'audioLevel' in stat,
          hasFrames: 'framesReceived' in stat
        });
      }
    }
    log('All inbound-rtp entries found:', inboundRtpStats);
    log('Total inbound-rtp entries:', inboundRtpStats.length);
    
    // Also check for other audio-related stat types
    const audioRelatedStats: unknown[] = [];
    for (const [, stat] of stats) {
      if (stat.type.includes('audio') || (stat.mediaType === 'audio') || (stat.kind === 'audio')) {
        audioRelatedStats.push({
          type: stat.type,
          mediaType: stat.mediaType || stat.kind,
          id: stat.id,
          keys: Object.keys(stat)
        });
      }
    }
    log('Audio-related stats found:', audioRelatedStats);

    // Second pass: extract meaningful data
    for (const [, stat] of stats) {
      // Look for inbound RTP streams (receiving data)
      if (stat.type === 'inbound-rtp') {
        const mediaType = stat.mediaType || stat.kind;
        if (mediaType === 'video' || mediaType === 'audio') {
          const key = mediaType === 'video' ? 'video-inbound' : 'audio-inbound';

          log(`Found ${mediaType} inbound-rtp stats:`, {
            ssrc: stat.ssrc,
            mediaType,
            codecId: stat.codecId,
            bytesReceived: stat.bytesReceived,
            packetsReceived: stat.packetsReceived,
            packetsLost: stat.packetsLost,
            audioLevel: stat.audioLevel,
            jitter: stat.jitter,
          });

          metricsData[key] = {
            kind: mediaType,
            mediaType: mediaType,
            codecName: stat.codecId ? this.getCodecName(stats, stat.codecId) : undefined,
            framesReceived: stat.framesReceived,
            framesDecoded: stat.framesDecoded,
            frameWidth: stat.frameWidth,
            frameHeight: stat.frameHeight,
            framerate: stat.framesPerSecond,
            bytesReceived: stat.bytesReceived,
            packetsReceived: stat.packetsReceived,
            packetsLost: stat.packetsLost,
            jitter: stat.jitter,
            audioLevel: stat.audioLevel,
            totalAudioEnergy: stat.totalAudioEnergy,
          };
        }
      }

      // Also look for receiver stats which might have different structure
      else if (stat.type === 'media-source' || stat.type === 'track') {
        log(`Found ${stat.type} stats:`, stat);
      }
    }

    const foundKeys = Object.keys(metricsData);
    log('Extracted metrics keys:', foundKeys);

    return foundKeys.length > 0 ? metricsData : null;
  }

  private getCodecName(stats: RTCStatsReport, codecId: string): string | undefined {
    for (const [, stat] of stats) {
      if (stat.type === 'codec' && stat.id === codecId) {
        return stat.mimeType || stat.payloadType?.toString();
      }
    }
    return undefined;
  }

  private setupEventListeners() {
    // Connection events
    this.room.on('connected', () => {
      const remoteParticipants = Array.from(this.room.remoteParticipants.values());
      log('LiveKit room connected with', remoteParticipants.length, 'remote participants');
      this.updateState({ isJoined: true });

      // Initialize basic network stats when connected
      this.updateNetworkStats();

      // Note: We'll start detailed stats collection when remote participants join
      // and tracks are subscribed to ensure the subscriber peer connection is established
    });

    this.room.on('disconnected', () => {
      log('LiveKit room disconnected');
      this.updateState({
        isJoined: false,
        connected: false,
        participants: [],
        remoteStats: null,
        networkQuality: null,
      });

      // Stop collecting stats when disconnected
      this.stopStatsCollection();
    });

    this.room.on('reconnecting', () => {
      log('LiveKit room reconnecting...');
    });

    this.room.on('reconnected', () => {
      log('LiveKit room reconnected');
      this.updateState({ isJoined: true });
    });

    // Participant events
    this.room.on('participantConnected', (participant) => {
      log('Participant connected:', participant.identity);
      const participantInfo: ParticipantInfo = {
        uid: participant.sid,
        identity: participant.identity,
        name: participant.name,
      };

      this.updateState({
        participants: [...this._state.participants, participantInfo],
      });

      this.handlers?.onUserJoin?.(participantInfo);

      // Start stats collection if not already running and room is connected
      if (!this.statsCollectionInterval && this.room.state === 'connected') {
        log('Starting stats collection after participant connection');
        // Add a small delay to ensure tracks are subscribed
        setTimeout(() => {
          if (!this.statsCollectionInterval) {
            this.startStatsCollection();
          }
        }, 1000);
      }
    });

    this.room.on('participantDisconnected', (participant) => {
      log('Participant disconnected:', participant.identity);
      const participantInfo: ParticipantInfo = {
        uid: participant.sid,
        identity: participant.identity,
        name: participant.name,
      };

      this.updateState({
        participants: this._state.participants.filter((p) => p.uid !== participant.sid),
      });

      this.handlers?.onUserLeave?.(participantInfo);
    });

    // Track events
    this.room.on('trackSubscribed', (track, _publication, participant) => {
      log('Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === 'video') {
        // Auto-attach video track to remote-video element
        const videoElement = document.getElementById('remote-video') as HTMLVideoElement;
        if (videoElement && track instanceof RemoteVideoTrack) {
          track.attach(videoElement);
        }
      } else if (track.kind === 'audio') {
        // Auto-play audio tracks
        if (track instanceof RemoteAudioTrack) {
          track.attach();
        }
      }

      // Start stats collection when we have subscribed tracks from remote participants
      // Only start if this is a remote track and we have remote participants
      const remoteParticipants = Array.from(this.room.remoteParticipants.values());
      const isRemoteTrack = participant.sid !== this.room.localParticipant.sid;
      
      if (!this.statsCollectionInterval && isRemoteTrack && remoteParticipants.length > 0) {
        log('Starting stats collection after remote track subscription from', participant.identity);
        // Add a small delay to ensure the peer connection is fully established
        setTimeout(() => {
          if (!this.statsCollectionInterval) {
            this.startStatsCollection();
          }
        }, 1000);
      } else if (!isRemoteTrack) {
        log('Skipping stats collection for local track subscription');
      } else if (remoteParticipants.length === 0) {
        log('No remote participants available for stats collection');
      }
    });

    this.room.on('trackUnsubscribed', (track, _publication, participant) => {
      log('Track unsubscribed:', track.kind, 'from', participant.identity);
      track.detach();

      // Check if we should stop stats collection when no more remote tracks
      const hasRemoteTracks = Array.from(this.room.remoteParticipants.values()).some(
        (p) => p.trackPublications.size > 0,
      );

      if (!hasRemoteTracks && this.statsCollectionInterval) {
        log('No more remote tracks, stopping stats collection');
        this.stopStatsCollection();
      }
    });

    // Connection quality events
    this.room.on('connectionQualityChanged', (quality: ConnectionQuality, participant) => {
      const qualityNumber = this.mapConnectionQuality(quality);

      if (participant === this.room.localParticipant) {
        // Update local connection quality
        this.localConnectionQuality = qualityNumber;

        const networkQuality: NetworkQuality = {
          uplinkQuality: qualityNumber,
          downlinkQuality: qualityNumber,
        };

        this.updateState({ networkQuality });
        this.handlers?.onNetworkQuality?.(networkQuality);
      } else {
        // Update remote connection quality
        this.remoteConnectionQuality = qualityNumber;
      }

      // Update network stats whenever quality changes
      this.updateNetworkStats();
    });

    // Metrics received event for detailed network statistics
    this.room.on(RoomEvent.MetricsReceived, (metrics) => {
      log('LiveKit metrics received:', metrics);
      this.updateNetworkStatsFromMetrics(metrics);
    });
  }

  private mapConnectionQuality(quality: ConnectionQuality): number {
    // Map LiveKit connection quality to a scale of 0-6 (similar to Agora)
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 6;
      case ConnectionQuality.Good:
        return 5;
      case ConnectionQuality.Poor:
        return 3;
      case ConnectionQuality.Unknown:
      default:
        return 0;
    }
  }

  public async connect(credentials: Credentials, handlers?: StreamingEventHandlers): Promise<void> {
    if (!this.isLivekitCredentials(credentials)) {
      throw new Error('Invalid credentials for LiveKit provider');
    }

    // Disconnect if already connected to prevent conflicts
    if (this.room.state === 'connected') {
      log('LiveKit room already connected, disconnecting first...');
      await this.disconnect();
      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.handlers = handlers;

    try {
      await this.room.connect(credentials.livekit_url, credentials.livekit_token, {
        autoSubscribe: true,
      });

      // Wait for connection to be fully established before proceeding
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Register message handlers
      this.registerMessageHandlers();

      this.updateState({ connected: true });
      log('LiveKit connected successfully');
    } catch (error) {
      log('Failed to connect to LiveKit:', error);
      this.handlers?.onException?.({
        code: -1,
        msg: `LiveKit connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      // Unregister message handlers before disconnecting
      if (this.room.state === 'connected') {
        unregisterMessageHandlers(this.room);
      }
      // Stop stats collection first
      this.stopStatsCollection();
      if (this.room.state === 'connected' || this.room.state === 'connecting') {
        await this.room.disconnect();
      }
      this.updateState({
        isJoined: false,
        connected: false,
        participants: [],
        remoteStats: null,
        networkQuality: null,
      });
      log('LiveKit disconnected successfully');
    } catch (error) {
      log('Failed to disconnect from LiveKit:', error);
      // Don't throw during cleanup - log and continue
      console.error('LiveKit disconnect error (non-critical during cleanup):', error);
    }
  }

  public async publishVideo(track: VideoTrack): Promise<void> {
    if (!this.isLiveKitVideoTrack(track)) {
      throw new Error('Invalid video track for LiveKit provider');
    }

    try {
      // Check if track is already published to avoid duplicate publishing
      const localParticipant = this.room.localParticipant;
      const videoPublications = Array.from(localParticipant.trackPublications.values());
      const existingVideoPublication = videoPublications.find(
        (pub) =>
          pub.track &&
          pub.track.kind === 'video' &&
          (pub.track === track ||
            (track.sid && pub.track.sid === track.sid) ||
            (track.source && pub.track.source === track.source)),
      );

      if (existingVideoPublication) {
        log('Video track already published, skipping:', track.sid || 'unknown-sid');
        return;
      }

      await this.room.localParticipant.publishTrack(track);
      log('Video track published successfully');
    } catch (error) {
      log('Failed to publish video track:', error);
      throw error;
    }
  }

  public async unpublishVideo(): Promise<void> {
    try {
      const localParticipant = this.room.localParticipant;

      // Find and unpublish all video track publications
      const publications = Array.from(localParticipant.trackPublications.values());
      const videoPublications = publications.filter((pub) => pub.track && pub.track.kind === 'video');

      if (videoPublications.length === 0) {
        log('No video tracks to unpublish');
        return;
      }

      for (const publication of videoPublications) {
        if (publication.track) {
          await localParticipant.unpublishTrack(publication.track);
          log('Unpublished video track:', publication.track.sid || 'unknown-sid');
        }
      }

      log('Video tracks unpublished successfully');
    } catch (error) {
      log('Failed to unpublish video tracks:', error);
      throw error;
    }
  }

  public async subscribeToRemoteVideo(containerId: string): Promise<void> {
    // LiveKit handles auto-subscription, but we can ensure video is attached
    const remoteParticipants = Array.from(this.room.remoteParticipants.values());
    if (remoteParticipants.length > 0) {
      const participant = remoteParticipants[0];
      let videoTrack = null;

      // Get first video track from track publications
      const publications = Array.from(participant.trackPublications.values());
      for (const publication of publications) {
        if (publication.track && publication.track.kind === 'video') {
          videoTrack = publication.track;
          break;
        }
      }

      if (videoTrack) {
        const videoElement = document.getElementById(containerId) as HTMLVideoElement;
        if (videoElement) {
          videoTrack.attach(videoElement);
          log('Attached video track to element:', containerId);
        }
      }
    }
  }

  public async unsubscribeFromRemoteVideo(): Promise<void> {
    // LiveKit handles auto-unsubscription, but we can detach manually
    const remoteParticipants = Array.from(this.room.remoteParticipants.values());
    remoteParticipants.forEach((participant) => {
      // Get all track publications and filter for video
      const publications = Array.from(participant.trackPublications.values());
      for (const publication of publications) {
        if (publication.track && publication.track.kind === 'video') {
          publication.track.detach();
          log('Detached video track:', publication.track.sid);
        }
      }
    });
  }

  public async sendMessage(messageId: string, content: string): Promise<void> {
    await sendMessageToAvatar(this.room, messageId, content);
  }

  // Inherited from BaseStreamingProvider

  // Implementations moved below to avoid duplication

  public isConnected(): boolean {
    return this.room.state === 'connected';
  }

  public canSendMessages(): boolean {
    return this.isConnected() && this._state.connected;
  }

  public async cleanup(): Promise<void> {
    log('LiveKitStreamingProvider cleanup called');
    // Ensure stats collection is stopped
    this.stopStatsCollection();

    // Remove all event listeners to prevent memory leaks
    this.room.removeAllListeners();

    await this.disconnect();
  }
  private registerMessageHandlers() {
    if (!this.handlers) return;

    registerMessageHandlers(this.room, {
      onAvatarCommand: (command, from) => {
        log('Received avatar command:', command.cmd, 'from', from.identity);

        // Handle command responses using shared logic
        if ('code' in command) {
          const { cmd, code, msg } = command as CommandPayload & { code: number; msg?: string };
          this.handleCommandResponse(cmd, code, msg, 'unknown', from.identity);
        }
      },
      onChatMessage: (message, from) => {
        log('Received chat message from', from.identity, 'messageId:', from.messageId, 'from:', message.from);
        // Use the shared handler
        this.handleChatMessage(message.text, message.from, from.messageId || 'unknown', from.identity);
      },
      onEventMessage: (event, from) => {
        log('Received event message:', event.event, 'from', from.identity);
        // Use the shared handler
        this.handleEventMessage(event.event, 'unknown', from.identity, event.data);
      },
      onSystemMessage: (message, from) => {
        log('Received system message from', from.identity);
        this.handlers?.onSystemMessage?.(`system_${Date.now()}`, message, 'system', { from: from.identity });
      },
    });
  }

  // LiveKit-specific implementations
  public async setAvatarParams(
    meta: Metadata,
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void> {
    await setAvatarParams(this.room, meta, onCommandSend);
  }

  public async interruptResponse(onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void): Promise<void> {
    await interruptResponse(this.room, onCommandSend);
  }

  private isLivekitCredentials(credentials: Credentials): credentials is LivekitCredentials {
    return 'livekit_url' in credentials && 'livekit_token' in credentials;
  }

  private isLiveKitVideoTrack(track: VideoTrack): track is LocalVideoTrack {
    return track instanceof LocalVideoTrack;
  }
}
