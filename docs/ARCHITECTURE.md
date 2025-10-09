# Architecture Documentation

## 🏗️ Architecture Overview

This application demonstrates **enterprise-grade architecture** with:

- **Multi-Provider Support**: Seamless switching between Agora, LiveKit, and TRTC
- **Clean Architecture**: Layered design with clear separation of concerns
- **Design Patterns**: Strategy, Factory, Provider, Observer, and Controller patterns
- **Type Safety**: Comprehensive TypeScript implementation with strict typing
- **Event-Driven**: Reactive updates through EventBus system
- **Resource Management**: Automatic cleanup and memory management

## 🏛️ Architecture Patterns

This application demonstrates **enterprise-grade design patterns** and clean architecture principles:

### Design Patterns Implemented

#### 1. **Strategy Pattern**
- **Purpose**: Abstract media operations across different streaming providers
- **Implementation**: `AudioStrategy`, `VideoStrategy` interfaces with provider-specific implementations
- **Benefits**: Easy addition of new providers, consistent API across providers

#### 2. **Factory Pattern**
- **Purpose**: Centralized provider creation and management
- **Implementation**: `StreamingProviderFactory` with lazy loading
- **Benefits**: Dynamic provider instantiation, reduced bundle size

#### 3. **Provider Pattern**
- **Purpose**: Unified interface for different streaming SDKs
- **Implementation**: `BaseStreamingProvider` abstract class with concrete implementations
- **Benefits**: Provider-agnostic application logic, easy switching

#### 4. **Observer Pattern**
- **Purpose**: Event-driven communication throughout the system
- **Implementation**: `EventBus` with typed event system
- **Benefits**: Loose coupling, reactive updates

#### 5. **Controller Pattern**
- **Purpose**: Extract complex logic from providers into focused controllers
- **Implementation**: Separate controllers for audio, video, events, stats, participants
- **Benefits**: Single responsibility, maintainability, testability

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  App.tsx → ConfigurationPanel, VideoDisplay, ChatInterface  │
│  Components: AvatarSelector, VoiceSelector, NetworkQuality │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     HOOKS LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  useStreamingSession, useProviderAudioControls,            │
│  useProviderVideoCamera, useStreamingContext               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   CONTEXT LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  StreamingContext, NotificationContext, ModalContext       │
│  ConfigurationStore (Zustand)                              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  PROVIDER LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  StreamingProviderFactory → ProviderManager                │
│  BaseStreamingProvider (Abstract)                          │
│  ├─ AgoraStreamingProvider                                 │
│  ├─ LiveKitStreamingProvider                               │
│  └─ TRTCStreamingProvider                                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  CONTROLLER LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  ConnectionController, AudioController, VideoController    │
│  EventController, StatsController, ParticipantController   │
│  CommonMessageController (shared)                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   STRATEGY LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  AudioStrategy, VideoStrategy, MediaStrategy               │
│  Provider-specific implementations                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    CORE LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  EventBus, Logger, ResourceManager, ErrorMapper           │
│  Type definitions, API schemas                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Benefits

- **🔄 Multi-Provider Support**: Seamless switching between Agora, LiveKit, and TRTC
- **🧩 Modular Design**: Clear separation of concerns with focused responsibilities
- **🔧 Extensibility**: Easy addition of new providers and features
- **🛡️ Type Safety**: Comprehensive TypeScript implementation with strict typing
- **⚡ Performance**: Optimized resource management and lazy loading
- **🧪 Testability**: Clean architecture enables comprehensive testing
- **📈 Scalability**: Event-driven architecture supports horizontal scaling

## 📁 Project Structure

```
src/
├── components/             # React UI components
│   ├── AvatarSelector/     # Avatar selection interface
│   ├── ChatInterface/      # Chat functionality with message handling
│   ├── ConfigurationPanel/ # Settings and provider selection
│   ├── NetworkQuality/     # Real-time network monitoring
│   ├── VideoDisplay/       # Avatar video display with overlays
│   ├── VoiceSelector/      # Voice selection and preview
│   └── shared/             # Reusable UI components
├── contexts/               # React context providers
│   ├── StreamingContext.tsx    # Core streaming state management
│   ├── NotificationContext.tsx # Notification system
│   └── ModalContext.tsx        # Modal management
├── hooks/              # Custom React hooks
│   ├── useStreamingSession.ts     # Main streaming session logic
│   ├── useProviderAudioControls.ts # Provider-agnostic audio controls
│   ├── useProviderVideoCamera.ts  # Provider-agnostic video controls
│   └── useStreamingContext.ts     # Streaming context hook
├── providers/          # Multi-provider streaming system
│   ├── BaseStreamingProvider.ts   # Abstract base provider
│   ├── StreamingProviderFactory.ts # Provider factory with lazy loading
│   ├── ProviderManager.ts         # Provider lifecycle management
│   ├── agora/          # Agora RTC implementation
│   │   ├── AgoraStreamingProvider.ts
│   │   ├── controllers/ # Audio, Video, Event, Stats, Participant controllers
│   │   ├── strategies/  # Audio and Video strategy implementations
│   │   └── adapters/    # Message adapter for Agora
│   ├── livekit/         # LiveKit implementation
│   │   ├── LiveKitStreamingProvider.ts
│   │   ├── controllers/ # LiveKit-specific controllers
│   │   ├── strategies/  # LiveKit strategy implementations
│   │   └── adapters/    # Message adapter for LiveKit
│   ├── trtc/            # TRTC implementation
│   │   ├── TRTCStreamingProvider.ts
│   │   ├── controllers/ # TRTC-specific controllers
│   │   ├── strategies/  # TRTC strategy implementations
│   │   └── adapters/    # Message adapter for TRTC
│   └── common/          # Shared provider components
│       ├── CommonMessageController.ts
│       └── controllers/ # Base controller implementations
├── core/                # Core system utilities
│   ├── EventBus.ts      # Event-driven communication system
│   ├── Logger.ts        # Structured logging with multiple outputs
│   ├── ResourceManager.ts  # Automatic resource cleanup
│   └── index.ts         # Core exports
├── stores/              # State management
│   └── configurationStore.ts # Zustand store for app configuration
├── types/              # TypeScript type definitions
│   ├── provider.interfaces.ts # Provider interfaces and types
│   ├── streaming.types.ts     # Streaming-specific types
│   ├── error.types.ts         # Error handling types
│   └── api.schemas.ts         # API response schemas
├── errors/             # Error handling
│   ├── ErrorMapper.ts  # Provider-specific error mapping
│   └── index.ts        # Error exports
├── apiService.ts       # Akool API integration
└── App.tsx             # Main application component
```

## 🔄 Multi-Provider System

The application supports three streaming providers with automatic credential management:

### Agora RTC (Default)
- **SDK**: `agora-rtc-sdk-ng`
- **Credentials**: `agora_app_id`, `agora_token`, `agora_channel`, `agora_uid`
- **Features**: Full audio/video support, AI denoiser, network monitoring

### LiveKit
- **SDK**: `livekit-client`
- **Credentials**: `livekit_url`, `livekit_token`, `livekit_room_name`, `livekit_client_identity`
- **Features**: WebRTC-based, scalable, modern architecture

### TRTC (Tencent)
- **SDK**: `trtc-sdk-v5`
- **Credentials**: `trtc_app_id`, `trtc_user_id`, `trtc_user_sig`, `trtc_room_id`
- **Features**: Enterprise-grade, global CDN, advanced audio processing

### Provider Switching
```typescript
// Switch providers programmatically
const { switchProvider } = useStreamingContext();
await switchProvider('livekit'); // or 'agora', 'trtc'
```

## 🚀 Performance Optimizations

### Lazy Loading
- **Provider Loading**: Providers loaded on-demand to reduce initial bundle size
- **Code Splitting**: Dynamic imports for better performance
- **Tree Shaking**: Unused code eliminated during build

### Resource Management
- **Automatic Cleanup**: Tracks and connections cleaned up automatically
- **Memory Monitoring**: Detection and prevention of memory leaks
- **Connection Pooling**: Efficient reuse of network resources

### Event-Driven Architecture
- **EventBus**: Centralized event system for loose coupling
- **Reactive Updates**: State changes propagate efficiently
- **Type Safety**: Typed events prevent runtime errors

## 🛡️ Error Handling

### Structured Error System
- **Custom Error Types**: Provider-specific error mapping
- **Error Recovery**: Automatic retry with exponential backoff
- **Graceful Degradation**: Fallback mechanisms for critical failures

### Circuit Breaker Pattern
- **Failure Detection**: Automatic detection of provider failures
- **Recovery**: Intelligent recovery strategies
- **Monitoring**: Real-time error tracking and reporting

## 🧪 Testing Strategy

### Unit Testing
- **Component Tests**: React Testing Library for UI components
- **Hook Tests**: Custom hook testing with proper mocking
- **Provider Tests**: Provider-specific functionality testing

### Integration Testing
- **Provider Switching**: End-to-end provider switching tests
- **Error Scenarios**: Network failure and recovery testing
- **Performance Testing**: Load and stress testing

## 📈 Scalability Considerations

### Horizontal Scaling
- **Stateless Design**: No server-side state dependencies
- **Provider Abstraction**: Easy addition of new providers
- **Event-Driven**: Supports distributed architectures

### Performance Monitoring
- **Real-time Metrics**: Network quality and performance tracking
- **Resource Usage**: Memory and CPU monitoring
- **Error Tracking**: Comprehensive error logging and analysis

## 🔮 Future Enhancements

### Micro-Frontend Architecture
- **Module Federation**: Independent deployable modules
- **Shared Dependencies**: Common libraries for consistency
- **Independent Scaling**: Scale components based on usage

### Plugin Architecture
- **Extensible System**: Plugin-based feature additions
- **Third-party Integration**: Easy integration of external services
- **Custom Providers**: User-defined provider implementations

### Advanced Caching
- **Intelligent Caching**: Smart caching strategies
- **Offline Support**: Offline-first architecture
- **Data Synchronization**: Real-time data consistency
