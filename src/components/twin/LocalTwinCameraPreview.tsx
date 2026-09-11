import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ShieldCheck } from "lucide-react";
import { assessTwinFraming, type TwinFramingAssessment } from "@/lib/personalized-twin.framing";
import { closeLocalTwinCamera, openLocalTwinCamera } from "@/lib/personalized-twin.camera";
import {
  INITIAL_TWIN_ROTATION_PROGRESS,
  updateTwinRotationProgress,
  type TwinRotationProgress,
} from "@/lib/personalized-twin.rotation-progress";
import {
  createLocalTwinPoseDetector,
  type LocalTwinPoseDetector,
} from "@/lib/personalized-twin.pose-runtime";

type CameraState = "idle" | "requesting" | "active" | "denied" | "unavailable";

const COPY = {
  lt: {
    open: "Atidaryti vietinę kamerą",
    close: "Uždaryti kamerą",
    requesting: "Laukiama kameros leidimo…",
    denied: "Kameros leidimas nesuteiktas.",
    unavailable: "Šiame įrenginyje kamera naršyklei nepasiekiama.",
    localOnly: "Vaizdas rodomas tik šiame įrenginyje. Jis neįrašomas ir neįkeliamas.",
    framingUnknown: "Dar nematau viso kūno — laikyk galvą ir abi kulkšnis rėmelio viduje.",
    framingReady: "Kadravimas tinkamas 360° skenavimui.",
    framingTooClose: "Per arti kameros — atsitrauk šiek tiek atgal.",
    framingTooFar: "Per toli nuo kameros — prieik šiek tiek arčiau.",
    framingCropped: "Dalis kūno nukirsta — sutalpink visą kūną į rėmelį.",
    rotationLabel: "Apsisukimo progreso įvertis",
    rotationHint:
      "Lėtai sukis viena kryptimi. Tai tik lokalus progreso įvertis, ne 3D skenavimo įrodymas.",
  },
  en: {
    open: "Open local camera",
    close: "Close camera",
    requesting: "Waiting for camera permission…",
    denied: "Camera permission was not granted.",
    unavailable: "Camera access is unavailable in this browser or device.",
    localOnly: "The preview stays on this device. It is not recorded or uploaded.",
    framingUnknown:
      "I cannot see your full body yet — keep your head and both ankles inside the guide.",
    framingReady: "Framing is ready for the 360° scan.",
    framingTooClose: "Too close to the camera — step back a little.",
    framingTooFar: "Too far from the camera — move a little closer.",
    framingCropped: "Part of your body is cropped — fit your whole body inside the guide.",
    rotationLabel: "Rotation progress estimate",
    rotationHint:
      "Rotate slowly in one direction. This is only a local progress estimate, not proof of a complete 3D scan.",
  },
} as const;
export function LocalTwinCameraPreview({ language }: { language: "lt" | "en" }) {
  const copy = COPY[language];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<LocalTwinPoseDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const rotationRef = useRef<TwinRotationProgress>(INITIAL_TWIN_ROTATION_PROGRESS);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [framing, setFraming] = useState<TwinFramingAssessment>(() => assessTwinFraming(null));
  const [rotation, setRotation] = useState<TwinRotationProgress>(INITIAL_TWIN_ROTATION_PROGRESS);

  const stopDetection = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    detectorRef.current?.close();
    detectorRef.current = null;
    rotationRef.current = INITIAL_TWIN_ROTATION_PROGRESS;
    setRotation(INITIAL_TWIN_ROTATION_PROGRESS);
    setFraming(assessTwinFraming(null));
  };

  const stopCamera = () => {
    attemptRef.current += 1;
    stopDetection();
    closeLocalTwinCamera(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  };

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  const startDetection = async (video: HTMLVideoElement, attempt: number) => {
    try {
      const detector = await createLocalTwinPoseDetector();
      if (attemptRef.current !== attempt) {
        detector.close();
        return;
      }
      detectorRef.current = detector;
      const loop = () => {
        if (attemptRef.current !== attempt || detectorRef.current !== detector) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            const observation = detector.detect(video, performance.now());
            const assessment = assessTwinFraming(observation);
            setFraming(assessment);
            const nextRotation = updateTwinRotationProgress(rotationRef.current, {
              framingReady: assessment.status === "ready",
              shoulderSpanRatio: observation?.shoulderSpanRatio ?? null,
            });
            rotationRef.current = nextRotation;
            setRotation(nextRotation);
          } catch {
            setFraming(assessTwinFraming(null));
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      if (attemptRef.current === attempt) setFraming(assessTwinFraming(null));
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      return;
    }
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    stopDetection();
    setCameraState("requesting");
    try {
      const stream = await openLocalTwinCamera(navigator.mediaDevices);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraState("active");
      if (videoRef.current) void startDetection(videoRef.current, attempt);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraState(name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };
  const framingMessage =
    framing.status === "ready"
      ? copy.framingReady
      : framing.status === "too_close"
        ? copy.framingTooClose
        : framing.status === "too_far"
          ? copy.framingTooFar
          : framing.status === "cropped"
            ? copy.framingCropped
            : copy.framingUnknown;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3" data-local-twin-camera>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 aspect-[3/4] max-h-[420px]">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`size-full object-cover ${cameraState === "active" ? "block" : "hidden"}`}
          aria-label={language === "lt" ? "Vietinės kameros peržiūra" : "Local camera preview"}
        />
        <div className="pointer-events-none absolute inset-[8%_16%] rounded-[40%] border border-dashed border-violet-300/70" />
        {cameraState !== "active" ? (
          <div className="absolute inset-0 grid place-items-center px-5 text-center text-xs text-neutral-400">
            {cameraState === "requesting"
              ? copy.requesting
              : cameraState === "denied"
                ? copy.denied
                : cameraState === "unavailable"
                  ? copy.unavailable
                  : copy.framingUnknown}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {cameraState === "active" ? (
          <button
            type="button"
            onClick={stopCamera}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs font-semibold text-white"
          >
            <CameraOff aria-hidden="true" className="size-4" /> {copy.close}
          </button>
        ) : (
          <button
            type="button"
            onClick={startCamera}
            disabled={cameraState === "requesting"}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-violet-300/30 bg-violet-300/10 px-4 text-xs font-semibold text-violet-100 disabled:opacity-60"
          >
            <Camera aria-hidden="true" className="size-4" /> {copy.open}
          </button>
        )}
      </div>

      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-neutral-500">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>{copy.localOnly}</span>
      </p>
      <div className="mt-3" data-twin-rotation-progress={rotation.progressPct}>
        <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-400">
          <span>{copy.rotationLabel}</span>
          <span className="tabular-nums">{rotation.progressPct}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet-300 transition-[width]"
            style={{ width: `${rotation.progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{copy.rotationHint}</p>
      </div>
      <p
        className={`mt-2 text-[11px] leading-relaxed ${framing.status === "ready" ? "text-emerald-300" : framing.status === "unknown" ? "text-neutral-500" : "text-amber-300"}`}
        data-twin-framing-status={framing.status}
      >
        {framingMessage}
      </p>
    </div>
  );
}
