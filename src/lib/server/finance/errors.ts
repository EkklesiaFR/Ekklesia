import 'server-only';

export type FinanceErrorCode = 'UNAUTHORIZED' | 'INVALID_COMMAND' | 'IDEMPOTENCY_CONFLICT'
  | 'RECONSTRUCTION_REQUIRED' | 'INSUFFICIENT_FUNDS' | 'INSUFFICIENT_OUTSTANDING'
  | 'AWARD_PROJECT_MISMATCH' | 'PAYMENT_REFERENCE_MISMATCH' | 'INVALID_REVERSAL'
  | 'TRANSACTION_TOO_LARGE';

export class FinanceError extends Error {
  constructor(public readonly code: FinanceErrorCode, message: string = code) {
    super(message);
    this.name = 'FinanceError';
  }
}
