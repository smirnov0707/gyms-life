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
