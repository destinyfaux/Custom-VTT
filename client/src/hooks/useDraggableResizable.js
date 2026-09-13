// client/src/hooks/useDraggableResizable.js
import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hardened hook for floating modal windows.
 * - Handles drag initiation via <header> or elements with .drag-handle
 * - Ignores drag when clicking buttons, inputs, or interactive elements
 * - Clamps position and size within viewport boundaries
 * - Provides clean unmount protection
 */
export function useDraggableResizable({
  initialPos = { x: 100, y: 100 },
  initialSize = { w: 400, h: 500 },
  minSize = { w: 200, h: 200 },
  maxSize = { w: window.innerWidth - 40, h: window.innerHeight - 40 }
} = {}) {
  // Allow functions or dynamic initial values
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, Math.min(window.innerWidth - initialSize.w - 20, initialPos.x)),
    y: Math.max(0, Math.min(window.innerHeight - initialSize.h - 20, initialPos.y))
  }));
  const [size, setSize] = useState(initialSize);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });
  const posRef = useRef(pos);
  const sizeRef = useRef(size);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // Handle window resizing: keep window within visible bounds
  useEffect(() => {
    const handleWindowResize = () => {
      setPos(prev => ({
        x: Math.max(0, Math.min(window.innerWidth - sizeRef.current.w, prev.x)),
        y: Math.max(0, Math.min(window.innerHeight - 40, prev.y))
      }));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const handleMouseDown = useCallback((e) => {
    // Ignore right click
    if (e.button !== 0) return;

    // Ignore interactive elements inside headers (close buttons, inputs, selects)
    if (e.target.closest('button, input, select, textarea, [data-no-drag]')) {
      return;
    }

    // Only initiate drag if clicking the header or explicit drag-handle
    const isHeader = e.target.tagName.toLowerCase() === 'header' || e.target.closest('header');
    const isDragHandle = e.target.classList.contains('drag-handle') || e.target.closest('.drag-handle');

    if (isHeader || isDragHandle) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - posRef.current.x,
        y: e.clientY - posRef.current.y
      };
    }
  }, []);

  const handleResizeDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    resizeStartRef.current = {
      w: sizeRef.current.w,
      h: sizeRef.current.h,
      mouseX: e.clientX,
      mouseY: e.clientY
    };
  }, []);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const onMouseMove = (e) => {
      if (isDragging) {
        const maxX = window.innerWidth - 60; // Keep at least 60px visible horizontally
        const maxY = window.innerHeight - 40; // Keep at least header visible vertically

        setPos({
          x: Math.max(0, Math.min(maxX, e.clientX - dragStartRef.current.x)),
          y: Math.max(0, Math.min(maxY, e.clientY - dragStartRef.current.y))
        });
      }

      if (isResizing) {
        const currentMinW = minSize.w || 200;
        const currentMinH = minSize.h || 200;
        const currentMaxW = maxSize.w || window.innerWidth - 20;
        const currentMaxH = maxSize.h || window.innerHeight - 20;

        const newW = resizeStartRef.current.w + (e.clientX - resizeStartRef.current.mouseX);
        const newH = resizeStartRef.current.h + (e.clientY - resizeStartRef.current.mouseY);

        setSize({
          w: Math.max(currentMinW, Math.min(currentMaxW, newW)),
          h: Math.max(currentMinH, Math.min(currentMaxH, newH))
        });
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, isResizing, minSize.w, minSize.h, maxSize.w, maxSize.h]);

  return {
    pos,
    size,
    isDragging,
    isResizing,
    handleMouseDown,
    handleResizeDown,
    setPos,
    setSize
  };
}