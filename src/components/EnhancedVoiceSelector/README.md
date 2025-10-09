# Enhanced Voice Selector

A comprehensive voice selection component that supports both VoiceClone (type 1) and Akool Voices (type 2) with rich information display, search, filtering, and audio preview capabilities.

## Features

- **Dual Voice Type Support**: VoiceClone (custom) and Akool Voices (pre-built)
- **Rich Voice Information**: Language, gender, age, model, style, scenario, and sample text
- **Audio Preview**: Inline audio player for voice previews
- **Search & Filter**: Search by name, language, description with filters for language, gender, and age
- **Grouped Display**: Voices organized by type with collapsible groups
- **Manual Input**: Toggle between voice selection and manual voice ID/URL input
- **Responsive Design**: Mobile-friendly card-based layout
- **Accessibility**: Full keyboard navigation and screen reader support

## Usage

```tsx
import React, { useState } from 'react';
import { ApiService } from '../apiService';
import EnhancedVoiceSelector from './components/EnhancedVoiceSelector';

const MyComponent = () => {
  const [voiceId, setVoiceId] = useState('');
  const [voiceUrl, setVoiceUrl] = useState('');
  const apiService = new ApiService('your-api-host', 'your-api-token');

  return (
    <EnhancedVoiceSelector
      voiceId={voiceId}
      setVoiceId={setVoiceId}
      voiceUrl={voiceUrl}
      setVoiceUrl={setVoiceUrl}
      apiService={apiService}
      disabled={false}
    />
  );
};
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `voiceId` | `string` | Yes | Currently selected voice ID |
| `setVoiceId` | `(id: string) => void` | Yes | Callback to update voice ID |
| `voiceUrl` | `string` | Yes | Currently selected voice URL |
| `setVoiceUrl` | `(url: string) => void` | Yes | Callback to update voice URL |
| `apiService` | `ApiService` | Yes | API service instance for fetching voices |
| `disabled` | `boolean` | No | Whether the component is disabled (default: false) |

## Components

### VoicePreview
Audio player component for voice previews with play/pause/stop controls.

### VoiceCard
Rich voice information display with all voice properties, tags, and preview controls.

### VoiceGroup
Grouped voice display with collapsible sections for different voice types.

### EnhancedVoiceSelector
Main component that orchestrates all voice selection functionality.

## Styling

All components use CSS modules with modern, responsive design:
- Card-based layout with hover effects
- Consistent color scheme and typography
- Mobile-responsive grid system
- Accessible focus states and transitions

## API Integration

The component uses the `ApiService.getAllVoices()` method to fetch both voice types in parallel and group them appropriately.

## Accessibility

- Full keyboard navigation support
- ARIA labels and roles
- Screen reader friendly
- High contrast focus indicators
- Semantic HTML structure
