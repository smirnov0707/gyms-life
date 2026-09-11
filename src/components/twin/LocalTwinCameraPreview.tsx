import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ShieldCheck } from "lucide-react";
import { assessTwinFraming } from "@/lib/personalized-twin.framing";
import { closeLocalTwinCamera, openLocalTwinCamera } from "@/lib/personalized-twin.camera";

type CameraState = "idle" | "requesting" | "active" | "denied" | "unavailable";

const COPY = {
  lt: {
    open: "Atidaryti vietinę kamerą",
    close: "Uždaryti kamerą",
    requesting: "Laukiama kameros leidimo…",
    denied: "Kameros leidimas nesuteiktas.",
    unavailable: "Šiame įrenginyje kamera naršyklei nepasiekiama.",
    localOnly: "Vaizdas rodomas tik šiame įrenginyje. Jis neįrašomas ir neįkeliamas.",
    framingUnknown: "Automatinis kūno framing dar nevertinamas — laikyk visą kūną rėmelio viduje.",
  },
  en: {
    open: "Open local camera",
    close: "Close camera",
    requesting: "Waiting for camera permission…",
    denied: "Camera permission was not granted.",
    unavailable: "Camera access is unavailable in this browser or device.",
    localOnly: "The preview stays on this device. It is not recorded or uploaded.",
    framingUnknown:
      "Automatic body framing is not active yet — keep your whole body inside the guide.",
  },
} as const;
export function LocalTwinCameraPreview({ language }: { language: "lt" | "en" }) {
  const copy = COPY[language];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const framing = assessTwinFraming(null);

  const stopCamera = () => {
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

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      return;
    }
    setCameraState("requesting");
    try {
      const stream = await openLocalTwinCamera(navigator.mediaDevices);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraState("active");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraState(name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };
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
      {framing.status === "unknown" ? (
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{copy.framingUnknown}</p>
      ) : null}
    </div>
  );
}
