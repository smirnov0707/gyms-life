export type PersonalizedTwinProviderJobStatus = "processing" | "ready" | "failed";

export type PersonalizedTwinProviderJobSnapshot = {
  captureSetId: string;
  providerKey: string;
  providerJobId: string;
  status: PersonalizedTwinProviderJobStatus;
  pollAttempt: number;
  nextPollAt: string | null;
  terminalLeaseUntil: string | null;
};

export function personalizedTwinPollDelayMs(attempt: number): number {
  const bounded = Math.max(0, Math.min(attempt, 8));
  return Math.min(300_000, 5_000 * 2 ** bounded);
}

export function nextPersonalizedTwinPollAt(input: { attempt: number; now: Date }): string {
  return new Date(input.now.getTime() + personalizedTwinPollDelayMs(input.attempt)).toISOString();
}

export function canPollPersonalizedTwinProvider(input: {
  status: PersonalizedTwinProviderJobStatus;
  nextPollAt: string | null;
  now: Date;
}): boolean {
  if (input.status !== "processing") return false;
  if (!input.nextPollAt) return true;
  return new Date(input.nextPollAt).getTime() <= input.now.getTime();
}
