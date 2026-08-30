import React, { useCallback, useEffect, useRef, useState } from "react";
import { User, Camera, Loader2, RefreshCw, AlertTriangle, Upload, X, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { analyzeBodyScan } from "@/lib/body-scan.functions";

type Result = {
  confidence: number;
  saved: boolean;
  bodyFat: number | null;
  methods: { navy: number | null; bmi: number | null; visual: number | null };
  waistCm: number | null;
  neckCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  weightKg: number | null;
  leanMassKg: number | null;
  fatMassKg: number | null;
  bmi: number | null;
  waistToHeight: number | null;
  waistToHip: number | null;
  summary: string;
};

const COPY = {
  lt: {
    title: "3D kūno kompozicijos ir apimčių Treneris skeneris",
    subtitle: "Nuotrauka → riebalų %, apimtys cm ir raumenų masė",
    height: "Ūgis (cm)",
    weight: "Svoris (kg)",
    age: "Amžius",
    sex: "Lytis",
    male: "Vyras",
    female: "Moteris",
    unknown: "Nenurodyta",
    start: "Įjungti kamerą",
    upload: "Įkelti iš galerijos",
    capture: "Fotografuoti",
    close: "Išjungti kamerą",
    analyze: "Analizuoti",
    analyzing: "Treneris analizuoja kūno geometriją...",
    photos: "Nuotraukos",
    photosHint: "Pridėk iki 3 nuotraukų: iš priekio, iš šono ir iš nugaros — tikslumas ženkliai išauga.",
    hint: "Stovėk visu ūgiu kadre, prigludusiais drabužiais, gerame apšvietime.",
    needHeight: "Įvesk ūgį – be jo matavimai netikslūs.",
    needPhoto: "Pirmiausia pridėk bent vieną nuotrauką.",
    cameraFail: "Nepavyko pasiekti kameros. Leisk prieigą arba įkelk nuotrauką.",
    seeking: "Ieškau žmogaus kadre...",
    closer: "Prieik arčiau – priartinu vaizdą",
    back: "Atsitrauk – atitolinu vaizdą",
    center: "Stok kadro viduryje",
    good: "Kadras puikus – gali fotografuoti",

    rejected: "Nuotrauka atmesta",
    confidence: "Patikimumas",
    bodyFat: "Riebalai",
    waist: "Liemuo",
    neck: "Kaklas",
    chest: "Krūtinė",
    hips: "Klubai",
    arm: "Ranka",
    thigh: "Šlaunis",
    lean: "Raumenų masė",
    fat: "Riebalų masė",
    bmi: "KMI",
    whtr: "Liemuo/ūgis",
    whr: "Liemuo/klubai",
    methods: "Metodų sutapimas",
    navy: "Navy formulė",
    bmiM: "KMI formulė",
    visual: "Treneris vizualiai",
    saved: "✓ Rezultatai išsaugoti kūno progreso žurnale",
    notSaved: "Rezultatai parodyti, bet neišsaugoti žurnale.",
  },
  en: {
    title: "3D body composition & measurement Coach scanner",
    subtitle: "Photo → body-fat %, circumferences in cm and lean mass",
    height: "Height (cm)",
    weight: "Weight (kg)",
    age: "Age",
    sex: "Sex",
    male: "Male",
    female: "Female",
    unknown: "Unspecified",
    start: "Open camera",
    upload: "Upload from gallery",
    capture: "Capture",
    close: "Close camera",
    analyze: "Analyse",
    analyzing: "Coach is analysing body geometry...",
    photos: "Photos",
    photosHint: "Add up to 3 photos: front, side and back — accuracy improves a lot.",
    hint: "Stand full-height in frame, in fitted clothing and good light.",
    needHeight: "Enter your height — measurements need it for scale.",
    needPhoto: "Add at least one photo first.",
    cameraFail: "Could not access the camera. Allow permission or upload a photo.",
    seeking: "Looking for a person in frame...",
    closer: "Step closer — zooming in",
    back: "Step back — zooming out",
    center: "Move to the centre of the frame",
    good: "Framing looks great — capture now",

    rejected: "Photo rejected",
    confidence: "Confidence",
    bodyFat: "Body fat",
    waist: "Waist",
    neck: "Neck",
    chest: "Chest",
    hips: "Hips",
    arm: "Arm",
    thigh: "Thigh",
    lean: "Lean mass",
    fat: "Fat mass",
    bmi: "BMI",
    whtr: "Waist/height",
    whr: "Waist/hip",
    methods: "Method agreement",
    navy: "Navy formula",
    bmiM: "BMI formula",
    visual: "Coach visual",
    saved: "✓ Results saved to your body progress log",
    notSaved: "Results shown but not saved to the log.",
  },
} as const;

const MAX_PHOTOS = 3;

async function downscale(dataUrl: string, maxSide = 1280): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const BodyCompositionScanner: React.FC<{
  onResult?: (result: Result & { heightCm: number; weightKg: number | null; sex: string; age: number | null }) => void;
}> = ({ onResult }) => {
  const { lang } = useI18n();
  const c = COPY[lang === "lt" ? "lt" : "en"];
  const { user } = useAuth();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeBodyScan);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "unknown">("unknown");
  const [framing, setFraming] = useState<{ state: string; text: string } | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);


  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  // Attach the stream once the <video> element is actually mounted.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [cameraOn]);

  /**
   * Auto-framing: every 600 ms a downscaled frame is scanned for the subject
   * (pixels that differ from the border/background), then the optical zoom is
   * nudged so the whole body fills ~75 % of the frame height.
   */
  useEffect(() => {
    if (!cameraOn) {
      setFraming(null);
      setBox(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 96;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let cancelled = false;

    const tick = async () => {
      const video = videoRef.current;
      const track = streamRef.current?.getVideoTracks()[0];
      if (cancelled || !ctx || !video || !video.videoWidth) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data: px, width: w, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // background reference = average of the frame border
      let br = 0, bg = 0, bb = 0, n = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x > 3 && x < w - 4 && y > 3 && y < h - 4) continue;
          const i = (y * w + x) * 4;
          br += px[i]!; bg += px[i + 1]!; bb += px[i + 2]!; n++;
        }
      }
      br /= n; bg /= n; bb /= n;

      let minX = w, maxX = -1, minY = h, maxY = -1, count = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
          const diff = Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
          const skin = r > 60 && r > g + 12 && r > b + 12;
          if (diff > 90 || skin) {
            count++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const coverage = count / (w * h);
      if (maxY < 0 || coverage < 0.04 || coverage > 0.9) {
        setFraming({ state: "seeking", text: c.seeking });
        setBox(null);
        return;
      }

      const rect = {
        left: (minX / w) * 100,
        top: (minY / h) * 100,
        width: ((maxX - minX) / w) * 100,
        height: ((maxY - minY) / h) * 100,
      };
      setBox(rect);

      const fill = rect.height / 100;
      const centreOffset = Math.abs(rect.left + rect.width / 2 - 50);

      const caps = (track?.getCapabilities?.() ?? {}) as {
        zoom?: { min?: number; max?: number; step?: number };
      };
      const settings = (track?.getSettings?.() ?? {}) as { zoom?: number };
      const canZoom = track && caps.zoom?.max != null && caps.zoom.min != null;

      const applyZoom = async (delta: number) => {
        if (!canZoom) return;
        const min = caps.zoom!.min!;
        const max = caps.zoom!.max!;
        const step = caps.zoom!.step || (max - min) / 20 || 0.1;
        const current = settings.zoom ?? min;
        const next = Math.min(max, Math.max(min, current + delta * step * 2));
        if (Math.abs(next - current) < step / 2) return;
        await track!
          .applyConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] })
          .catch(() => {});
      };

      if (fill < 0.6) {
        setFraming({ state: "closer", text: c.closer });
        await applyZoom(1);
      } else if (fill > 0.95) {
        setFraming({ state: "back", text: c.back });
        await applyZoom(-1);
      } else if (centreOffset > 22) {
        setFraming({ state: "center", text: c.center });
      } else {
        setFraming({ state: "good", text: c.good });
      }
    };

    const id = window.setInterval(() => void tick(), 600);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cameraOn, c]);



  const startCamera = async () => {
    if (shots.length >= MAX_PHOTOS) {
      setShots((s) => s.slice(0, MAX_PHOTOS - 1));
    }
    try {
      // Ask for the widest / highest-resolution frame the device can give.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, max: 3840 },
            height: { ideal: 1920, max: 3840 },
            aspectRatio: { ideal: 0.75 },
            // @ts-expect-error non-standard but widens FOV on Chrome/Android
            zoom: { ideal: 1 },
            resizeMode: "none",
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      }
      // Zoom all the way out when the device exposes a zoom capability.
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min?: number } };
      if (track && caps.zoom?.min != null) {
        await track
          .applyConstraints({ advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet] })
          .catch(() => {});
      }
      streamRef.current = stream;
      setResult(null);
      setRejected(null);
      setCameraOn(true);
    } catch {
      toast.error(c.cameraFail);
      galleryRef.current?.click();
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.85);
    setShots((s) => [...s, image].slice(0, MAX_PHOTOS));
    setResult(null);
    setRejected(null);
    if (shots.length + 1 >= MAX_PHOTOS) stopCamera();
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    stopCamera();
    const read = await Promise.all(
      files.slice(0, MAX_PHOTOS).map(
        (file) =>
          new Promise<string | null>((resolve) => {
            if (!file.type.startsWith("image/")) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      ),
    );
    const valid = read.filter((v): v is string => !!v);
    if (!valid.length) {
      toast.error(c.needPhoto);
      return;
    }
    const resized = await Promise.all(valid.map((v) => downscale(v)));
    setShots((s) => [...s, ...resized].slice(0, MAX_PHOTOS));
    setResult(null);
    setRejected(null);
  };

  const run = async () => {
    const h = Number(heightCm.replace(",", "."));
    if (!h || h < 120 || h > 230) {
      toast.error(c.needHeight);
      return;
    }
    if (!shots.length) {
      toast.error(c.needPhoto);
      return;
    }
    stopCamera();
    setBusy(true);
    setResult(null);
    setRejected(null);
    try {
      const w = Number(weightKg.replace(",", "."));
      const a = Number(age);
      const res = await analyze({
        data: {
          images: shots,
          heightCm: h,
          ...(w >= 30 && w <= 300 ? { weightKg: w } : {}),
          ...(a >= 10 && a <= 100 ? { age: a } : {}),
          sex,
          lang,
        },
      });
      if (!res.ok) {
        setRejected(res.reason);
      } else {
        setResult(res as Result);
        if (user) qc.invalidateQueries({ queryKey: ["metrics", user.id] });
        onResult?.({
          ...(res as Result),
          heightCm: h,
          weightKg: res.weightKg ?? (w >= 30 && w <= 300 ? w : null),
          sex,
          age: a >= 10 && a <= 100 ? a : null,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const metric = (label: string, value: number | null, unit: string, accent?: boolean) => (
    <div className="p-3 rounded-2xl bg-surface border border-border">
      <span className="block text-[10px] font-mono text-muted-foreground uppercase">{label}</span>
      <span className={`text-sm font-black font-mono ${accent ? "text-primary" : "text-foreground"}`}>
        {value == null ? "—" : `${value}${unit}`}
      </span>
    </div>
  );

  return (
    <div className="p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{c.title}</h3>
          <p className="text-xs text-muted-foreground">{c.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{c.height}</label>
          <Input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="decimal" placeholder="180" className="h-9" />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{c.weight}</label>
          <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" placeholder="80" className="h-9" />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{c.age}</label>
          <Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="30" className="h-9" />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{c.sex}</label>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {(["male", "female", "unknown"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                className={`h-8 rounded-lg border px-1 text-[10px] font-semibold transition ${
                  sex === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {c[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFiles}
        className="hidden"
      />

      <div
        className={`relative overflow-hidden rounded-2xl border border-border ${
          cameraOn ? "bg-black aspect-[3/4] max-h-[72vh]" : "bg-surface-2 aspect-[3/4] max-h-96"
        }`}
      >
        {cameraOn ? (
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
        ) : shots[0] ? (
          <img src={shots[shots.length - 1]} alt="Body scan" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Camera className="w-8 h-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{c.hint}</p>
            <p className="text-[11px] text-muted-foreground/80">{c.photosHint}</p>
          </div>
        )}
        {cameraOn && (
          <>
            <div
              className={`pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed transition-colors ${
                framing?.state === "good" ? "border-primary" : "border-primary/40"
              }`}
            />
            {box && (
              <div
                className={`pointer-events-none absolute rounded-xl border-2 transition-all duration-500 ${
                  framing?.state === "good" ? "border-primary" : "border-accent/70"
                }`}
                style={{
                  left: `${box.left}%`,
                  top: `${box.top}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
              <span
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold backdrop-blur-md ${
                  framing?.state === "good"
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-background/80 text-foreground"
                }`}
              >
                {framing?.text ?? c.seeking}
              </span>
            </div>
          </>
        )}

        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs font-mono text-foreground">{c.analyzing}</span>
          </div>
        )}
      </div>

      {shots.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            {c.photos} {shots.length}/{MAX_PHOTOS}
          </span>
          <div className="flex gap-2">
            {shots.map((s, i) => (
              <div key={i} className="relative">
                <img src={s} alt={`shot ${i + 1}`} className="h-12 w-10 rounded-lg object-cover border border-border" />
                <button
                  type="button"
                  onClick={() => setShots((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  aria-label="remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {cameraOn ? (
          <>
            <Button onClick={capture} disabled={busy} className="w-full rounded-2xl py-6 font-bold">
              <Camera className="w-4 h-4 mr-2" /> {c.capture}
            </Button>
            <Button variant="outline" onClick={stopCamera} className="w-full rounded-2xl py-6 font-bold">
              <X className="w-4 h-4 mr-2" /> {c.close}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={startCamera} disabled={busy || shots.length >= MAX_PHOTOS} className="w-full rounded-2xl py-6 font-bold">
              {shots.length ? <RefreshCw className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              {c.start}
            </Button>
            <Button
              variant="outline"
              onClick={() => galleryRef.current?.click()}
              disabled={busy || shots.length >= MAX_PHOTOS}
              className="w-full rounded-2xl py-6 font-bold"
            >
              <Upload className="w-4 h-4 mr-2" /> {c.upload}
            </Button>
          </>
        )}
      </div>

      <Button
        onClick={run}
        disabled={busy || !shots.length}
        className="w-full rounded-2xl py-6 font-bold"
      >
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {c.analyze}
      </Button>

      {rejected && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3">
          <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0 text-destructive" />
          <div>
            <p className="text-xs font-bold text-destructive uppercase">{c.rejected}</p>
            <p className="text-xs text-foreground">{rejected}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3 animate-in fade-in">
          <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
            {metric(c.bodyFat, result.bodyFat, "%", true)}
            {metric(c.neck, result.neckCm, " cm")}
            {metric(c.waist, result.waistCm, " cm")}
            {metric(c.chest, result.chestCm, " cm")}
            {metric(c.hips, result.hipsCm, " cm")}
            {metric(c.arm, result.armCm, " cm")}
            {metric(c.thigh, result.thighCm, " cm")}
            {metric(c.lean, result.leanMassKg, " kg")}
            {metric(c.fat, result.fatMassKg, " kg")}
            {metric(c.bmi, result.bmi, "")}
            {metric(c.whtr, result.waistToHeight, "")}
            {metric(c.whr, result.waistToHip, "")}
          </div>

          <div className="rounded-2xl border border-border bg-surface-2 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {c.methods}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [c.navy, result.methods.navy],
                [c.bmiM, result.methods.bmi],
                [c.visual, result.methods.visual],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span className="block text-[10px] text-muted-foreground">{label as string}</span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {value == null ? "—" : `${value}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {result.summary && <p className="text-xs text-muted-foreground">{result.summary}</p>}
          <p className="text-[11px] font-mono text-primary">
            {c.confidence}: {result.confidence}% · {result.saved ? c.saved : c.notSaved}
          </p>
        </div>
      )}
    </div>
  );
};
