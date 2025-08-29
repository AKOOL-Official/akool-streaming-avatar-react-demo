import { useState, useCallback, useRef, useEffect } from 'react';
import { useAgora } from '../contexts/AgoraContext';
import { useLiveKit } from '../contexts/LiveKitContext';
import { StreamProviderType } from '../types/streamingProvider';
import { useMediaStrategy, AudioTrack } from '../strategies';

export const useUnifiedAudioControls = (streamType: StreamProviderType) => {
  const { client } = useAgora();
  const { room } = useLiveKit();
  const [micEnabled, setMicEnabled] = useState(false);
  const audioTrackRef = useRef<AudioTrack | null>(null);
  
  const mediaStrategy = useMediaStrategy(streamType, client, room);

  const toggleMic = useCallback(async () => {
    if (!mediaStrategy.audio.isConnected()) {
      return;
    }

    if (!micEnabled) {
      try {
        const audioTrack = await mediaStrategy.audio.createAudioTrack();
        await mediaStrategy.audio.publishAudioTrack(audioTrack);
        audioTrackRef.current = audioTrack;
        setMicEnabled(true);
      } catch (error) {
        console.error('Failed to enable microphone:', error);
        setMicEnabled(false);
      }
    } else {
      try {
        if (audioTrackRef.current) {
          // First unpublish (while track is still in good state)
          if (mediaStrategy.audio.isConnected()) {
            await mediaStrategy.audio.unpublishAudioTrack(audioTrackRef.current);
          }
          // Then stop and close the track
          mediaStrategy.audio.stopAudioTrack(audioTrackRef.current);
          mediaStrategy.audio.closeAudioTrack(audioTrackRef.current);
          audioTrackRef.current = null;
        }
        setMicEnabled(false);
      } catch (error) {
        console.error('Failed to disable microphone:', error);
      }
    }
  }, [micEnabled, mediaStrategy]);

  // Cleanup function to properly release the audio track
  const cleanup = useCallback(async () => {
    try {
      if (audioTrackRef.current) {
        // First unpublish (while track is still in good state)
        if (mediaStrategy.audio.isConnected()) {
          await mediaStrategy.audio.unpublishAudioTrack(audioTrackRef.current);
        }
        // Then stop and close the track
        mediaStrategy.audio.stopAudioTrack(audioTrackRef.current);
        mediaStrategy.audio.closeAudioTrack(audioTrackRef.current);
        audioTrackRef.current = null;
      }
      setMicEnabled(false);
    } catch (error) {
      console.error('Failed to cleanup audio track:', error);
    }
  }, [mediaStrategy]);

  // Cleanup when connection is lost
  useEffect(() => {
    if (!mediaStrategy.audio.isConnected() && micEnabled) {
      cleanup();
    }
  }, [mediaStrategy, micEnabled, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    micEnabled,
    setMicEnabled,
    toggleMic,
    cleanup,
  };
};
