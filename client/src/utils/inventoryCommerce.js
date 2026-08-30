const COIN_ORDER = [
  { key: 'pp', value: 1000 },
  { key: 'gp', value: 100 },
  { key: 'ep', value: 50 },
  { key: 'sp', value: 10 },
  { key: 'cp', value: 1 }
];

export const parseCoinValue = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.max(0, Math.floor(value));
  if (typeof value !== 'string') return 0;

  const normalized = value.toString().trim().toLowerCase();
  if (!normalized || normalized === '—' || normalized === 'n/a') return 0;

  const matches = normalized.match(/(\d+)\s*(pp|gp|ep|sp|cp)/g) || [];
  if (!matches.length) {
    const fallback = parseInt(normalized.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
  }

  return matches.reduce((total, chunk) => {
    const match = chunk.match(/(\d+)\s*(pp|gp|ep|sp|cp)/);
    if (!match) return total;
    const [, amount, coin] = match;
    const coinValue = COIN_ORDER.find((entry) => entry.key === coin)?.value || 1;
    return total + parseInt(amount, 10) * coinValue;
  }, 0);
};

export const applyCurrencyDelta = (character, amountInCp, direction = 'debit') => {
  const safeAmount = Math.max(0, Math.floor(amountInCp));
  const next = { ...character };
  const coins = { pp: next.pp || 0, gp: next.gp || 0, ep: next.ep || 0, sp: next.sp || 0, cp: next.cp || 0, sk: next.sk || 0 };

  if (direction === 'debit') {
    let remaining = safeAmount;
    for (const coin of COIN_ORDER) {
      const current = coins[coin.key] || 0;
      const currentCp = current * coin.value;
      if (currentCp <= 0) continue;
      const take = Math.min(currentCp, remaining);
      const coinCount = Math.floor(take / coin.value);
      coins[coin.key] = Math.max(0, current - coinCount);
      remaining -= take;
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      coins.cp = Math.max(0, (coins.cp || 0) - remaining);
    }
    return {
      ...next,
      pp: coins.pp,
      gp: coins.gp,
      ep: coins.ep,
      sp: coins.sp,
      cp: coins.cp,
      sk: coins.sk
    };
  }

  let remaining = safeAmount;
  for (const coin of COIN_ORDER) {
    if (remaining <= 0) break;
    const add = Math.floor(remaining / coin.value);
    coins[coin.key] += add;
    remaining %= coin.value;
  }

  return {
    ...next,
    pp: coins.pp,
    gp: coins.gp,
    ep: coins.ep,
    sp: coins.sp,
    cp: coins.cp,
    sk: coins.sk
  };
};

export const getSellPrice = (item, fallback = 0.5) => {
  const base = parseCoinValue(item?.cost || item?.value || 0);
  return Math.max(0, Math.floor(base * (fallback || 0)));
};
