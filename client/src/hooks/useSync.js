import { useEffect, useRef } from 'react';
import { socket } from '../socket';

export const useSync = (data, isDM) => {
    const isFirstRender = useRef(true);
    // Keep the latest payload in a ref so an unmount flush can send it even
    // though the effect that owns the debounce timer is already torn down.
    const dataRef = useRef(data);
    dataRef.current = data;

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Throttle strategy:
        // We can create a simple timeout to batch non-critical updates
        const handler = setTimeout(() => {
            socket.emit('sync_character_data', dataRef.current);
        }, 1000); // 1 second buffer

        return () => clearTimeout(handler);
    }, [data]);

    // Flush on unmount: without this, closing the sheet/drawer within the
    // 1s debounce window silently DISCARDED the pending sync (the timer was
    // cleared and the emit never happened), so the last edits never reached
    // the server or the rest of the party.
    useEffect(() => {
        return () => {
            if (!isFirstRender.current) {
                socket.emit('sync_character_data', dataRef.current);
            }
        };
    }, []);
};
