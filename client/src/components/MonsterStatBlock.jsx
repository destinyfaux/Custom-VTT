export default function MonsterStatBlock({ monster, onClose }) {
    if (!monster) return null;
    const m = monster;
    const mod = (score) => Math.floor((score - 10) / 2);
    const formatMod = (val) => val >= 0 ? `+${val}` : `${val}`;

    return (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60">
            <div className="bg-bgPanel border border-accentGold rounded-xl w-[500px] max-h-[80vh] shadow-2xl flex flex-col">
                <header className="bg-bgCard p-3 flex justify-between items-center border-b border-borderDark">
                    <div>
                        <h2 className="text-accentGold font-bold text-lg">{m.name || 'Unknown'}</h2>
                        <p className="text-textMuted text-xs">{m.size} {m.type}, {m.alignment}</p>
                    </div>
                    <button onClick={onClose} className="text-textMuted hover:text-white text-xl">✕</button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                    <div className="flex gap-4">
                        <span><strong>AC:</strong> {m.ac} {m.ac_type ? `(${m.ac_type})` : ''}</span>
                        <span><strong>HP:</strong> {m.hp} ({m.hit_dice})</span>
                        <span><strong>Speed:</strong> {Object.entries(m.speed || {}).map(([k,v]) => `${k} ${v}ft`).join(', ')}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1 text-center">
                        {Object.entries(m.ability_scores || {}).map(([ab, score]) => (
                            <div key={ab} className="bg-bgCard p-1 rounded">
                                <div className="text-accentGold font-bold">{ab}</div>
                                <div className="text-white">{score} ({formatMod(mod(score))})</div>
                            </div>
                        ))}
                    </div>
                    {Object.keys(m.saving_throws || {}).length > 0 && <div><strong>Saves:</strong> {Object.entries(m.saving_throws).map(([k,v]) => `${k} ${formatMod(v)}`).join(', ')}</div>}
                    {Object.keys(m.skills || {}).length > 0 && <div><strong>Skills:</strong> {Object.entries(m.skills).map(([k,v]) => `${k} ${formatMod(v)}`).join(', ')}</div>}
                    {m.damage_resistances?.length > 0 && <div><strong>Resistances:</strong> {m.damage_resistances.join(', ')}</div>}
                    {m.damage_immunities?.length > 0 && <div><strong>Immunities:</strong> {m.damage_immunities.join(', ')}</div>}
                    {m.damage_vulnerabilities?.length > 0 && <div><strong>Vulnerabilities:</strong> {m.damage_vulnerabilities.join(', ')}</div>}
                    {m.condition_immunities?.length > 0 && <div><strong>Condition Immunities:</strong> {m.condition_immunities.join(', ')}</div>}
                    <div><strong>Senses:</strong> {Object.entries(m.senses || {}).map(([k,v]) => `${k.replace(/_/g,' ')} ${v}`).join(', ')}</div>
                    <div><strong>Languages:</strong> {m.languages || '—'}</div>
                    <div><strong>CR:</strong> {m.challenge_rating} ({m.xp} XP)</div>

                    {m.traits?.length > 0 && <Section title="Traits" items={m.traits} />}
                    {m.actions?.length > 0 && <Section title="Actions" items={m.actions} />}
                    {m.legendary_actions?.length > 0 && <LegendarySection items={m.legendary_actions} />}
                    {m.reactions?.length > 0 && <Section title="Reactions" items={m.reactions} />}
                    {m.description && <div className="text-textMuted italic">{m.description}</div>}
                </div>
            </div>
        </div>
    );
}

function Section({ title, items }) {
    return (
        <div>
            <h3 className="text-accentGold font-bold border-b border-borderDark pb-1 mb-1">{title}</h3>
            {items.map((item, i) => (
                <div key={i} className="mb-1">
                    <span className="text-white font-semibold">{item.name}.</span> <span className="text-textLight">{item.description}</span>
                </div>
            ))}
        </div>
    );
}

function LegendarySection({ items }) {
    return (
        <div>
            <h3 className="text-accentGold font-bold border-b border-borderDark pb-1 mb-1">Legendary Actions</h3>
            {items.map((item, i) => (
                <div key={i} className="mb-1">
                    <span className="text-white font-semibold">{item.name} {item.cost ? `(Costs ${item.cost} Actions)` : ''}.</span> <span className="text-textLight">{item.description}</span>
                </div>
            ))}
        </div>
    );
}