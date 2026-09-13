import { useState, useEffect } from 'react';
import { SERVER_URL } from '../../config';

export default function PremadeBrowser({ onLoad }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(`${SERVER_URL}/api/premades`)
            .then(r => r.json())
            .then(setFiles)
            .catch(() => setFiles([]));
    }, []);

    const loadCharacter = (filename) => {
        setLoading(true);
        fetch(`${SERVER_URL}/api/premades/${encodeURIComponent(filename)}`)
            .then(r => r.json())
            .then(data => {
                onLoad(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    if (files.length === 0) {
        return <p className="text-[10px] text-textMuted italic">No pre-made characters found. Drop JSON files in server/assets/premades/</p>;
    }

    return (
        <div className="space-y-1 max-h-40 overflow-y-auto">
            {files.map(f => (
                <button
                    key={f}
                    onClick={() => loadCharacter(f)}
                    disabled={loading}
                    className="w-full text-left text-[10px] bg-bgCard p-2 rounded border border-borderDark hover:border-accentGold transition-colors text-textLight"
                >
                    📜 {f.replace('.json', '').replace(/_/g, ' ')}
                </button>
            ))}
        </div>
    );
}