import type { DigitalAthleteState } from "./digital-athlete.schema";

export type AthleteStateSnapshotMetadata = {
  id: string;
  schemaVersion: string;
  computedAt: string;
};

export type AthleteModelResponse = {
  state: DigitalAthleteState;
  evaluatedAt: string;
  snapshot: AthleteStateSnapshotMetadata | null;
};
