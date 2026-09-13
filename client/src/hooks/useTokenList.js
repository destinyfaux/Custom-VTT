// client/src/hooks/useTokenList.js
import { useState, useEffect } from 'react';
import { SERVER_URL } from '../config';

// Cleans strings by lowercasing and removing non-alphanumeric characters
const clean = (str = '') => str.toLowerCase().replace(/[^a-z0-9]/g, '');

export function useTokenList() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');
    fetch(`${baseUrl}/api/tokens`)
      .then(res => res.json())
      .then(data => {
        setTokens(Array.isArray(data) ? data : (data.tokens || []));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch token list:', err);
        setLoading(false);
      });
  }, []);

  return { tokens, loading };
}

/**
 * Finds a matching token image from server/assets/tokens
 * @param {string} name - Monster/NPC/Pet name (e.g., "Adult Black Dragon", "Goblin")
 * @param {string[]} tokenList - List of filenames from /api/tokens
 * @returns {string|null} - Formatted image URL or null
 */
export function findMatchingToken(name, tokenList) {
  if (!name || !Array.isArray(tokenList) || tokenList.length === 0) return null;

  const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');
  const targetClean = clean(name);

  // Split target words to check inverted names (e.g. "Adult Black Dragon" -> ["adult", "black", "dragon"])
  const targetWords = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);

  const match = tokenList.find(filename => {
    // Strip file extension
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const baseClean = clean(baseName);

    // 1. Direct normalized match (e.g., "Air Elemental" === "Air Elemental.jpg")
    if (baseClean === targetClean) return true;

    // 2. Comma/Inverted SRD match (e.g., "Black dragon, Adult" vs "Adult Black Dragon")
    const fileWords = baseName.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    if (
      targetWords.length > 1 &&
      fileWords.length === targetWords.length &&
      targetWords.every(w => fileWords.includes(w))
    ) {
      return true;
    }

    // 3. Underscore / hyphenated match (e.g. "ashen_bulwark.png" === "ashen bulwark")
    if (clean(baseName.replace(/[-_]/g, ' ')) === targetClean) return true;

    // 4. Substring prefix match for custom tokens (e.g., "goblin" in "goblin_archer.png")
    if (baseClean.startsWith(targetClean) || targetClean.startsWith(baseClean)) return true;

    return false;
  });

  if (!match) return null;

  // encodeURIComponent handles spaces, commas, and special characters properly
  return `${baseUrl}/assets/tokens/${encodeURIComponent(match)}`;
}