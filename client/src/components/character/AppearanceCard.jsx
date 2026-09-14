// client/src/components/character/AppearanceCard.jsx
// Appearance tab — physical traits plus the PLAYER CARD STUDIO: live-previewed
// nameplate customization (tagline, accent color, animated frame FX, and
// background preset). Everything persists through the normal character sync.

import { CARD_FRAMES, CARD_BACKGROUNDS, NAMEPLATE_ACCENTS } from '../../data/cardStyles';
import PartyPlayerCard from '../PartyPlayerCard';

export default function AppearanceCard({ data, update }) {
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

  const accent = data.nameplateColor || '#e6b422';

  // Mock presence entry so the studio preview renders EXACTLY what the party
  // panel will show for this character.
  const previewPlayer = {
    userId: 'preview',
    name: data.name || 'Your Hero',
    status: 'online',
    characterData: { ...data },
  };

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
      <h3 className="text-accentGold font-bold text-[10px] uppercase mb-4 tracking-widest">
        Appearance
      </h3>

      {/* ─── PLAYER CARD STUDIO ─── */}
      <div className="mb-4 rounded-lg border border-accentGold/30 bg-bgCard p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] text-accentGold uppercase tracking-widest font-bold">Player card studio</div>
          <span className="text-[8px] text-textMuted italic">live preview</span>
        </div>

        {/* Live preview of the party card */}
        <div className="mb-3 rounded-md border border-borderDark/60 overflow-hidden">
          <PartyPlayerCard player={previewPlayer} isOwn showStats={false} />
        </div>

        {/* Tagline */}
        <label className="text-[9px] text-textMuted uppercase">Card subtitle</label>
        <input
          type="text"
          maxLength={28}
          placeholder="Ranger, healer, captain..."
          className="mt-1 mb-3 w-full bg-bgPanel text-white border border-borderDark rounded p-1.5 text-xs focus:border-accentGold outline-none"
          value={data.nameplateTagline || ''}
          onChange={e => update('nameplateTagline', e.target.value)}
        />

        {/* Accent color */}
        <label className="text-[9px] text-textMuted uppercase">Accent color</label>
        <div className="flex items-center gap-1.5 mt-1 mb-3 flex-wrap">
          {NAMEPLATE_ACCENTS.map(theme => (
            <button
              key={theme.id}
              type="button"
              aria-label={`${theme.label} accent`}
              title={`${theme.label} accent`}
              onClick={() => update({ nameplateTheme: theme.id, nameplateColor: theme.color })}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${accent === theme.color ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: theme.color }}
            />
          ))}
          <label
            className="relative w-6 h-6 rounded-full border-2 border-dashed border-borderDark hover:border-accentGold transition-transform hover:scale-110 cursor-pointer flex items-center justify-center text-[9px] text-textMuted"
            title="Custom color"
          >
            +
            <input
              type="color"
              className="absolute inset-0 opacity-0 cursor-pointer"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#e6b422'}
              onChange={e => update({ nameplateTheme: 'custom', nameplateColor: e.target.value })}
            />
          </label>
        </div>

        {/* Frame FX */}
        <label className="text-[9px] text-textMuted uppercase">Frame FX</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1 mb-3">
          {CARD_FRAMES.map(frame => {
            const selected = (data.cardFrame || 'none') === frame.id;
            return (
              <button
                key={frame.id}
                type="button"
                title={frame.hint}
                onClick={() => update('cardFrame', frame.id)}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[8px] font-bold uppercase tracking-wide transition-all hover:scale-105 ${
                  selected
                    ? 'border-accentGold bg-accentGold/15 text-accentGold'
                    : 'border-borderDark bg-bgPanel text-textMuted hover:text-white'
                }`}
              >
                <span className="text-sm leading-none">{frame.icon}</span>
                {frame.label}
              </button>
            );
          })}
        </div>

        {/* Background */}
        <label className="text-[9px] text-textMuted uppercase">Card background</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {CARD_BACKGROUNDS.map(bg => {
            const selected = (data.cardBg || 'default') === bg.id;
            return (
              <button
                key={bg.id}
                type="button"
                title={`${bg.label} background`}
                onClick={() => update('cardBg', bg.id)}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-lg border transition-all hover:scale-105 ${
                  selected
                    ? 'border-accentGold bg-accentGold/15'
                    : 'border-borderDark hover:border-borderDark/60'
                }`}
              >
                <span
                  className="w-full h-4 rounded border border-black/40"
                  style={{ background: bg.swatch }}
                />
                <span className={`text-[8px] font-bold uppercase tracking-wide ${selected ? 'text-accentGold' : 'text-textMuted'}`}>
                  {bg.label}
                </span>
              </button>
            );
          })}
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
