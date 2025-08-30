import { Room, LocalVideoTrack, RemoteVideoTrack, RemoteAudioTrack, ConnectionQuality } from 'livekit-client';
import {
  StreamingProvider,
  StreamProviderType,
  StreamingState,
  StreamingEventHandlers,
  VideoTrack,
  ParticipantInfo,
  CommandPayload,
  Metadata,
  NetworkQuality,
} from '../types/streamingProvider';
import { LivekitCredentials, Credentials } from '../apiService';
// import { NetworkStats } from '../components/NetworkQuality'; // Unused for now
import {
  setAvatarParams,
  interruptResponse,
  sendMessageToAvatar,
  registerMessageHandlers,
  unregisterMessageHandlers,
  log,
} from '../livekitHelper';

export class LiveKitStreamingProvider implements StreamingProvider {
  public readonly providerType: StreamProviderType = 'livekit';
  private room: Room;
  private handlers?: StreamingEventHandlers;
  private _state: StreamingState;

  constructor(room: Room) {
    this.room = room;
    this._state = {
      isJoined: false,
      connected: false,
      remoteStats: null,
      participants: [],
      networkQuality: null,
    };

    this.setupEventListeners();
  }

  public get state(): StreamingState {
    return { ...this._state };
  }

  private updateState(newState: Partial<StreamingState>) {
    this._state = { ...this._state, ...newState };
  }

  private setupEventListeners() {
    // Connection events
    this.room.on('connected', () => {
      log('LiveKit room connected');
      this.updateState({ isJoined: true });
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
    });

    this.room.on('trackUnsubscribed', (track, _publication, participant) => {
      log('Track unsubscribed:', track.kind, 'from', participant.identity);
      track.detach();
    });

    // Connection quality events
    this.room.on('connectionQualityChanged', (quality: ConnectionQuality, participant) => {
      if (participant === this.room.localParticipant) {
        const networkQuality: NetworkQuality = {
          uplinkQuality: this.mapConnectionQuality(quality),
          downlinkQuality: this.mapConnectionQuality(quality),
        };

        this.updateState({ networkQuality });
        this.handlers?.onNetworkQuality?.(networkQuality);
      }
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
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.handlers = handlers;

    try {
      await this.room.connect(credentials.livekit_url, credentials.livekit_token, {
        autoSubscribe: true,
      });

      // Wait for connection to be fully established before proceeding
      await new Promise(resolve => setTimeout(resolve, 100));

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
      
      // Use getTrack method to get video track publications
      const publications = Array.from(localParticipant.trackPublications.values());
      for (const publication of publications) {
        if (publication.track && publication.track.kind === 'video') {
          await localParticipant.unpublishTrack(publication.track);
          log('Unpublished video track:', publication.track.sid);
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

  public async sendCommand(
    command: CommandPayload,
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void> {
    if (command.cmd === 'set-params' && command.data) {
      await this.setAvatarParams(command.data, onCommandSend);
    } else if (command.cmd === 'interrupt') {
      await this.interruptResponse(onCommandSend);
    } else {
      throw new Error(`Unsupported command: ${command.cmd}`);
    }
  }

  public async interruptResponse(onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void): Promise<void> {
    await interruptResponse(this.room, onCommandSend);
  }

  public async setAvatarParams(
    meta: Metadata,
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void> {
    await setAvatarParams(this.room, meta, onCommandSend);
  }

  public isConnected(): boolean {
    return this.room.state === 'connected';
  }

  public isJoined(): boolean {
    return this._state.isJoined;
  }

  public canSendMessages(): boolean {
    return this.isConnected() && this._state.connected;
  }

  public async cleanup(): Promise<void> {
    await this.disconnect();
  }

  private registerMessageHandlers() {
    if (!this.handlers) return;

    registerMessageHandlers(this.room, {
      onAvatarCommand: (command, from) => {
        log('Received avatar command:', command.cmd, 'from', from.identity);
        // Handle command responses if needed
      },
      onChatMessage: (message, from) => {
        log('Received chat message from', from.identity);
        // Convert ChatPayload to ChatResponsePayload format
        const responsePayload: import('../types/streamingProvider').ChatResponsePayload = {
          text: message.text,
          from: message.from || 'user', // Default to 'user' if not specified
        };
        this.handlers?.onStreamMessage?.(message.text, {
          uid: from.identity,
          identity: from.identity,
        }, responsePayload);
      },
      onSystemMessage: (message, from) => {
        log('Received system message from', from.identity);
        this.handlers?.onSystemMessage?.(`system_${Date.now()}`, message, 'system', { from: from.identity });
      },
    });
  }

  private isLivekitCredentials(credentials: Credentials): credentials is LivekitCredentials {
    return 'livekit_url' in credentials && 'livekit_token' in credentials;
  }

  private isLiveKitVideoTrack(track: VideoTrack): track is LocalVideoTrack {
    return track instanceof LocalVideoTrack;
  }
}
