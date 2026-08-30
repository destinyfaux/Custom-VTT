import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoinValue, applyCurrencyDelta } from './inventoryCommerce.js';

test('parseCoinValue converts mixed coin strings into cp', () => {
  assert.equal(parseCoinValue('3 gp'), 300);
  assert.equal(parseCoinValue('2 sp'), 20);
  assert.equal(parseCoinValue('1 pp 2 gp'), 1200);
  assert.equal(parseCoinValue('0'), 0);
  assert.equal(parseCoinValue('—'), 0);
});

test('applyCurrencyDelta debits and credits currency correctly', () => {
  const character = { pp: 0, gp: 5, ep: 0, sp: 0, cp: 0, sk: 0 };
  const afterPurchase = applyCurrencyDelta(character, 350, 'debit');
  assert.equal(afterPurchase.gp, 2);
  assert.equal(afterPurchase.cp, 0);

  const afterSale = applyCurrencyDelta(character, 150, 'credit');
  assert.equal(afterSale.gp, 6);
  assert.equal(afterSale.cp, 0);
});
