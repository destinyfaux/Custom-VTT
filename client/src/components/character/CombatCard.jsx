// client/src/components/character/CombatCard.jsx

export default function CombatCard({ data, update, liveAC, liveMaxHP, srd, baseSpeed, initiativeBonus }) {
  // Correctly mapping array objects from SRD database
  const armorOptions = [];
  if (srd.equipment?.armor) {
      ['light', 'medium', 'heavy'].forEach(type => {
          if (srd.equipment.armor[type] && Array.isArray(srd.equipment.armor[type])) {
              srd.equipment.armor[type].forEach(armorObj => {
                  armorOptions.push(armorObj.name);
              });
          }
      });
  }

  return (
    <div className="flex flex-col gap-3">
      
      {/* ==========================================
         METRICS PANEL (AC, INITIATIVE, SPEED)
         ========================================== */}
      <div className="grid grid-cols-3 gap-3">
        {/* AC Block with Restored Hover Tooltip */}
        <div className="bg-bgCard p-2.5 rounded-xl border border-accentGold flex flex-col items-center relative group">
          <div className="text-[10px] text-accentGold uppercase font-bold flex items-center gap-1 mb-1 tracking-widest leading-none">
            <svg className="w-3.5 h-3.5 text-accentGold" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-1.998A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
            </svg>
            AC
          </div>
          <div className="text-xl font-extrabold text-white leading-none">{liveAC}</div>
          
          {/* Restored AC Tooltip */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-[9px] p-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-200 border border-borderDark shadow-lg">
             Auto-calculated from Armor & Dex
          </div>
        </div>

        {/* Initiative Block */}
        <div className="bg-bgCard p-2.5 rounded-xl border border-accentGold flex flex-col items-center">
          <div className="text-[10px] text-accentGold uppercase font-bold flex items-center gap-1 mb-1 tracking-widest leading-none">
            <svg className="w-3.5 h-3.5 text-accentGold" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Initiative
          </div>
          <div className="text-xl font-extrabold text-white leading-none">
            {initiativeBonus >= 0 ? `+${initiativeBonus}` : initiativeBonus}
          </div>
        </div>

        {/* Speed Block */}
        <div className="bg-bgCard p-2.5 rounded-xl border border-accentGold flex flex-col items-center">
          <div className="text-[10px] text-accentGold uppercase font-bold flex items-center gap-1 mb-1 tracking-widest leading-none">
            <svg className="w-3.5 h-3.5 text-accentGold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Speed
          </div>
          <div className="text-xl font-extrabold text-white leading-none">
            {baseSpeed} <span className="text-[10px] font-normal text-textMuted ml-0.5">ft</span>
          </div>
        </div>
      </div>

      {/* ==========================================
         EQUIPMENT & SHIELD CONFIGURATION PANEL
         ========================================== */}
      <div className="bg-bgCard p-3 rounded-xl border border-borderDark flex flex-col gap-2.5">
        {/* Horizontal Armor & Shield Selectors */}
        <div className="grid grid-cols-2 gap-3">
          {/* Worn Armor Input */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase text-accentGold font-bold tracking-wider leading-none mb-1">Worn Armor</span>
            <select 
              className="bg-bgPanel text-white border border-borderDark rounded-lg px-2 py-1 outline-none focus:border-accentGold w-full text-[11px] h-8"
              value={data.equippedArmor || ''}
              onChange={(e) => update('equippedArmor', e.target.value)}
            >
              <option value="">None (Unarmored)</option>
              {armorOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Shield Selection Block */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase text-accentGold font-bold tracking-wider leading-none mb-1">Shield Equipped</span>
            <div className="flex items-center bg-bgPanel border border-borderDark rounded-lg px-2.5 h-8 justify-between">
              <span className="text-textMuted text-[9px] uppercase tracking-widest font-bold">Worn</span>
              <input 
                type="checkbox" 
                className="accent-accentGold w-3.5 h-3.5 rounded cursor-pointer" 
                checked={data.equippedShield || false} 
                onChange={e => update('equippedShield', e.target.checked)} 
              />
            </div>
          </div>
        </div>
        
        {/* Misc AC Modifier Bonus */}
        <div className="flex justify-between items-center text-xs bg-bgPanel/40 p-1.5 rounded-lg border border-borderDark/40">
          <span className="text-textLight text-[10px] font-medium pl-1">Misc AC Bonus (Magic)</span>
          <input 
            type="number" 
            className="bg-bgPanel text-white text-center border border-borderDark rounded-lg p-1 outline-none w-14 focus:border-accentGold text-[11px] h-7" 
            value={data.acBonus || 0} 
            onChange={e => update('acBonus', parseInt(e.target.value) || 0)} 
          />
        </div>
      </div>

      {/* ==========================================
         VITALITY SECTION (HP CONTROLS)
         ========================================== */}
      <div className="bg-bgCard p-4 rounded-xl border border-borderDark">
        <div className="text-[11px] uppercase tracking-widest font-bold text-accentGold mb-3 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-accentGold" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            Health Points (HP)
        </div>
        
        {/* Tightened HP Grid Configuration */}
        <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="flex flex-col items-center">
                <label className="text-[9px] text-textMuted uppercase mb-1 font-bold tracking-widest leading-none">Current</label>
                <input 
                  type="number" 
                  className="w-full bg-bgPanel p-2 rounded-lg text-center text-white border border-borderDark outline-none focus:border-accentGold text-lg font-bold h-9" 
                  value={data.hpCur || 0} 
                  onChange={(e) => update('hpCur', parseInt(e.target.value) || 0)} 
                />
            </div>
            
            <div className="flex flex-col items-center">
                <label className="text-[9px] text-textMuted uppercase mb-1 font-bold tracking-widest leading-none">Max</label>
                <div className="w-full bg-bgPanel p-2 rounded-lg text-center text-white border border-borderDark opacity-80 cursor-not-allowed text-lg font-bold flex items-center justify-center relative group h-9">
                    {liveMaxHP}
                    
                    {/* Restored Info Icon SVG */}
                    <svg className="w-2.5 h-2.5 text-textMuted absolute right-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>

                    {/* Restored Max HP Tooltip */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black text-[9px] p-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-200 border border-borderDark shadow-lg leading-normal">
                      Auto-calculated from Class &amp; Level
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col items-center">
                <label className="text-[9px] text-textMuted uppercase mb-1 font-bold tracking-widest leading-none">Temp</label>
                <input 
                  type="number" 
                  className="w-full bg-bgPanel p-2 rounded-lg text-center text-white border border-borderDark outline-none focus:border-accentGold text-lg font-bold h-9" 
                  value={data.hpTemp || 0} 
                  onChange={(e) => update('hpTemp', parseInt(e.target.value) || 0)} 
                />
            </div>
        </div>
        
        {/* Restore HP Controls Row */}
        <div className="flex items-center gap-3 bg-bgPanel p-2 rounded-lg border border-borderDark/40">
          <button
            onClick={() => update('hpCur', liveMaxHP)}
            className="text-[9px] bg-accentGold text-bgDark font-extrabold px-3 py-1.5 rounded hover:bg-yellow-500 transition-colors shrink-0 uppercase tracking-wider"
          >
            Restore HP
          </button>
          <span className="text-[9px] text-textMuted italic leading-tight">
             Max HP auto-calculated from Class &amp; Level.
          </span>
        </div>
      </div>

      {/* Heroic Inspiration Toggle */}
      <div className="flex items-center justify-between bg-bgCard p-2.5 rounded-xl border border-borderDark text-xs text-textLight">
        <div className="flex items-center gap-2 font-bold text-[9px] uppercase text-accentGold tracking-wider">
            <svg className="w-4 h-4 text-accentGold" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
            </svg>
            Heroic Inspiration
        </div>
        <input 
          type="checkbox" 
          className="accent-accentGold w-4 h-4 rounded cursor-pointer" 
          checked={data.heroicInspiration || false} 
          onChange={e => update('heroicInspiration', e.target.checked)} 
        />
      </div>

    </div>
  );
}