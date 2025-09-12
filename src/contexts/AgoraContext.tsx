import React, { createContext, useContext, ReactNode, useState, useCallback, useMemo } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { RTCClient } from '../providers/agora/types';

// Create the context with default value
interface AgoraContextType {
  client: RTCClient;
  isAvatarSpeaking: boolean;
  setIsAvatarSpeaking: (speaking: boolean) => void;
}

const AgoraContext = createContext<AgoraContextType | undefined>(undefined);

// Create a provider component
interface AgoraProviderProps {
  children: ReactNode;
}

export const AgoraProvider: React.FC<AgoraProviderProps> = ({ children }) => {
  // Initialize the Agora client - use useMemo to ensure it's only created once
  const client: RTCClient = useMemo(() => {
    return AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8',
    }) as RTCClient;
  }, []); // Empty dependency array ensures it's only created once

  // State for avatar speaking status
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);

  const handleSetIsAvatarSpeaking = useCallback((speaking: boolean) => {
    setIsAvatarSpeaking(speaking);
  }, []);

  return (
    <AgoraContext.Provider
      value={{
        client,
        isAvatarSpeaking,
        setIsAvatarSpeaking: handleSetIsAvatarSpeaking,
      }}
    >
      {children}
    </AgoraContext.Provider>
  );
};

// Create a custom hook to use the context
// eslint-disable-next-line react-refresh/only-export-components
export const useAgora = (): AgoraContextType => {
  const context = useContext(AgoraContext);
  if (context === undefined) {
    throw new Error('useAgora must be used within an AgoraProvider');
  }
  return context;
};
