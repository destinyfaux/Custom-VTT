// client/src/components/ConnectionStatus.jsx
import { useState, useEffect, useCallback } from 'react';
import { socket } from '../socket';

export default function ConnectionStatus({ isSynced }) {
  const [ping, setPing] = useState(null);
  const [fps, setFps] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(() => {
    // Read from localStorage on initial render
    const stored = localStorage.getItem('connectionStatusVisible');
    return stored !== null ? JSON.parse(stored) : true;
  });

  // Persist visibility changes
  useEffect(() => {
    localStorage.setItem('connectionStatusVisible', JSON.stringify(isVisible));
  }, [isVisible]);

  // 1. High-Precision Monotonic Ping Measurement (every 5 seconds)
  useEffect(() => {
    const measurePing = () => {
      const start = performance.now();
      
      // We use monotonic performance.now() to measure round-trip latency without system clock interference
      socket.emit('ping_req', start, () => {
        const latency = Math.round(performance.now() - start);
        setPing(latency);
      });
    };

    measurePing();
    const interval = setInterval(measurePing, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. High-Performance FPS Counter (Runs without continuous garbage-collection heap allocation)
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId;

    const loop = () => {
      frameCount++;
      const now = performance.now();
      
      // Calculate and commit current frame count once per second
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 3. Resync Handler with Active UI Feedback
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    socket.emit('request_full_state');
    
    // Brief visual feedback transition
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, []);

  // Helper function to color code Ping values
  const getPingColor = (p) => {
    if (p === null) return 'text-textMuted';
    if (p <= 60) return 'text-green-400';
    if (p <= 150) return 'text-yellow-400';
    if (p <= 300) return 'text-orange-400';
    return 'text-red-400';
  };

  // Helper function to color code FPS values
  const getFpsColor = (f) => {
    if (f === null) return 'text-textMuted';
    if (f <= 29) return 'text-red-400';
    if (f <= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  // Toggle visibility
  const toggleVisibility = () => setIsVisible(prev => !prev);

  // If hidden, show only a small “show” button
  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className="fixed top-6 right-[175px] z-[300] bg-bgCard/80 backdrop-blur-sm border border-borderDark rounded-full w-8 h-8 flex items-center justify-center text-textMuted hover:text-accentGold transition-colors shadow-lg"
        aria-label="Show connection status"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    );
  }

  // Main panel – positioned top‑right with a slight nudge to the left
  return (
    <div className="fixed top-6 right-[175px] z-[300] bg-bgCard/90 backdrop-blur-sm border border-borderDark rounded-lg px-1 py-1.5 text-[10px] flex items-center gap-2 shadow-lg select-none whitespace-nowrap">
      {/* FPS Display */}
      <span className="text-textMuted">
        FPS:{' '}
        <span className={`font-bold ${getFpsColor(fps)}`}>
          {fps !== null ? fps : '—'}
        </span>
      </span>

      <div className="w-[1px] h-3 bg-borderDark" />

      {/* Latency Display */}
      <span className="text-textMuted">
        PING:{' '}
        <span className={`font-bold ${getPingColor(ping)}`}>
          {ping !== null ? `${ping}ms` : '—'}
        </span>
      </span>

      <div className="w-[1px] h-3 bg-borderDark" />

      {/* Sync State Indicator */}
      <span className="text-textMuted">
        Sync:{' '}
        <span className={`font-bold ${isSynced ? 'text-green-400' : 'text-red-400'}`}>
          {isSynced ? 'IN' : 'OUT'}
        </span>
      </span>

      <div className="w-[1px] h-3 bg-borderDark" />

      {/* Interactive Resync Button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`text-textMuted hover:text-accentGold underline transition-all duration-200 text-[9px] font-normal uppercase tracking-normal ${
          isRefreshing ? 'opacity-50 text-accentGold scale-75 cursor-wait' : ''
        }`}
      >
        {isRefreshing ? 'Syncing' : 'Resync'}
      </button>

      {/* Hide Button */}
      <button
        onClick={toggleVisibility}
        className="ml-1 text-textMuted hover:text-red-400 transition-colors text-xs leading-none"
        aria-label="Hide connection status"
      >
        ✕
      </button>
    </div>
  );
}