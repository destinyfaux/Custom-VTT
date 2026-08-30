import { useState, useEffect } from 'react';
import { SERVER_URL } from '../config';

export function useTokenList() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/tokens`)
      .then(res => res.json())
      .then(data => {
        setTokens(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch token list:', err);
        setLoading(false);
      });
  }, []);

  return { tokens, loading };
}

// Helper: find a token filename matching a name (case‑insensitive, ignoring extension)
export function findMatchingToken(name, tokenList) {
  if (!name || !tokenList.length) return null;
  const normalized = name.trim().toLowerCase();
  const match = tokenList.find(filename => {
    const base = filename.split('.').slice(0, -1).join('.').toLowerCase();
    return base === normalized;
  });
  return match ? `${SERVER_URL}/assets/tokens/${match}` : null;
}