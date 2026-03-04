/**
 * Sesami SafePay RC5000 — Operation Types
 * Use these constants when calling POST /operations/start { type, amount }
 */
const OperationType = {
  Deposit            : 1,
  Load               : 2,
  Replenish          : 3,
  PayoutDenomination : 4,
  PayoutAmount       : 5,
  PayoutMix          : 6,
  Exchange           : 7,
  FloatDenomination  : 8,
  ChangeContents     : 9,
  PayinAmount        : 10,
  FloatExcess        : 11,
  NoteCount          : 12,
  LevelsAdjust       : 13,
  Internal           : 14,
  Empty              : 15,
  Register           : 16,
  Collection         : 17,
  UnloadDenomination : 18,
  UnloadAmount       : 19,
  LoadManual         : 20,
  UnloadManual       : 21,
  FloatAmount        : 22
};

module.exports = { OperationType };
