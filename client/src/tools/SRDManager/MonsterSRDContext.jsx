import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';

const MonsterSRDContext = createContext(null);

// ─── Deep immutable update helpers (same as SRDContext) ────────────────────────
function setDeep(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const idx = typeof head === 'number' ? head : parseInt(head, 10);
    if (isNaN(idx)) {
      return { ...obj, [head]: setDeep(obj[head], rest, value) };
    }
    const copy = [...obj];
    copy[idx] = setDeep(obj[idx] ?? null, rest, value);
    return copy;
  }
  if (obj === null || obj === undefined) {
    return { [head]: setDeep(null, rest, value) };
  }
  return { ...obj, [head]: setDeep(obj[head], rest, value) };
}

function deleteDeep(obj, path) {
  if (!obj || path.length === 0) return obj;
  if (path.length === 1) {
    const [key] = path;
    if (Array.isArray(obj)) {
      const idx = typeof key === 'number' ? key : parseInt(key, 10);
      if (isNaN(idx)) return obj;
      return [...obj.slice(0, idx), ...obj.slice(idx + 1)];
    }
    const { [key]: _, ...rest } = obj;
    return rest;
  }
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const idx = typeof head === 'number' ? head : parseInt(head, 10);
    if (isNaN(idx)) return obj;
    const copy = [...obj];
    copy[idx] = deleteDeep(obj[idx], rest);
    return copy;
  }
  if (obj[head] === undefined) return obj;
  return { ...obj, [head]: deleteDeep(obj[head], rest) };
}

// ─── Monster entry template ───────────────────────────────────────────────────
export const MONSTER_TEMPLATE = () => ({
  source: '',
  type: '',
  size: 'Medium',
  alignment: '',
  ac: 10,
  ac_desc: '',
  hp: 0,
  hp_formula: '',
  speed: { walk: 30 },
  ability_scores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  saves: {},
  skills: {},
  resistances: [],
  immunities: [],
  vulnerabilities: [],
  condition_immunities: [],
  senses: { passive_perception: 10 },
  languages: '',
  cr: '0',
  traits: [],
  actions: [],
  legendary_actions: [],
  reactions: [],
  lair_actions: [],
  environment: '',
  description: '',
});

// ─── Constants for dropdowns ──────────────────────────────────────────────────
export const MONSTER_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
  'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant',
  'undead', 'swarm',
];

export const MONSTER_SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

export const MONSTER_ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
  'Unaligned', 'Any Alignment', 'Any Evil', 'Any Chaotic',
  'Any Non-Good', 'Any Non-Lawful',
];

export const DAMAGE_TYPES = [
  'bludgeoning', 'piercing', 'slashing', 'acid', 'cold', 'fire', 'force',
  'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder',
];

export const CONDITION_TYPES = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened',
  'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified',
  'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
];

export const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const SKILL_NAMES = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
  'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
  'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
  'Sleight of Hand', 'Stealth', 'Survival',
];

export const CR_OPTIONS = [
  '0', '1/8', '1/4', '1/2',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
];

export const SPEED_TYPES = ['walk', 'burrow', 'climb', 'fly', 'swim'];

export const SENSE_TYPES = ['blindsight', 'darkvision', 'tremorsense', 'truesight'];

export const ENVIRONMENTS = [
  'arctic', 'coastal', 'desert', 'forest', 'grassland', 'hill',
  'mountain', 'swamp', 'underground', 'underwater', 'urban',
  'abyss', 'astral', 'shadowfell', 'feywild',
];

// ─── CR to XP lookup ──────────────────────────────────────────────────────────
export const CR_XP_TABLE = {
  '0': 0, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
const ACTIONS = {
  LOAD: 'LOAD',
  SET: 'SET',
  DELETE: 'DELETE',
  PUSH: 'PUSH',
  ADD_MONSTER: 'ADD_MONSTER',
  DELETE_MONSTER: 'DELETE_MONSTER',
  RENAME_MONSTER: 'RENAME_MONSTER',
};

function monsterReducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOAD:
      return action.payload;

    case ACTIONS.SET:
      return setDeep(state, action.path, action.value);

    case ACTIONS.DELETE:
      return deleteDeep(state, action.path);

    case ACTIONS.PUSH: {
      const arr = action.path.reduce((o, k) => o?.[k], state);
      if (!Array.isArray(arr)) return state;
      return setDeep(state, action.path, [...arr, action.item]);
    }

    case ACTIONS.ADD_MONSTER: {
      const { key, value } = action;
      if (state.monsters?.hasOwnProperty(key)) return state;
      return {
        ...state,
        monsters: { ...state.monsters, [key]: value },
      };
    }

    case ACTIONS.DELETE_MONSTER: {
      const { key } = action;
      if (!state.monsters?.hasOwnProperty(key)) return state;
      const { [key]: _, ...rest } = state.monsters;
      return { ...state, monsters: rest };
    }

    case ACTIONS.RENAME_MONSTER: {
      const { oldKey, newKey } = action;
      if (oldKey === newKey || !state.monsters?.hasOwnProperty(oldKey)) return state;
      if (state.monsters.hasOwnProperty(newKey)) return state;
      const entries = Object.entries(state.monsters);
      const idx = entries.findIndex(([k]) => k === oldKey);
      if (idx === -1) return state;
      entries[idx] = [newKey, entries[idx][1]];
      return { ...state, monsters: Object.fromEntries(entries) };
    }

    default:
      return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MonsterSRDProvider({ children }) {
  const [monsterSRD, dispatch] = useReducer(monsterReducer, null);
  const lastSavedRef = useRef(null);

  const loadMonsterSRD = useCallback((data) => {
    dispatch({ type: ACTIONS.LOAD, payload: data });
    lastSavedRef.current = JSON.stringify(data);
  }, []);

  const setField = useCallback((path, value) => {
    dispatch({ type: ACTIONS.SET, path, value });
  }, []);

  const deleteField = useCallback((path) => {
    dispatch({ type: ACTIONS.DELETE, path });
  }, []);

  const pushToArray = useCallback((path, item) => {
    dispatch({ type: ACTIONS.PUSH, path, item });
  }, []);

  const addMonster = useCallback((key, value) => {
    dispatch({ type: ACTIONS.ADD_MONSTER, key, value });
  }, []);

  const deleteMonster = useCallback((key) => {
    dispatch({ type: ACTIONS.DELETE_MONSTER, key });
  }, []);

  const renameMonster = useCallback((oldKey, newKey) => {
    dispatch({ type: ACTIONS.RENAME_MONSTER, oldKey, newKey });
  }, []);

  const hasUnsavedChanges = useCallback(() => {
    if (!monsterSRD || !lastSavedRef.current) return !!monsterSRD;
    return JSON.stringify(monsterSRD) !== lastSavedRef.current;
  }, [monsterSRD]);

  const markSaved = useCallback(() => {
    lastSavedRef.current = JSON.stringify(monsterSRD);
  }, [monsterSRD]);

  const value = {
    monsterSRD,
    loadMonsterSRD,
    setField,
    deleteField,
    pushToArray,
    addMonster,
    deleteMonster,
    renameMonster,
    hasUnsavedChanges,
    markSaved,
  };

  return (
    <MonsterSRDContext.Provider value={value}>
      {children}
    </MonsterSRDContext.Provider>
  );
}

export function useMonsterSRD() {
  const ctx = useContext(MonsterSRDContext);
  if (!ctx) throw new Error('useMonsterSRD must be used within MonsterSRDProvider');
  return ctx;
}
