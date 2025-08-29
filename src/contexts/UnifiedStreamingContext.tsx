import React, { createContext, useContext, ReactNode } from 'react';
import { StreamProviderType } from '../types/streamingProvider';
import { AgoraProvider } from './AgoraContext';
import { LiveKitProvider } from './LiveKitContext';

interface UnifiedStreamingContextType {
  streamType: StreamProviderType;
  setStreamType: (type: StreamProviderType) => void;
}

const UnifiedStreamingContext = createContext<UnifiedStreamingContextType | undefined>(undefined);

interface UnifiedStreamingProviderProps {
  children: ReactNode;
  initialStreamType?: StreamProviderType;
}

export const UnifiedStreamingProvider: React.FC<UnifiedStreamingProviderProps> = ({
  children,
  initialStreamType = (import.meta.env.VITE_STREAM_TYPE as StreamProviderType) || 'agora',
}) => {
  const [streamType, setStreamType] = React.useState<StreamProviderType>(initialStreamType);

  const contextValue: UnifiedStreamingContextType = {
    streamType,
    setStreamType,
  };

  // Wrap children with both Agora and LiveKit providers
  // This ensures both contexts are available regardless of current selection
  return (
    <UnifiedStreamingContext.Provider value={contextValue}>
      <AgoraProvider>
        <LiveKitProvider>{children}</LiveKitProvider>
      </AgoraProvider>
    </UnifiedStreamingContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUnifiedStreamingContext = (): UnifiedStreamingContextType => {
  const context = useContext(UnifiedStreamingContext);
  if (context === undefined) {
    throw new Error('useUnifiedStreamingContext must be used within a UnifiedStreamingProvider');
  }
  return context;
};

// Hook to get the current streaming type with a setter
// eslint-disable-next-line react-refresh/only-export-components
export const useStreamingType = () => {
  const { streamType, setStreamType } = useUnifiedStreamingContext();
  return [streamType, setStreamType] as const;
};
