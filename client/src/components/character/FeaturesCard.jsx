// client/src/components/character/FeaturesCard.jsx
import { useMemo } from 'react';
import srd from '../../data/srd_data.json';

export default function FeaturesCard({ data }) {
  const activeFeatures = useMemo(() => {
    let features = [];
    // Race traits
    if (data.race && srd.races[data.race]) {
      features.push(
        ...(srd.races[data.race].traits || []).map(t => ({ ...t, type: 'Racial' }))
      );
      // Subrace traits (if a subrace exists)
      if (data.subrace && srd.races[data.race].subraces?.[data.subrace]) {
        features.push(
          ...(srd.races[data.race].subraces[data.subrace].traits || []).map(t => ({ ...t, type: 'Subrace' }))
        );
      }
    }
    // Class Features (filter by level)
    if (data.charClass && srd.classes[data.charClass]) {
      features.push(
        ...(srd.classes[data.charClass].features || [])
          .filter(f => f.level <= (data.lvl || 1))
          .map(f => ({ ...f, type: 'Class' }))
      );
      // Subclass features
      if (data.subclass && srd.classes[data.charClass].subclasses?.[data.subclass]) {
        features.push(
          ...(srd.classes[data.charClass].subclasses[data.subclass].features || [])
            .filter(f => f.level <= (data.lvl || 1))
            .map(f => ({ ...f, type: 'Subclass' }))
        );
      }
    }
    return features;
  }, [data.race, data.subrace, data.charClass, data.subclass, data.lvl]);

  return (
    <div className="bg-bgPanel p-4 rounded-xl border border-borderDark">
      <h3 className="text-accentGold font-bold text-[10px] uppercase mb-3 tracking-widest">
        Class & Racial Features
      </h3>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {activeFeatures.length === 0 && (
          <p className="text-[10px] text-textMuted italic text-center py-4">
            No features available. Select a race and class.
          </p>
        )}
        {activeFeatures.map((f, i) => (
          <div key={i} className="bg-bgCard p-2 rounded border border-borderDark text-[10px]">
            <div className="flex justify-between text-accentGold font-bold">
              <span>{f.name}</span>
              <span className="text-[8px] opacity-60">
                {f.type} {f.level !== undefined ? `(Lvl ${f.level})` : ''}
              </span>
            </div>
            <p className="text-textMuted mt-1">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}