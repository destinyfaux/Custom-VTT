// client/src/hooks/useResizable.js
import { useState, useEffect, useCallback } from 'react';

export const useResizable = (storageKey, defaultSize, minSize = 200, maxSize = 600, direction = 'horizontal') => {
    const [size, setSize] = useState(() => {
        const saved = localStorage.getItem(storageKey);
        return saved ? parseInt(saved, 10) : defaultSize;
    });

    const [isDragging, setIsDragging] = useState(false);

    const startDrag = useCallback(() => setIsDragging(true), []);

    useEffect(() => {
        const onMouseMove = (e) => {
            if (!isDragging) return;
            const movement = direction === 'vertical' ? e.movementY : e.movementX;
            const newSize = Math.min(maxSize, Math.max(minSize, size + movement));
            if (newSize !== size) {
                setSize(newSize);
                localStorage.setItem(storageKey, newSize);
            }
        };
        const onMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, size, direction, minSize, maxSize, storageKey]);

    return { size, startDrag };
};