import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StreamingContextProvider } from './contexts/StreamingContext';
import { NotificationProvider } from './contexts/NotificationContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <StreamingContextProvider defaultProvider="agora">
        <App />
      </StreamingContextProvider>
    </NotificationProvider>
  </React.StrictMode>,
);
