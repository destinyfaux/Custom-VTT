import { useState } from 'react';
import { socket } from '../socket';
import CharacterSheet from './character/CharacterSheet';
import GearModal from './character/GearModal'; // ★ New Import

    const tabs = [
    { id: 'stats',      label: 'Stats',       icon: '👤' },
    { id: 'skills',     label: 'Skills',      icon: '📋' },
    { id: 'senses',     label: 'Senses',      icon: '👁️' },
    { id: 'actions',    label: 'Actions',     icon: '⚔️' },
    { id: 'gear',       label: 'Gear',        icon: '🎒' },
    { id: 'features',   label: 'Features',    icon: '⭐' },
    { id: 'spells',     label: 'Spells',      icon: '🧙🏻‍♂️' },
    { id: 'appearance', label: 'Appearance',  icon: '🧬' },
    { id: 'journal',    label: 'Journal',     icon: '📖' },
    ];

export default function DMCharacterViewer({ initialData, targetUserId, onClose }) {
    const [activeTab, setActiveTab] = useState('stats');
    const [sheetData, setSheetData] = useState(initialData || {});
    const [showDMGearModal, setShowDMGearModal] = useState(false); // ★ DM Pop-out toggle

    const handleSaveToPlayer = () => {
        socket.emit('save_player_sheet', {
            targetUserId,
            data: sheetData
        });
        // Optionally show a brief confirmation, then close or keep open
        // We'll just close after saving
        onClose();
    };

    const handleDMUpdateField = (key, value) => {
        const updated = { ...sheetData, [key]: value };
        setSheetData(updated);
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* ★ DM GEarmodal Overlap populated with active inspected player details */}
            {showDMGearModal && (
                <GearModal
                    data={sheetData}
                    update={handleDMUpdateField}
                    role="DM"
                    targetUserId={targetUserId}   // ← add this line
                    onClose={() => setShowDMGearModal(false)}
                />
            )}

            {/* Header with Save button */}
            <div className="bg-bgCard p-3 flex justify-between items-center border-b border-borderDark shrink-0">
                <h2 className="text-accentGold font-bold text-sm uppercase tracking-widest">
                    Viewing: {initialData.name || 'Adventurer'}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveToPlayer}
                        className="px-3 py-1 text-[10px] font-bold bg-green-700 text-white rounded hover:bg-green-600"
                    >
                        Save to Player
                    </button>
                    <button onClick={onClose} className="text-textMuted hover:text-white px-2 text-xl">✕</button>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 mb-4 overflow-x-auto border-b border-borderDark pb-2 px-4 pt-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-xs px-3 py-1 rounded-t whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-bgCard text-accentGold border-b-2 border-accentGold'
                                : 'text-textMuted hover:text-white hover:bg-bgCard'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Character sheet */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {activeTab === 'gear' ? (
                    /* ★ DM GEAR BRIDGE PANEL */
                    <div className="bg-bgCard p-6 rounded-xl border border-accentGold/40 text-center flex flex-col items-center justify-center py-16 space-y-4">
                        <span className="text-5xl animate-bounce">🎒</span>
                        <h3 className="text-accentGold font-bold text-sm uppercase tracking-widest">
                            Equipment & Companion Hub
                        </h3>
                        <p className="text-xs text-textMuted max-w-sm">
                            As DM, you have complete authority to view, edit, and adjust {sheetData.name || 'this player'}'s coin values, companion creatures, item stacks, and equipped statuses.
                        </p>
                        <button
                            onClick={() => setShowDMGearModal(true)}
                            className="bg-accentGold text-black font-extrabold text-xs px-6 py-2.5 rounded-lg hover:bg-yellow-500 transition-colors uppercase tracking-wider"
                        >
                            Open Player Inventory Sheet
                        </button>
                    </div>
                ) : (
                <CharacterSheet
                    tab={activeTab}
                    readOnly={false}        // DM can edit
                    externalData={sheetData}
                    role="DM"
                    onUpdate={setSheetData} // keep state up‑to‑date
                />
                )}
            </div>
        </div>
    );
}