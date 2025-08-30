import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UnifiedStreamingProvider } from './contexts/UnifiedStreamingContext';
import { NotificationProvider } from './contexts/NotificationContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <UnifiedStreamingProvider>
        <App />
      </UnifiedStreamingProvider>
    </NotificationProvider>
  </React.StrictMode>,
);
