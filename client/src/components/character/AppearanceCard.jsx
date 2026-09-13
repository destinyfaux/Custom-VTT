// client/src/components/character/AppearanceCard.jsx

export default function AppearanceCard({ data, update }) {
  const nameplateThemes = [
    { id: 'gold', label: 'Gilded', color: '#e6b422' },
    { id: 'crimson', label: 'Crimson', color: '#ef4444' },
    { id: 'verdant', label: 'Verdant', color: '#34d399' },
    { id: 'azure', label: 'Azure', color: '#60a5fa' },
  ];

  const fields = [
    { label: 'Gender', id: 'gender' },
    { label: 'Age', id: 'age' },
    { label: 'Faith', id: 'faith' },
    { label: 'Size', id: 'size' },
    { label: 'Skin', id: 'skin' },
    { label: 'Eyes', id: 'eyes' },
    { label: 'Hair', id: 'hair' },
    { label: 'Weight (lbs)', id: 'weight' },
  ];

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
      <h3 className="text-accentGold font-bold text-[10px] uppercase mb-4 tracking-widest">
        Appearance
      </h3>
      <div className="mb-4 rounded-lg border border-accentGold/30 bg-bgCard p-3">
        <div className="text-[9px] text-accentGold uppercase tracking-widest font-bold mb-2">Party nameplate</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-textMuted uppercase">Subtitle</label>
            <input
              type="text"
              maxLength={28}
              placeholder="Ranger, healer, captain..."
              className="bg-bgPanel text-white border border-borderDark rounded p-1.5 text-xs focus:border-accentGold outline-none"
              value={data.nameplateTagline || ''}
              onChange={e => update('nameplateTagline', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-textMuted uppercase">Accent</label>
            <div className="flex items-center gap-1.5 h-full">
              {nameplateThemes.map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  aria-label={`${theme.label} nameplate accent`}
                  title={theme.label}
                  onClick={() => update({ nameplateTheme: theme.id, nameplateColor: theme.color })}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${data.nameplateTheme === theme.id ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: theme.color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.id} className="flex flex-col gap-1">
            <label className="text-[9px] text-textMuted uppercase">{field.label}</label>
            <input
              type="text"
              className="bg-bgCard text-white border border-borderDark rounded p-1.5 text-xs focus:border-accentGold outline-none"
              value={data[field.id] || ''}
              onChange={e => update(field.id, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}