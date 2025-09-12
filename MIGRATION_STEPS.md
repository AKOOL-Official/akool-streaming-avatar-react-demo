# Migration Steps: From Agora-Specific to Multi-Provider

## Quick Start: Test the New System

### 1. Test the New Components (5 minutes)

**Test the new StreamingContext:**
```bash
# Copy the unified files to test alongside current system
cp src/contexts/StreamingContext.tsx src/contexts/StreamingContext.tsx.new
cp src/hooks/useUnifiedStreaming.ts src/hooks/useUnifiedStreaming.ts.new
cp src/components/ProviderSelector/index.tsx src/components/ProviderSelector/index.tsx.new
```

**Test with current main.tsx:**
```bash
# Replace main.tsx temporarily to test
cp src/main-unified.tsx src/main.tsx.backup
cp src/main-unified.tsx src/main.tsx
cp src/App-unified.tsx src/App.tsx.backup  
cp src/App-unified.tsx src/App.tsx

# Run the app
pnpm dev
```

### 2. Verify Type Safety (2 minutes)

```bash
pnpm typecheck
pnpm lint
```

## Full Migration Steps

### Phase 1: Parallel Implementation (Week 1)

**Day 1-2: Create New Context System**
1. ✅ **DONE**: `StreamingContext.tsx` created
2. ✅ **DONE**: `useUnifiedStreaming.ts` created
3. ✅ **DONE**: `ProviderSelector` component created

**Day 3-5: Hook Migration**
```typescript
// Current issue: hooks/useAudioControls.ts
import AgoraRTC, { IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { useAgora } from '../contexts/AgoraContext';

// Target: hooks/useUnifiedAudioControls.ts
import { AudioTrack } from '../types/streaming.types';
import { useStreamingContext } from '../contexts/StreamingContext';

export const useUnifiedAudioControls = () => {
  const { provider, publishAudio, unpublishAudio } = useStreamingContext();
  // Provider-agnostic implementation
};
```

### Phase 2: Component Migration (Week 2)

**Day 1-3: Update Components**

1. **VideoDisplay Component:**
```typescript
// Before: components/VideoDisplay/index.tsx
import { ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { useAgora } from '../../contexts/AgoraContext';

// After:
import { VideoTrack } from '../../types/streaming.types';
import { useStreamingContext } from '../../contexts/StreamingContext';
```

2. **ChatInterface Component:**
```typescript
// Before: components/ChatInterface/index.tsx
import { useAgora } from '../../contexts/AgoraContext';
const { setIsAvatarSpeaking } = useAgora();

// After:
import { useStreamingContext } from '../../contexts/StreamingContext';
const { setIsAvatarSpeaking } = useStreamingContext();
```

3. **NetworkQuality Component:**
```typescript
// Before: components/NetworkQuality/index.tsx
import { NetworkQuality, RemoteVideoTrackStats } from 'agora-rtc-sdk-ng';

// After: 
import { ConnectionQuality } from '../../types/streaming.types';
// Use unified quality types instead of Agora-specific ones
```

**Day 4-5: App Integration**

Update main application:
```typescript
// 1. Replace main.tsx
cp src/main-unified.tsx src/main.tsx

// 2. Update App.tsx gradually
// Start with provider selection, then migrate other features
```

### Phase 3: Legacy Cleanup (Week 3)

**Remove Agora-Specific Code:**

1. **Remove direct imports:**
```bash
# Find all Agora imports outside providers/
grep -r "from 'agora-rtc-sdk-ng'" src/ --exclude-dir=providers
grep -r "import.*agora-rtc-sdk" src/ --exclude-dir=providers
```

2. **Update agoraHelper.ts:**
```typescript
// Extract provider-agnostic utilities
// Move Agora-specific code to providers/agora/
```

3. **Context cleanup:**
```typescript
// Either remove AgoraContext.tsx entirely
// Or keep as legacy with deprecation warnings
```

## Critical Migration Points

### 1. Type System Alignment

**Current Issue:**
```typescript
// Components use Agora SDK types directly
import { ILocalVideoTrack } from 'agora-rtc-sdk-ng';
```

**Solution:**
```typescript
// Use unified types from our type system
import { VideoTrack } from '../types/streaming.types';

// Add adapter when needed
const adaptVideoTrack = (agoraTrack: ILocalVideoTrack): VideoTrack => {
  return {
    id: agoraTrack.trackMediaStreamTrack?.id || 'unknown',
    kind: 'video',
    enabled: agoraTrack.enabled,
    muted: agoraTrack.muted,
    source: 'camera',
  };
};
```

### 2. Media Controls Integration

**Current Challenge:**
```typescript
// useAudioControls creates Agora tracks directly
const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
```

**Solution Pattern:**
```typescript
// Let provider handle track creation
const { provider } = useStreamingContext();
const audioTrack = await provider.audio.createTrack();
```

### 3. Event Handling Migration

**Current:**
```typescript
// Direct Agora event listening
client.on('user-joined', handleUserJoined);
```

**Target:**
```typescript
// Provider-agnostic events
const { provider } = useStreamingContext();
provider.subscribe(handleStateChange);
```

## Testing Strategy

### 1. Incremental Testing
- Test each migrated component in isolation
- Maintain working Agora functionality during migration
- Use feature flags to toggle between old and new systems

### 2. Type Safety Validation
```bash
# After each change
pnpm typecheck
pnpm lint

# Ensure no `any` types introduced
grep -r ": any" src/ --exclude-dir=node_modules
```

### 3. Functional Testing
- Video streaming works with provider abstraction
- Audio controls function correctly
- Chat messaging operates through unified interface
- Provider switching (when LiveKit/TRTC implemented)

## Success Metrics

**Phase 3B Complete:**
- ✅ Zero Agora SDK imports outside `src/providers/agora/`
- ✅ All components use unified types and contexts
- ✅ `useAgora()` not used in application code
- ✅ App runs with provider abstraction

**Phase 4B Complete:**
- ✅ Provider selection UI functional
- ✅ Runtime provider switching architecture ready
- ✅ Clean separation between infrastructure and application
- ✅ Ready for LiveKit/TRTC implementation

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|-------------|
| **Week 1** | Context & Hooks | New context system, unified hooks |
| **Week 2** | Components | Updated components, app integration |
| **Week 3** | Cleanup | Remove legacy code, finalize migration |

**Total Time:** 3 weeks for complete UI integration
**Result:** True multi-provider support with provider-agnostic application layer
