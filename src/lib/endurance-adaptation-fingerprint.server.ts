import { createHash } from "node:crypto";

export function sha256Hex(parts: readonly (string | number)[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
