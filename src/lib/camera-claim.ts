/**
 * Who owns a camera that has just finished opening.
 *
 * Three screens point a camera at the athlete — the Twin capture preview, the
 * body composition scanner, and the supplement label scanner — and all three
 * share one hazard. `getUserMedia` resolves long after it is called: a
 * permission prompt, then the device itself, then sometimes a second request
 * and a constraint change. A component that unmounts inside that window has
 * already run its cleanup, and its cleanup could only stop a camera that was
 * open at the time. The stream then arrives, gets stored by a component that no
 * longer exists, and nothing is left to stop it. In a single-page app no
 * navigation reloads the page, so the camera light stays on — pointed at
 * somebody who left the screen that asked for it.
 *
 * The rule is therefore that opening a camera and keeping it are separate acts.
 * A caller records which request it opened for; if that request has been
 * retired by the time the stream lands, the stream is closed here rather than
 * returned to a caller who might forget.
 *
 * PART LXIII: the athlete's camera is theirs, and "on" must always be something
 * they chose and can see they chose.
 */

export function stopCameraStream(stream: Pick<MediaStream, "getTracks"> | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function claimOpenedCamera<Stream extends Pick<MediaStream, "getTracks">>(
  stream: Stream,
  attempt: { openedFor: number; current: number },
): Stream | null {
  if (attempt.openedFor === attempt.current) return stream;
  stopCameraStream(stream);
  return null;
}
