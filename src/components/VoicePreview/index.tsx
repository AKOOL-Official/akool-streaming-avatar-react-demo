import React, { useState, useRef, useEffect, useCallback } from 'react';
import './styles.css';

interface VoicePreviewProps {
  previewUrl: string;
  voiceName: string;
  disabled?: boolean;
}

const VoicePreview: React.FC<VoicePreviewProps> = ({ previewUrl, voiceName, disabled = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazy load audio source only when user wants to play
  const loadAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasLoaded || !previewUrl) return;

    audio.src = previewUrl;
    audio.load();
    setHasLoaded(true);
  }, [previewUrl, hasLoaded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };
    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError('Failed to load audio preview');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || disabled) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Load audio if not already loaded
      if (!hasLoaded) {
        loadAudio();
      }

      audio.play().catch(() => {
        setError('Failed to play audio preview');
      });
    }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  if (!previewUrl) {
    return (
      <div className="voice-preview disabled">
        <button disabled className="preview-button">
          <span className="material-icons">volume_off</span>
        </button>
        <span className="preview-text">No preview available</span>
      </div>
    );
  }

  return (
    <div className="voice-preview">
      <audio ref={audioRef} preload="none" aria-label={`Audio preview for ${voiceName}`} />

      <div className="preview-controls">
        <button
          onClick={handlePlayPause}
          disabled={disabled || isLoading || !!error}
          className="preview-button"
          title={isPlaying ? 'Pause preview' : 'Play preview'}
        >
          <span className="material-icons">{isLoading ? 'hourglass_empty' : isPlaying ? 'pause' : 'play_arrow'}</span>
        </button>

        {isPlaying && (
          <button onClick={handleStop} disabled={disabled} className="preview-button stop-button" title="Stop preview">
            <span className="material-icons">stop</span>
          </button>
        )}
      </div>

      <div className="preview-status">
        {error ? (
          <span className="preview-error">{error}</span>
        ) : isLoading ? (
          <span className="preview-loading">Loading...</span>
        ) : (
          <span className="preview-text">{isPlaying ? 'Playing...' : 'Preview'}</span>
        )}
      </div>
    </div>
  );
};

export default VoicePreview;
