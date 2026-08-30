import { useEffect, useRef } from 'react';
import { socket } from '../socket';

export const useSync = (data, isDM) => {
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Throttle strategy:
        // We can create a simple timeout to batch non-critical updates
        const handler = setTimeout(() => {
            socket.emit('sync_character_data', data);
        }, 1000); // 1 second buffer

        return () => clearTimeout(handler);
    }, [data]);
};