// Money helpers.
//
// RULE: money is ALWAYS stored and calculated as INTEGER PAISE (1 rupee = 100 paise).
// Floating-point numbers cannot represent most decimals exactly (0.1 + 0.2 !== 0.3),
// so rupee decimals would slowly corrupt balances. Whole paise never have that problem.

// Limits live in one place so the rules are easy to find, change and test.
const LIMITS = Object.freeze({
    MIN_TRANSFER_PAISE: 100, // Rs 1
    MAX_TRANSFER_PAISE: 10_000_000, // Rs 1,00,000 per transfer
    MAX_DEMO_FUND_PAISE: 5_000_000, // Rs 50,000 per demo-funding request
    MAX_BALANCE_PAISE: 100_000_000, // Rs 10,00,000 maximum wallet balance
  });
  
  // True only for a positive whole number that JavaScript can represent exactly.
  function isValidPaise(value) {
    return Number.isSafeInteger(value) && value > 0;
  }
  
  // Turns paise into a display string with the rupee sign, e.g. 12345 -> "₹123.45".
  // For DISPLAY only. Never calculate with the returned string.
  function formatInr(paise) {
    if (!Number.isSafeInteger(paise)) {
      throw new TypeError('formatInr expects a whole number of paise');
    }
    const sign = paise < 0 ? '-' : '';
    const abs = Math.abs(paise);
    const rupees = Math.trunc(abs / 100);
    const remainder = String(abs % 100).padStart(2, '0');
    // 'en-IN' groups digits the Indian way: 1,00,000
    return `${sign}\u20B9${rupees.toLocaleString('en-IN')}.${remainder}`;
  }
  
  module.exports = { LIMITS, isValidPaise, formatInr };