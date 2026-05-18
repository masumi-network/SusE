export type RetryPolicy = {
  maxAttempts: number;
  retryDelayMs: number;
};

export function shouldRetryHttpStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function canRetryAttempt(attempt: number, policy: RetryPolicy): boolean {
  return attempt < Math.max(1, policy.maxAttempts);
}

export function retryDelayMs(attempt: number, policy: RetryPolicy): number {
  const baseDelay = Math.max(0, policy.retryDelayMs);
  return baseDelay * Math.max(1, attempt);
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

