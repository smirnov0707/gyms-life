export type TwinCameraMediaDevices = {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
};

export async function openLocalTwinCamera(
  mediaDevices: TwinCameraMediaDevices | undefined,
): Promise<MediaStream> {
  if (!mediaDevices) throw new Error("PERSONALIZED_TWIN_CAMERA_UNAVAILABLE");
  return mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });
}

export function closeLocalTwinCamera(stream: Pick<MediaStream, "getTracks"> | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Decides whether a camera that has just opened still has a screen to open for.
 *
 * `getUserMedia` resolves long after it is called — a permission prompt, then
 * the device itself. The preview abandoned a stale *pose detector* by comparing
 * attempt counters, but nothing compared them for the stream: whoever asked
 * last simply assigned it. Leave the screen while the camera is coming up and
 * the resolved stream was stored by a component that no longer exists, with no
 * cleanup left to run — the camera light stays on, pointed at a person who
 * navigated away from the page that asked for it.
 *
 * So the claim is explicit, and a stream nobody is waiting for is closed here
 * rather than returned to a caller who might forget. PART LXIII: the athlete's
 * camera is theirs, and "on" must always be something they can see they chose.
 */
export function claimOpenedCamera<Stream extends Pick<MediaStream, "getTracks">>(
  stream: Stream,
  attempt: { openedFor: number; current: number },
): Stream | null {
  if (attempt.openedFor === attempt.current) return stream;
  closeLocalTwinCamera(stream);
  return null;
}
