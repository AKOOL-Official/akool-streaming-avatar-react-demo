import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UnifiedStreamingProvider } from './contexts/UnifiedStreamingContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UnifiedStreamingProvider>
      <App />
    </UnifiedStreamingProvider>
  </React.StrictMode>,
);
