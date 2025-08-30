import React, { createContext, useContext, ReactNode, useState, useCallback, useMemo, useRef } from 'react';
import { Room, RoomOptions, Track, RemoteParticipant, RemoteTrack, RemoteTrackPublication } from 'livekit-client';

// Create the context with default value
interface LiveKitContextType {
  room: Room;
  isAvatarSpeaking: boolean;
  setIsAvatarSpeaking: (speaking: boolean) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

const LiveKitContext = createContext<LiveKitContextType | undefined>(undefined);

// Create a provider component
interface LiveKitProviderProps {
  children: ReactNode;
  roomOptions?: RoomOptions;
}

export const LiveKitProvider: React.FC<LiveKitProviderProps> = ({ children, roomOptions = {} }) => {
  // Initialize the LiveKit room - use useMemo to ensure it's only created once
  const room: Room = useMemo(() => {
    const defaultOptions: RoomOptions = {
      // Enable adaptive stream for better performance
      adaptiveStream: true,
      // Enable dynacast for improved scalability
      dynacast: true,
      ...roomOptions,
    };

    console.log('LiveKitContext: Creating new Room instance');
    return new Room(defaultOptions);
  }, [roomOptions]);

  // State for avatar speaking status
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Track connection state changes
  const connectionStateRef = useRef(false);

  const handleSetIsAvatarSpeaking = useCallback((speaking: boolean) => {
    setIsAvatarSpeaking(speaking);
  }, []);

  const handleSetIsConnected = useCallback((connected: boolean) => {
    if (connectionStateRef.current !== connected) {
      connectionStateRef.current = connected;
      setIsConnected(connected);
    }
  }, []);

  // Set up room event listeners
  React.useEffect(() => {
    const handleRoomConnected = () => {
      console.log('LiveKit room connected');
      handleSetIsConnected(true);
    };

    const handleRoomDisconnected = () => {
      console.log('LiveKit room disconnected');
      handleSetIsConnected(false);
    };

    const handleRoomReconnecting = () => {
      console.log('LiveKit room reconnecting...');
    };

    const handleRoomReconnected = () => {
      console.log('LiveKit room reconnected');
      handleSetIsConnected(true);
    };

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log('Participant connected:', participant.identity);
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log('Participant disconnected:', participant.identity);
    };

    const handleTrackSubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      console.log('Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === Track.Kind.Video) {
        // Auto-attach video track to remote-video element
        const videoElement = document.getElementById('remote-video') as HTMLVideoElement;
        if (videoElement) {
          track.attach(videoElement);
        }
      } else if (track.kind === Track.Kind.Audio) {
        // Auto-play audio tracks
        track.attach();
      }
    };

    const handleTrackUnsubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
      track.detach();
    };

    // Add event listeners
    room.on('connected', handleRoomConnected);
    room.on('disconnected', handleRoomDisconnected);
    room.on('reconnecting', handleRoomReconnecting);
    room.on('reconnected', handleRoomReconnected);
    room.on('participantConnected', handleParticipantConnected);
    room.on('participantDisconnected', handleParticipantDisconnected);
    room.on('trackSubscribed', handleTrackSubscribed);
    room.on('trackUnsubscribed', handleTrackUnsubscribed);

    // Cleanup function
    return () => {
      room.off('connected', handleRoomConnected);
      room.off('disconnected', handleRoomDisconnected);
      room.off('reconnecting', handleRoomReconnecting);
      room.off('reconnected', handleRoomReconnected);
      room.off('participantConnected', handleParticipantConnected);
      room.off('participantDisconnected', handleParticipantDisconnected);
      room.off('trackSubscribed', handleTrackSubscribed);
      room.off('trackUnsubscribed', handleTrackUnsubscribed);
    };
  }, [room, handleSetIsConnected]);

  // Cleanup when component unmounts - use ref to avoid dependency issues
  const roomRef = React.useRef(room);
  roomRef.current = room;

  React.useEffect(() => {
    return () => {
      // Use ref to access current room without triggering effect on room changes
      if (roomRef.current.state === 'connected') {
        console.log('LiveKitContext: Disconnecting room on cleanup');
        roomRef.current.disconnect();
      }
    };
  }, []); // Empty dependency array - only runs on mount/unmount

  return (
    <LiveKitContext.Provider
      value={{
        room,
        isAvatarSpeaking,
        setIsAvatarSpeaking: handleSetIsAvatarSpeaking,
        isConnected,
        setIsConnected: handleSetIsConnected,
      }}
    >
      {children}
    </LiveKitContext.Provider>
  );
};

// Create a custom hook to use the context
// eslint-disable-next-line react-refresh/only-export-components
export const useLiveKit = (): LiveKitContextType => {
  const context = useContext(LiveKitContext);
  if (context === undefined) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
};
