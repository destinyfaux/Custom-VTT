// Defensive guard for environments with getter-only window.fetch
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  try {
    const origFetch = window.fetch.bind(window);
    let currentFetch = origFetch;
    Object.defineProperty(window, 'fetch', {
      get: () => currentFetch,
      set: (fn) => {
        currentFetch = typeof fn === 'function' ? fn : origFetch;
      },
      configurable: true,
      enumerable: true
    });
  } catch {
    // Non-blocking if already configurable or sealed
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
