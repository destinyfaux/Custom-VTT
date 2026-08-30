// client/src/hooks/useDraggableResizable.js
import { useState, useRef, useEffect, useCallback } from 'react';

export function useDraggableResizable(
  initialPos = { x: 100, y: 100 }, 
  initialSize = { w: 400, h: 500 }, 
  minSize = { w: 200, h: 200 }
) {
  const [pos, setPos] = useState(initialPos);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, mouseX: 0, mouseY: 0 });

  const handleMouseDown = useCallback((e) => {
    // Only initiate drag if clicking the header or an element inside the header
    if (e.target.tagName.toLowerCase() === 'header' || e.target.closest('header')) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  }, [pos]);

  const handleResizeDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { w: size.w, h: size.h, mouseX: e.clientX, mouseY: e.clientY };
  }, [size]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const onMouseMove = (e) => {
      if (isDragging) {
        setPos({
          x: Math.max(0, e.clientX - dragStart.current.x),
          y: Math.max(0, e.clientY - dragStart.current.y)
        });
      }
      if (isResizing) {
        setSize({
          w: Math.max(minSize.w, resizeStart.current.w + (e.clientX - resizeStart.current.mouseX)),
          h: Math.max(minSize.h, resizeStart.current.h + (e.clientY - resizeStart.current.mouseY))
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
  }, [isDragging, isResizing, minSize]);

  return { pos, size, handleMouseDown, handleResizeDown };
}