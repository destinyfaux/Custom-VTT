// client/src/tools/SRDManager/SRDContext.jsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';

const SRDContext = createContext(null);

// ─── Deep immutable update helpers ───────────────────────────────────────────
export function setDeep(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const idx = typeof head === 'number' ? head : parseInt(head, 10);
    const copy = [...obj];
    copy[idx] = setDeep(obj[idx], rest, value);
    return copy;
  }
  return {
    ...obj,
    [head]: setDeep(obj[head], rest, value),
  };
}

export function deleteDeep(obj, path) {
  if (path.length === 0) return obj;
  if (path.length === 1) {
    const [key] = path;
    if (Array.isArray(obj)) {
      const idx = typeof key === 'number' ? key : parseInt(key, 10);
      return [...obj.slice(0, idx), ...obj.slice(idx + 1)];
    }
    const { [key]: _, ...rest } = obj;
    return rest;
  }
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const idx = typeof head === 'number' ? head : parseInt(head, 10);
    const copy = [...obj];
    copy[idx] = deleteDeep(obj[idx], rest);
    return copy;
  }
  return {
    ...obj,
    [head]: deleteDeep(obj[head], rest),
  };
}

export function pushDeep(obj, path, item) {
  const arr = path.reduce((o, k) => o[k], obj);
  return setDeep(obj, path, [...arr, item]);
}

// ─── Default empty SRD structure ─────────────────────────────────────────────
export function createEmptySRD() {
  return {
    meta: {
      version: '2.1.0',
      last_updated: new Date().toISOString().split('T')[0],
      description: 'Expanded D&D 5e SRD for VTT Character Sheet auto-population',
      sources: {},
    },
    ability_scores: {},
    skills: {},
    alignments: [],
    conditions: [],
    languages: [],
    proficiency_bonus: {
      '1': 2, '2': 2, '3': 2, '4': 2,
      '5': 3, '6': 3, '7': 3, '8': 3,
      '9': 4, '10': 4, '11': 4, '12': 4,
      '13': 5, '14': 5, '15': 5, '16': 5,
      '17': 6, '18': 6, '19': 6, '20': 6,
    },
    races: {},
    classes: {},
    backgrounds: {},
    feats: {},
    equipment: {
      weapons: { Simple: {}, Martial: {} },
      weapon_properties: {},
      weapon_special_rules: {},
      armor: { Light: {}, Medium: {}, Heavy: {}, Shield: {} },
      tools: {},
      adventuring_gear: [],
      packs: {},
      mounts_and_vehicles: [],
      tack_harness_and_drawn_vehicles: [],
      trade_goods: [],
      services: [],
      spelljamming_vessels: [],
    },
    spells: {},
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
const actionTypes = {
  LOAD_SRD: 'LOAD_SRD',
  SET_FIELD: 'SET_FIELD',
  DELETE_FIELD: 'DELETE_FIELD',
  PUSH_TO_ARRAY: 'PUSH_TO_ARRAY',
  ADD_ENTRY: 'ADD_ENTRY',
  DELETE_ENTRY: 'DELETE_ENTRY',
  RENAME_ENTRY: 'RENAME_ENTRY',
};

function srdReducer(state, action) {
  switch (action.type) {
    case actionTypes.LOAD_SRD:
      return action.payload;
    case actionTypes.SET_FIELD:
      return setDeep(state, action.path, action.value);
    case actionTypes.DELETE_FIELD:
      return deleteDeep(state, action.path);
    case actionTypes.PUSH_TO_ARRAY:
      return pushDeep(state, action.path, action.item);
    case actionTypes.ADD_ENTRY: {
      const { category, key, value } = action;
      return {
        ...state,
        [category]: {
          ...state[category],
          [key]: value,
        },
      };
    }
    case actionTypes.DELETE_ENTRY: {
      const { category, key } = action;
      const { [key]: _, ...rest } = state[category];
      return { ...state, [category]: rest };
    }
    case actionTypes.RENAME_ENTRY: {
      const { category, oldKey, newKey } = action;
      const section = state[category];
      const { [oldKey]: removed, ...rest } = section;
      // Insert at same position
      const entries = Object.entries(rest);
      const oldIdx = Object.keys(section).indexOf(oldKey);
      entries.splice(oldIdx, 0, [newKey, removed]);
      return { ...state, [category]: Object.fromEntries(entries) };
    }
    default:
      return state;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function SRDProvider({ children }) {
  const [srd, dispatch] = useReducer(srdReducer, createEmptySRD());

  const loadSRD = useCallback((data) => {
    dispatch({ type: actionTypes.LOAD_SRD, payload: data });
  }, []);

  const setField = useCallback((path, value) => {
    dispatch({ type: actionTypes.SET_FIELD, path, value });
  }, []);

  const deleteField = useCallback((path) => {
    dispatch({ type: actionTypes.DELETE_FIELD, path });
  }, []);

  const pushToArray = useCallback((path, item) => {
    dispatch({ type: actionTypes.PUSH_TO_ARRAY, path, item });
  }, []);

  const addEntry = useCallback((category, key, value) => {
    dispatch({ type: actionTypes.ADD_ENTRY, category, key, value });
  }, []);

  const deleteEntry = useCallback((category, key) => {
    dispatch({ type: actionTypes.DELETE_ENTRY, category, key });
  }, []);

  const renameEntry = useCallback((category, oldKey, newKey) => {
    if (oldKey === newKey) return;
    dispatch({ type: actionTypes.RENAME_ENTRY, category, oldKey, newKey });
  }, []);

  const value = {
    srd,
    loadSRD,
    setField,
    deleteField,
    pushToArray,
    addEntry,
    deleteEntry,
    renameEntry,
  };

  return <SRDContext.Provider value={value}>{children}</SRDContext.Provider>;
}

export function useSRD() {
  const ctx = useContext(SRDContext);
  if (!ctx) throw new Error('useSRD must be used within SRDProvider');
  return ctx;
}

// ─── TEMPLATES for Editors ───────────────────────────────────────────────────
export const TEMPLATES = {
  spell: () => ({
    name: '',
    source: 'PHB',
    level: 0,
    school: 'Abjuration',
    casting_time: '1 action',
    range: 'Self',
    components: { verbal: false, somatic: false, material: false, material_cost: null },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    classes: [],
    description: '',
    higher_levels: null,
  }),

  race: () => ({
    source: 'PHB',
    ability_score_increase: {},
    age: '',
    alignment: '',
    size: 'Medium',
    speed: 30,
    darkvision: null,
    languages: [],
    traits: [],
    subraces: {},
  }),

  background: () => ({
    source: 'PHB',
    skill_proficiencies: [],
    tool_proficiencies: [],
    languages: 0,
    equipment: [],
    feature: { name: '', description: '' },
    personality_traits: 2,
    ideals: 1,
    bonds: 1,
    flaws: 1,
  }),

  feat: () => ({
    source: 'PHB',
    prerequisite: '',
    ability_score_increase: null,
    description: '',
    effects: {},
    can_take_multiple: false,
  }),
  equipment_weapon: {
    name: '',
    cost: '',
    damage: '',
    damage_type: '',
    weight: '',
    properties: [],
  },
  equipment_armor: {
    name: '',
    cost: '',
    ac: 10,
    dex_bonus: false,
    max_dex_bonus: null,
    str_req: null,
    stealth_disadvantage: false,
    weight: '',
  },
  equipment_gear: {
    name: '',
    cost: '',
    weight: '',
  },
  class: () => ({
    source: 'PHB',
    hit_die: 8,
    primary_ability: [],
    saving_throws: [],
    skill_choices: { count: 2, from: [] },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      saving_throws: [],
    },
    starting_equipment: [],
    features: [],
    subclasses: {},
    spellcasting: null,
  }),
  weapon: () => ({                                 // ← FIXED: now a function
    name: '',
    cost: '',
    damage: '',
    damage_type: '',
    weight: '',
    properties: [],
    rarity: null,           // "+1", "+2", "+3", or null
    magic_damage: '',       // dice expression
    magic_damage_type: ''   // damage type
  }),
  armor: () => ({                                 // ← FIXED: now a function
    name: '',
    cost: '',
    ac: 10,
    dex_bonus: false,
    max_dex_bonus: null,
    str_req: null,
    stealth_disadvantage: false,
    weight: '',
    rarity: null            // "+1", "+2", "+3", or null
  }),
  gear: {
    name: '',
    cost: '',
    weight: '',
  },
  subclass: () => ({
    source: 'PHB',
    description: '',
    features: [],
  }),
  spellcasting: {
    ability: '',
    spellcasting_focus: '',
    ritual_casting: false,
    cantrips_known: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    spells_known: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    spell_slots_by_level: {
      "1": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "2": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "3": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "4": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "5": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "6": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "7": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "8": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "9": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    },
  },
  spell_slots: {
    "1": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "2": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "3": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "4": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "5": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "6": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "7": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "8": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "9": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  },
};