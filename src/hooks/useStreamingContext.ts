import { useContext } from 'react';
import { StreamingContext, StreamingContextType } from '../contexts/StreamingContext';

// Custom hook to use the streaming context
export const useStreamingContext = (): StreamingContextType => {
  const context = useContext(StreamingContext);
  if (context === undefined) {
    throw new Error('useStreamingContext must be used within a StreamingProvider');
  }
  return context;
};
