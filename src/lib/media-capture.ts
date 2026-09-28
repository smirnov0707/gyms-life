/**
 * Who owns a camera or microphone that has just finished opening.
 *
 * Five screens point a capture device at the athlete — the Twin capture
 * preview, the body composition scanner, the supplement label scanner, the
 * shared camera hook, and the voice set logger — and all five share one hazard.
 * `getUserMedia` resolves long after it is called: a permission prompt, then
 * the device itself, then sometimes a second request and a constraint change. A
 * component that unmounts inside that window has already run its cleanup, and
 * its cleanup could only stop a device that was open at the time. The stream
 * then arrives, gets stored by a component that no longer exists, and nothing
 * is left to stop it. In a single-page app no navigation reloads the page, so
 * the camera light stays on — or the microphone stays hot — for somebody who
 * left the screen that asked for it.
 *
 * The rule is therefore that opening a device and keeping it are separate acts.
 * A caller decides whether it still wants what it asked for; if it does not,
 * the stream is stopped here rather than returned to a caller who might forget.
 *
 * `media-capture.test.ts` holds every `getUserMedia` call site to this module,
 * so a sixth screen cannot quietly repeat the leak.
 *
 * PART LXIII: the athlete's camera and microphone are theirs, and "on" must
 * always be something they chose and can see they chose.
 */

/** Stops every track. One live track is a lit camera or an open microphone. */
export function stopCaptureStream(stream: Pick<MediaStream, "getTracks"> | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * `stillWanted` is each caller's own answer, because the screens do not agree
 * on what "still wanted" means: an attempt counter here, a mounted flag there,
 * a `<video>` still inside a `<details>` that is still open elsewhere. What
 * they must agree on is the consequence, and that is what lives here — a stream
 * is either returned live or stopped, never dropped and never handed back dead.
 */
export function claimOpenedCapture<Stream extends Pick<MediaStream, "getTracks">>(
  stream: Stream,
  stillWanted: boolean,
): Stream | null {
  if (stillWanted) return stream;
  stopCaptureStream(stream);
  return null;
}
