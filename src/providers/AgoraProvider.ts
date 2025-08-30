import { IAgoraRTCRemoteUser, NetworkQuality, ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { UID } from 'agora-rtc-sdk-ng/esm';
import {
  StreamProviderType,
  StreamingEventHandlers,
  VideoTrack,
  ParticipantInfo,
  Metadata,
  NetworkQuality as CommonNetworkQuality,
} from '../types/streamingProvider';
import { validateStreamMessage, processMessageChunk, processStreamMessage } from '../utils/messageUtils';
import { BaseStreamingProvider } from './BaseStreamingProvider';
import { AgoraCredentials, Credentials } from '../apiService';
import { NetworkStats } from '../components/NetworkQuality';
import { RTCClient, setAvatarParams, interruptResponse, sendMessageToAvatar } from '../agoraHelper';
import { log } from '../utils/messageUtils';

export class AgoraStreamingProvider extends BaseStreamingProvider {
  public readonly providerType: StreamProviderType = 'agora';
  private client: RTCClient;

  constructor(client: RTCClient) {
    super();
    this.client = client;
  }

  public async connect(credentials: Credentials, handlers?: StreamingEventHandlers): Promise<void> {
    if (!this.isAgoraCredentials(credentials)) {
      throw new Error('Invalid credentials for Agora provider');
    }

    this.handlers = handlers;

    try {
      // Setup event listeners
      this.setupEventListeners();

      // Join the Agora channel
      await this.client.join(
        credentials.agora_app_id,
        credentials.agora_channel,
        credentials.agora_token,
        credentials.agora_uid,
      );

      this.updateState({ isJoined: true });
      log('Agora connected successfully');
    } catch (error) {
      log('Failed to connect to Agora:', error);
      this.handlers?.onException?.({
        code: -1,
        msg: `Agora connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.removeEventListeners();

      // Only attempt to unpublish and leave if we're actually connected
      if (this.client.connectionState === 'CONNECTED' || this.client.connectionState === 'CONNECTING') {
        // Stop and close all local tracks before unpublishing
        const localTracks = this.client.localTracks;
        for (const track of localTracks) {
          try {
            track.stop();
            track.close();
          } catch (error) {
            console.error('Failed to stop/close local track:', error);
          }
        }

        // Unpublish all local tracks only if we have any published
        if (localTracks.length > 0) {
          try {
            await this.client.unpublish();
          } catch (error) {
            console.error('Failed to unpublish tracks:', error);
          }
        }

        // Leave the channel
        try {
          await this.client.leave();
        } catch (error) {
          console.error('Failed to leave channel:', error);
        }
      }

      this.updateState({
        isJoined: false,
        connected: false,
        participants: [],
        remoteStats: null,
        networkQuality: null,
      });

      log('Agora disconnected successfully');
    } catch (error) {
      log('Failed to disconnect from Agora:', error);
      // Don't throw the error during cleanup to prevent React warnings
      console.error('Agora disconnect error (non-critical during cleanup):', error);
    }
  }

  public async publishVideo(track: VideoTrack): Promise<void> {
    if (!this.isAgoraVideoTrack(track)) {
      throw new Error('Invalid video track for Agora provider');
    }

    try {
      await this.client.publish(track);
      log('Video track published successfully');
    } catch (error) {
      log('Failed to publish video track:', error);
      throw error;
    }
  }

  public async unpublishVideo(): Promise<void> {
    try {
      const publishedTracks = this.client.localTracks;
      const videoTrack = publishedTracks.find((track) => track.trackMediaType === 'video');
      if (videoTrack) {
        await this.client.unpublish(videoTrack);
      }
      log('Video track unpublished successfully');
    } catch (error) {
      log('Failed to unpublish video track:', error);
      throw error;
    }
  }

  public async subscribeToRemoteVideo(_containerId: string): Promise<void> {
    // Agora handles this through the user-published event
    // This is a no-op for Agora as subscription is handled automatically
    log('Remote video subscription handled by Agora events');
  }

  public async unsubscribeFromRemoteVideo(): Promise<void> {
    // Agora handles this through the user-unpublished event
    // This is a no-op for Agora as unsubscription is handled automatically
    log('Remote video unsubscription handled by Agora events');
  }

  public async sendMessage(messageId: string, content: string): Promise<void> {
    await sendMessageToAvatar(this.client, messageId, content);
  }

  // Inherited from BaseStreamingProvider

  // Implementations moved to after onStreamMessage

  public isConnected(): boolean {
    return this.client.connectionState === 'CONNECTED';
  }

  public canSendMessages(): boolean {
    return this.isConnected() && this._state.connected && this.client.uid !== undefined;
  }

  // Connect to chat (enable message handling)
  public async connectToChat(): Promise<void> {
    this.updateState({ connected: true });
  }

  // Disconnect from chat (disable message handling)
  public async disconnectFromChat(): Promise<void> {
    this.updateState({ connected: false });
  }

  private setupEventListeners() {
    this.client.on('exception', this.onException);
    this.client.on('user-published', this.onUserPublish);
    this.client.on('user-unpublished', this.onUserUnpublish);
    this.client.on('token-privilege-will-expire', this.onTokenWillExpire);
    this.client.on('token-privilege-did-expire', this.onTokenDidExpire);
    this.client.on('network-quality', this.onNetworkQuality);
    this.client.on('stream-message', this.onStreamMessage);
  }

  private removeEventListeners() {
    this.client.removeAllListeners('exception');
    this.client.removeAllListeners('user-published');
    this.client.removeAllListeners('user-unpublished');
    this.client.removeAllListeners('token-privilege-will-expire');
    this.client.removeAllListeners('token-privilege-did-expire');
    this.client.removeAllListeners('network-quality');
    this.client.removeAllListeners('stream-message');
  }

  private onException = (e: { code: number; msg: string; uid: UID }) => {
    log('Agora exception:', e);
    this.handlers?.onException?.(e);
  };

  private onTokenWillExpire = () => {
    log('Agora token will expire');
    // Could emit a warning event
  };

  private onTokenDidExpire = () => {
    log('Agora token expired');
    this.handlers?.onTokenExpired?.();
  };

  private onUserPublish = async (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio' | 'datachannel') => {
    log('User published:', user.uid, mediaType);

    const participantInfo: ParticipantInfo = {
      uid: user.uid,
      identity: user.uid.toString(),
    };

    // Add to participants if not already there
    if (!this._state.participants.find((p) => p.uid === user.uid)) {
      this.updateState({
        participants: [...this._state.participants, participantInfo],
      });
      this.handlers?.onUserJoin?.(participantInfo);
    }

    if (mediaType === 'video') {
      const remoteTrack = await this.client.subscribe(user, mediaType);
      remoteTrack.play('remote-video', { fit: 'contain' });
    } else if (mediaType === 'audio') {
      const remoteTrack = await this.client.subscribe(user, mediaType);
      remoteTrack.play();
    }
  };

  private onUserUnpublish = async (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio' | 'datachannel') => {
    log('User unpublished:', user.uid, mediaType);
    await this.client.unsubscribe(user, mediaType);

    // Remove from participants if they unpublished all tracks
    const participantInfo: ParticipantInfo = {
      uid: user.uid,
      identity: user.uid.toString(),
    };

    // Check if user has any other published tracks
    const hasOtherTracks = user.audioTrack || user.videoTrack;
    if (!hasOtherTracks) {
      this.updateState({
        participants: this._state.participants.filter((p) => p.uid !== user.uid),
      });
      this.handlers?.onUserLeave?.(participantInfo);
    }
  };

  private onNetworkQuality = (stats: NetworkQuality) => {
    // Update remote stats
    const videoStats = this.client.getRemoteVideoStats();
    const audioStats = this.client.getRemoteAudioStats();
    const networkStats = this.client.getRemoteNetworkQuality();

    // Get the first remote user's stats
    const firstVideoStats = Object.values(videoStats)[0] || {};
    const firstAudioStats = Object.values(audioStats)[0] || {};
    const firstNetworkStats = Object.values(networkStats)[0] || {};

    const remoteStats: NetworkStats = {
      localNetwork: stats,
      remoteNetwork: firstNetworkStats,
      video: firstVideoStats,
      audio: firstAudioStats,
    };

    const networkQuality: CommonNetworkQuality = {
      uplinkQuality: stats.uplinkNetworkQuality,
      downlinkQuality: stats.downlinkNetworkQuality,
    };

    this.updateState({
      remoteStats,
      networkQuality,
    });

    this.handlers?.onNetworkQuality?.(networkQuality);
  };

  private onStreamMessage = (uid: UID, body: Uint8Array) => {
    const msg = new TextDecoder().decode(body);
    log(`stream-message, uid=${uid}, size=${body.length}, msg=${msg}`);

    const validation = validateStreamMessage(msg);
    if (!validation.valid) {
      log(validation.error);
      return;
    }

    const streamMessage = validation.parsed!;

    // Process chunked messages for progressive display
    const chunkResult = processMessageChunk(streamMessage);
    if (!chunkResult) {
      // Invalid chunk, ignore
      return;
    }

    const { message } = chunkResult;
    const uidStr = uid.toString();

    // Use shared message processing utility
    processStreamMessage(message, uidStr, {
      onCommandResponse: (cmd, code, msg, messageId) => this.handleCommandResponse(cmd, code, msg, messageId, uidStr),
      onCommandSend: (cmd, data, messageId) => this.handleCommandSend(cmd, data, messageId, uidStr),
      onChatMessage: (text, from, messageId) => this.handleChatMessage(text, from, messageId, uidStr),
      onEventMessage: (event, messageId, uid, eventData) => this.handleEventMessage(event, messageId, uid, eventData),
    });
  };

  // Agora-specific implementations
  public async setAvatarParams(
    meta: Metadata,
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void> {
    await setAvatarParams(this.client, meta, onCommandSend);
  }

  public async interruptResponse(onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void): Promise<void> {
    await interruptResponse(this.client, onCommandSend);
  }

  private isAgoraCredentials(credentials: Credentials): credentials is AgoraCredentials {
    return 'agora_app_id' in credentials && 'agora_channel' in credentials;
  }

  private isAgoraVideoTrack(track: VideoTrack): track is ILocalVideoTrack {
    return 'trackMediaType' in track && track.trackMediaType === 'video';
  }
}
