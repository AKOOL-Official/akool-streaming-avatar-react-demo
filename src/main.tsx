import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StreamingContextProvider } from './contexts/StreamingContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StreamingContextProvider defaultProvider="agora">
      <App />
    </StreamingContextProvider>
  </React.StrictMode>,
);
