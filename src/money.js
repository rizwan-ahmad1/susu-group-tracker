'use strict';

function assertMinorUnits(amount, label = 'Amount') {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer in pesewas.`);
  }
  return amount;
}

function parseMoneyToPesewas(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.test(value)) {
    throw new TypeError('Money must be a decimal string with at most two fractional digits.');
  }

  const [cedis, fraction = ''] = value.split('.');
  const pesewas = BigInt(cedis) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (pesewas > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Money value is outside the safe integer range.');
  }
  return Number(pesewas);
}

function formatPesewas(amount) {
  assertMinorUnits(amount);
  const cedis = Math.floor(amount / 100);
  const pesewas = String(amount % 100).padStart(2, '0');
  return `${cedis}.${pesewas}`;
}

module.exports = { assertMinorUnits, formatPesewas, parseMoneyToPesewas };
