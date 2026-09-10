import { syntheticApi } from "./client";
export const syncOfflineWorkoutSet = ({ data }: { data: unknown }) => syntheticApi("sync", data);
export const identifyOwnedOfflineSessions = ({ data }: { data: unknown }) =>
  syntheticApi("verify", data);
