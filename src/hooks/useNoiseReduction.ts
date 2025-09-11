import { useState, useCallback, useRef, useEffect } from 'react';
import { AIDenoiserExtension, AIDenoiserProcessorMode, IAIDenoiserProcessor } from 'agora-extension-ai-denoiser';
import AgoraRTC, { IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

// Register the extension globally when the module loads
const aiDenoiser = new AIDenoiserExtension({
  assetsPath: './external', // Path to Wasm files - will be served from public directory
});

AgoraRTC.registerExtensions([aiDenoiser]);

export const useNoiseReduction = () => {
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true); // Default on as requested
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDumping, setIsDumping] = useState(false);
  const processorRef = useRef<IAIDenoiserProcessor | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  // Initialize the noise reduction processor
  const initializeProcessor = useCallback(async () => {
    if (processorRef.current || !audioTrackRef.current) {
      return processorRef.current;
    }

    try {
      const processor = aiDenoiser.createProcessor();

      // Set up event listeners for processor
      processor.onoverload = (elapsedTime: number) => {
        console.warn(`AI Denoiser overload detected: ${elapsedTime}ms processing time`);
        // Optionally switch to stationary noise reduction mode
        processor.setMode(AIDenoiserProcessorMode.STATIONARY_NS).catch(console.error);
      };

      // Set up dump event listeners
      processor.ondump = (blob: Blob, name: string) => {
        console.log(`Audio dump received: ${name}`);
        // Create download link for the audio file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      processor.ondumpend = () => {
        console.log('Audio dump completed');
        setIsDumping(false);
      };

      processorRef.current = processor;
      setIsInitialized(true);
      return processor;
    } catch (error) {
      console.error('Failed to initialize AI Denoiser processor:', error);
      throw error;
    }
  }, []);

  // Apply noise reduction to audio track
  const applyNoiseReduction = useCallback(
    async (audioTrack: IMicrophoneAudioTrack) => {
      if (!audioTrack) return false;

      audioTrackRef.current = audioTrack;

      try {
        const processor = await initializeProcessor();
        if (!processor) return false;

        // Pipe the audio track through the processor
        await audioTrack.pipe?.(processor).pipe?.(audioTrack.processorDestination);

        // Enable or disable based on current state
        if (noiseReductionEnabled) {
          await processor.enable();
        } else {
          await processor.disable();
        }

        return true;
      } catch (error) {
        console.error('Failed to apply noise reduction to audio track:', error);
        return false;
      }
    },
    [initializeProcessor, noiseReductionEnabled],
  );

  // Toggle noise reduction on/off
  const toggleNoiseReduction = useCallback(async () => {
    if (!processorRef.current) {
      console.warn('Noise reduction processor not initialized - please enable microphone first');
      return;
    }

    try {
      const newState = !noiseReductionEnabled;

      if (newState) {
        await processorRef.current.enable();
      } else {
        await processorRef.current.disable();
      }

      setNoiseReductionEnabled(newState);
    } catch (error) {
      console.error('Failed to toggle noise reduction:', error);
    }
  }, [noiseReductionEnabled]);

  // Dump audio data for analysis
  const dumpAudio = useCallback(async () => {
    if (!processorRef.current || !isInitialized) {
      console.warn('Noise reduction processor not initialized');
      return;
    }

    if (isDumping) {
      console.warn('Audio dump already in progress');
      return;
    }

    try {
      setIsDumping(true);
      processorRef.current.dump();
      console.log('Audio dump started - will download 9 audio files automatically');
    } catch (error) {
      console.error('Failed to start audio dump:', error);
      setIsDumping(false);
    }
  }, [isInitialized, isDumping]);

  // Cleanup processor
  const cleanup = useCallback(async () => {
    try {
      if (processorRef.current) {
        await processorRef.current.disable();
        processorRef.current = null;
      }
      audioTrackRef.current = null;
      setIsInitialized(false);
      setIsDumping(false);
    } catch (error) {
      console.error('Failed to cleanup noise reduction processor:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    noiseReductionEnabled,
    isInitialized,
    isDumping,
    applyNoiseReduction,
    toggleNoiseReduction,
    dumpAudio,
    cleanup,
  };
};
