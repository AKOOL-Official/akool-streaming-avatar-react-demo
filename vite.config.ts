import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return defineConfig({
    plugins: [react()],
    base: env.VITE_SERVER_BASE,
    server: {
      host: '0.0.0.0',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // React and core libraries
            'react-vendor': ['react', 'react-dom'],

            // Streaming SDKs - split by provider
            'agora-sdk': ['agora-rtc-sdk-ng'],
            'livekit-sdk': ['livekit-client'],
            'trtc-sdk': ['trtc-sdk-v5'],

            // Audio processing libraries
            'audio-processing': ['agora-extension-ai-denoiser', '@livekit/krisp-noise-filter'],

            // Chart and visualization
            'chart-vendor': ['chart.js', 'react-chartjs-2'],

            // Editor
            'editor-vendor': ['@monaco-editor/react'],

            // State management
            'state-vendor': ['zustand'],

            // Provider implementations - split by provider
            'agora-provider': [
              './src/providers/agora/AgoraStreamingProvider.ts',
              './src/providers/agora/strategies/AgoraAudioStrategy.ts',
              './src/providers/agora/strategies/AgoraVideoStrategy.ts',
              './src/providers/agora/strategies/AgoraRemoteVideoStrategy.tsx',
              './src/providers/agora/controllers/AgoraAudioController.ts',
              './src/providers/agora/controllers/AgoraVideoController.ts',
              './src/providers/agora/controllers/AgoraStatsController.ts',
              './src/providers/agora/controllers/AgoraEventController.ts',
              './src/providers/agora/controllers/AgoraParticipantController.ts',
              './src/providers/agora/controllers/AgoraConnectionController.ts',
              './src/providers/agora/adapters/AgoraMessageAdapter.ts',
            ],

            'livekit-provider': [
              './src/providers/livekit/LiveKitStreamingProvider.ts',
              './src/providers/livekit/strategies/LiveKitAudioStrategy.ts',
              './src/providers/livekit/strategies/LiveKitVideoStrategy.ts',
              './src/providers/livekit/strategies/LiveKitRemoteVideoStrategy.tsx',
              './src/providers/livekit/controllers/LiveKitAudioController.ts',
              './src/providers/livekit/controllers/LiveKitVideoController.ts',
              './src/providers/livekit/controllers/LiveKitStatsController.ts',
              './src/providers/livekit/controllers/LiveKitEventController.ts',
              './src/providers/livekit/controllers/LiveKitParticipantController.ts',
              './src/providers/livekit/controllers/LiveKitConnectionController.ts',
              './src/providers/livekit/adapters/LiveKitMessageAdapter.ts',
            ],

            'trtc-provider': [
              './src/providers/trtc/TRTCStreamingProvider.ts',
              './src/providers/trtc/strategies/TRTCAudioStrategy.ts',
              './src/providers/trtc/strategies/TRTCVideoStrategy.ts',
              './src/providers/trtc/strategies/TRTCRemoteVideoStrategy.tsx',
              './src/providers/trtc/controllers/TRTCAudioController.ts',
              './src/providers/trtc/controllers/TRTCVideoController.ts',
              './src/providers/trtc/controllers/TRTCStatsController.ts',
              './src/providers/trtc/controllers/TRTCEventController.ts',
              './src/providers/trtc/controllers/TRTCParticipantController.ts',
              './src/providers/trtc/controllers/TRTCConnectionController.ts',
              './src/providers/trtc/adapters/TRTCMessageAdapter.ts',
            ],

            // Common utilities and base classes
            'common-utils': [
              './src/providers/BaseStreamingProvider.ts',
              './src/providers/ProviderManager.ts',
              './src/providers/StreamingProviderFactory.ts',
              './src/providers/common/CommonMessageController.ts',
              './src/providers/common/controllers/BaseEventController.ts',
              './src/providers/common/controllers/BaseParticipantController.ts',
              './src/providers/common/controllers/BaseStatsController.ts',
              './src/providers/common/adapters/MessageAdapter.ts',
              './src/providers/common/strategies/RemoteVideoStrategy.ts',
              './src/providers/common/strategies/RemoteVideoStrategyFactory.ts',
            ],

            // Hooks and contexts
            'hooks-contexts': [
              './src/hooks/useStreamingContext.ts',
              './src/hooks/useProviderAudioControls.ts',
              './src/hooks/useStreamingSession.ts',
              './src/hooks/useProviderVideoCamera.ts',
              './src/contexts/StreamingContext.tsx',
              './src/contexts/NotificationContext.tsx',
            ],

            // Components
            components: [
              './src/components/ConfigurationPanel',
              './src/components/VideoDisplay',
              './src/components/ChatInterface',
              './src/components/NetworkQuality',
              './src/components/NotificationContainer',
            ],
          },
        },
      },
      // Increase chunk size warning limit to 1MB since we're doing manual chunking
      chunkSizeWarningLimit: 1000,
      // Enable source maps for better debugging in production
      sourcemap: false,
      // Optimize for production
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'zustand'],
      exclude: [
        'agora-rtc-sdk-ng',
        'livekit-client',
        'trtc-sdk-v5',
        'chart.js',
        'react-chartjs-2',
        '@monaco-editor/react',
      ],
    },
  });
});
