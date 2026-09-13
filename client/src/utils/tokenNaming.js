// client/src/utils/tokenNaming.js
// Render-time display labels for tokens that share the same base name.
//
// IMPORTANT DESIGN NOTE: the token's real `name` is NEVER mutated. Labels are
// computed fresh from the token list every render/draw, which keeps:
//   - TokenTray stacking intact (groups by name/type/avatarUrl)
//   - The SRD link intact (stat block opens via token.monsterData)
//   - Server state unchanged (no extra network chatter)
//
// Labels are deterministic across clients: tokens sharing a name are sorted by
// their stable `id`, so every client computes the same label for the same token.

// 0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB", ...
const letterAt = (index) => {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
};

/**
 * Build a map of tokenId -> display label for all PLACED tokens whose
 * (type, name) pair is shared by 2+ tokens. Unambiguous tokens get no entry
 * (callers fall back to the plain name).
 * @param {Array} tokens full token list from server state
 * @returns {Object} { [tokenId]: "Goblin A" }
 */
export function buildMapLabels(tokens) {
  const labels = {};
  if (!Array.isArray(tokens)) return labels;

  const groups = new Map();
  for (const t of tokens) {
    if (!t || !t.isPlaced || !t.name) continue;
    const key = `${t.type || 'npc'}:${t.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    members.forEach((t, idx) => {
      labels[t.id] = `${t.name} ${letterAt(idx)}`;
    });
  }

  return labels;
}

/**
 * Resolve the display label for a token (falls back to its plain name).
 */
export function getTokenLabel(labels, token) {
  if (!token) return '';
  return (labels && labels[token.id]) || token.name || '';
}
