// Shared currency-symbol hook.
// Fetches from /class-pricing once per app session (module-level cache).
// All components receive the same value instantly after the first fetch.
import { useState, useEffect } from 'react';
import api from '../api';

let _symbol  = null;          // cached value once resolved
let _promise = null;          // in-flight promise (shared)
const _subs  = new Set();     // setState callbacks waiting for the first fetch

export function useCurrencySymbol() {
  const [sym, setSym] = useState(_symbol ?? '$');

  useEffect(() => {
    if (_symbol !== null) { setSym(_symbol); return; }
    _subs.add(setSym);
    if (!_promise) {
      _promise = api.get('/class-pricing')
        .then(r  => { _symbol = r.data?.currencySymbol || '$'; })
        .catch(() => { _symbol = '$'; })
        .finally(() => { _subs.forEach(fn => fn(_symbol)); _subs.clear(); });
    }
    return () => _subs.delete(setSym);
  }, []);

  return sym;
}

/** Call this after admin saves new pricing so all mounted components update. */
export function invalidateCurrencyCache() {
  _symbol  = null;
  _promise = null;
}

/**
 * Format a number as currency with thousands separators.
 * fmtMoney(840000, '₫') → '₫840,000.00'
 * fmtMoney(null)         → '—'
 */
export function fmtMoney(n, sym = '$') {
  if (n === undefined || n === null) return '—';
  return `${sym}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
