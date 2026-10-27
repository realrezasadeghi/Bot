export interface RetryPolicyOptions {
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
}

export const DEFAULT_RETRY_POLICY: Required<RetryPolicyOptions> = {
  baseDelayMs: 30_000,
  factor: 2,
  maxDelayMs: 60 * 60 * 1_000,
};

/**
 * attempt is the number of completed attempts (1 for the first failure).
 */
export function retryDelayMs(
  attempt: number,
  options: RetryPolicyOptions = {},
): number {
  const base = options.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs;
  const factor = options.factor ?? DEFAULT_RETRY_POLICY.factor;
  const max = options.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs;
  const exponent = Math.max(0, attempt - 1);
  return Math.min(max, base * Math.pow(factor, exponent));
}
