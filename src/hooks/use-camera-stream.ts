import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Owns permission requests and tracks independently of a video DOM node. */
export function useCameraStream(videoRef: RefObject<HTMLVideoElement | null>) {
  const generation = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);

  const release = useCallback(() => {
    generation.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  const stop = useCallback(() => {
    release();
    if (mounted.current) {
      setBusy(false);
      setActive(false);
    }
  }, [release]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      release();
    };
  }, [release]);

  const start = useCallback(
    async (facing: "environment" | "user") => {
      stop();
      const request = generation.current;
      setBusy(true);
      const current = () => mounted.current && request === generation.current;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16 / 9 },
          },
          audio: false,
        });
        const video = videoRef.current;
        if (!current() || !video?.isConnected) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        if (!current()) return false;
        setActive(true);
        return true;
      } catch (error) {
        if (!current()) return false;
        stop();
        throw error;
      } finally {
        if (current()) setBusy(false);
      }
    },
    [stop, videoRef],
  );

  return { start, stop, busy, active };
}
