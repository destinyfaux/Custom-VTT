// client/src/components/Sidebar.jsx
import { useState } from 'react';
import CharacterSheet from './character/CharacterSheet';
import soundSynthesizer from '../utils/SoundSynthesizer';
import OptionsModal from './OptionsModal';

export default function Sidebar({
  role,
  name,
  measureActive,
  setMeasureActive,
  pingActive,
  setPingActive,
  onOpenGear,
  onOpenStats, // New callback prop to launch the pop-out Character Sheet Modal
  // FX: props
  fxActive,
  onToggleFX,
  // Shape: props
  shapeActive,
  onToggleShape,
}) {
  const [activeTab, setActiveTab] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  // Filtered array containing only the quick-access sliding drawer panels
  const tabs = [
    { id: 'skills', label: 'Skills', icon: '📋', title: 'Skill Proficiencies & Dynamic Modifier Calculations' },
    { id: 'actions', label: 'Actions', icon: '⚔️', title: 'Combat Actions, Spell Slots & Hit Dice Tracker' },
    { id: 'features', label: 'Features', icon: '⭐', title: 'Racial Traits, Class Features & Subclass Bonuses' },
    { id: 'feats', label: 'Feats', icon: '🏆', title: 'Acquired Perks & Feats Library' },
    { id: 'spells', label: 'Spells', icon: '🧙🏻‍♂️', title: 'Spellbook Management & Level Filtering' },
    { id: 'appearance', label: 'Appearance', icon: '🧬', title: 'Character Physical Trait Fields' },
    { id: 'journal', label: 'Journal', icon: '📖', title: 'Biography, Personality Traits & Narrative Notes' },
  ];

  // Helper to toggle a tab (close if already open)
  const toggleTab = (tabId) => {
    soundSynthesizer.playUIClick();
    setActiveTab(prev => (prev === tabId ? null : tabId));
  };

  return (
    <>
      {/* 
        Dock Icons Container: 
        Added 'w-16' to lock the background width and prevent stretching.
        Buttons will now cleanly overflow to the left.
      */}
      <div className="absolute right-0 top-20 z-40 w-16 flex flex-col gap-2 p-2 bg-bgPanel border-l border-y border-borderDark rounded-l-lg items-end">
        
        {/* Measure Tool Toggle */}
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            setMeasureActive(prev => !prev);
          }}
          className={`group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out border border-transparent hover:border-accentGold/35 ${
            measureActive ? 'bg-accentGold text-black' : 'bg-bgCard text-white hover:bg-borderDark'
          }`}
          // ★ Tooltip Added
          title="Measure Tool (Shortcut: M) — Left-click and drag on map to compute distances"
        >
          <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
            📏
          </span>
          <span className={`absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase ${
            measureActive ? 'text-black' : 'text-textMuted group-hover:text-white'
          }`}>
            Measure
          </span>
          <span className={`absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] font-bold ${
            measureActive ? 'text-black/70' : 'text-textMuted group-hover:text-accentGold'
          }`}>
            ❯
          </span>
        </button>

        {/* Ping toggle */}
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            setPingActive(prev => !prev);
            if (measureActive) setMeasureActive(false);
          }}
          className={`group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out border border-transparent hover:border-accentGold/35 ${
            pingActive ? 'bg-accentGold text-black' : 'bg-bgCard text-white hover:bg-borderDark'
          }`}
          title="Ping Tool (Shortcut: P) — Left-click on the map to drop a visual signal for all players"
        >
          <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
            📍
          </span>
          <span className={`absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase ${
            pingActive ? 'text-black' : 'text-textMuted group-hover:text-white'
          }`}>
            Ping
          </span>
          <span className={`absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] font-bold ${
            pingActive ? 'text-black/70' : 'text-textMuted group-hover:text-accentGold'
          }`}>
            ❯
          </span>
        </button>

        {/* FX Tool Toggle */}
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            onToggleFX();
          }}
          className={`group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out border border-transparent hover:border-accentGold/35 ${
            fxActive ? 'bg-accentGold text-black' : 'bg-bgCard text-white hover:bg-borderDark'
          }`}
          title="Spell FX Tool (Shortcut: F) — Cast visual spell effects on the map"
        >
          <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
            ✨
          </span>
          <span className={`absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase ${
            fxActive ? 'text-black' : 'text-textMuted group-hover:text-white'
          }`}>
            Spell FX
          </span>
          <span className={`absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] font-bold ${
            fxActive ? 'text-black/70' : 'text-textMuted group-hover:text-accentGold'
          }`}>
            ❯
          </span>
        </button>

        {/* Shape Tool Toggle */}
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            onToggleShape();
          }}
          className={`group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out border border-transparent hover:border-accentGold/35 ${
            shapeActive ? 'bg-accentGold text-black' : 'bg-bgCard text-white hover:bg-borderDark'
          }`}
          title="Shape Tool — Place persistent area markers (circles, rectangles, cones, lines)"
        >
          <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
            ⬡
          </span>
          <span className={`absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase ${
            shapeActive ? 'text-black' : 'text-textMuted group-hover:text-white'
          }`}>
            Shape
          </span>
          <span className={`absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] font-bold ${
            shapeActive ? 'text-black/70' : 'text-textMuted group-hover:text-accentGold'
          }`}>
            ❯
          </span>
        </button>

        {/* Divider */}
        <div className="w-12 border-t border-borderDark my-1" />

        {/* Character Sheet (Stats) */}
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            onOpenStats();
          }}
          className="group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out bg-bgCard hover:bg-borderDark border border-transparent hover:border-accentGold/35"
          title="Character Sheet Dashboard — Open attributes, combat statistics, passive senses, and wounds"
        >
          <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
            👤
          </span>
          <span className="absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase text-textMuted group-hover:text-white">
            Character
          </span>
          <span className="absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] text-textMuted group-hover:text-accentGold font-bold">
            ❯
          </span>
        </button>

        {/* Gear / Inventory */}
        <button
          onClick={() => {
            soundSynthesizer.playUIClick();
            onOpenGear();
          }}
          className="group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out bg-bgCard hover:bg-borderDark border border-transparent hover:border-accentGold/35"
          title="Gear & Inventory Hub (Shortcut: I) — Open full-screen equipment sheet, currency, and beasts"
        >
          <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
            🎒
          </span>
          <span className="absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase text-textMuted group-hover:text-white">
            Gear
          </span>
          <span className="absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] text-textMuted group-hover:text-accentGold font-bold">
            ❯
          </span>
        </button>

        {/* Divider */}
        <div className="w-12 border-t border-borderDark my-1" />

        {/* Remaining tabs (Actions, features, feats, spells, appearance, journal) */}
        {tabs.slice(1).map(tab => (
          <button 
            key={tab.id}
            onClick={() => {
              soundSynthesizer.playUIClick();
              setActiveTab(activeTab === tab.id ? null : tab.id);
            }}
            className={`group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out border border-transparent hover:border-accentGold/35 ${
              activeTab === tab.id ? 'bg-accentGold text-black' : 'bg-bgCard text-white hover:bg-borderDark'
            }`}
            title={tab.title}
          >
            <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
              {tab.icon}
            </span>
            <span className={`absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase ${
              activeTab === tab.id ? 'text-black' : 'text-textMuted group-hover:text-white'
            }`}>
              {tab.label}
            </span>
            <span className={`absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] font-bold ${
              activeTab === tab.id ? 'text-black/70' : 'text-textMuted group-hover:text-accentGold'
            }`}>
              ❯
            </span>
          </button>
        ))}

        {/* Settings at the very bottom */}
        <button
          onClick={() => setShowOptions(true)}
          className="group relative flex items-center h-12 w-12 hover:w-48 px-3 rounded-lg transition-all duration-300 ease-in-out bg-bgCard hover:bg-borderDark border border-transparent hover:border-accentGold/35 mt-2"
          title="Settings – UI scale, audio, and theme preferences"
        >
          <span className="text-xl flex-shrink-0 mx-auto group-hover:mx-0 transition-all duration-300">
            ⚙️
          </span>
          <span className="absolute left-12 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-xs font-bold tracking-wider uppercase text-textMuted group-hover:text-white">
            Settings
          </span>
          <span className="absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 text-[10px] text-textMuted group-hover:text-accentGold font-bold">
            ❯
          </span>
        </button>
      </div>

      {/* Sliding Panel */}
      {activeTab && (
        <div 
          className={`absolute right-16 top-20 z-50 h-[calc(100vh-100px)] bg-bgPanel border border-borderDark rounded-lg shadow-2xl p-4 overflow-y-auto animate-in slide-in-from-right duration-300 transition-all ease-in-out ${
            activeTab === 'stats' ? 'w-[825px]' : 'w-[400px]'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-accentGold font-bold text-lg">{tabs.find(t => t.id === activeTab)?.label}</h2>
            <button 
              onClick={() => {
                soundSynthesizer.playUIClick();
                setActiveTab(null);
              }} 
              className="text-textMuted hover:text-white"
            >
              ✕
            </button>
          </div>
          <CharacterSheet tab={activeTab} />
        </div>
      )}

      {/* Options Modal */}
      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </>
  );
}