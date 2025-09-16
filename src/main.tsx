import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StreamingContextProvider } from './contexts/StreamingContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useConfigurationStore } from './stores/configurationStore';

// Wrapper component to access configuration store
export const AppWithProvider: React.FC = () => {
  const selectedProvider = useConfigurationStore((state) => state.selectedProvider);

  return (
    <StreamingContextProvider defaultProvider={selectedProvider}>
      <App />
    </StreamingContextProvider>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <NotificationProvider>
      <AppWithProvider />
    </NotificationProvider>
  </React.StrictMode>,
);
