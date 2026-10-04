import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  Activity,
  Camera,
  ChevronDown,
  Cpu,
  Gauge,
  Loader2,
  Maximize2,
  Minimize2,
  Scale,
  Settings2,
  Sparkles,
  Square,
  SwitchCamera,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { evaluateStep, type CalibFrame } from "@/lib/ar-calibration";
import { useI18n, baseLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import {
  AR_EXERCISES,
  SKELETON,
  evaluateTargets,
  type Point,
  type TargetState,
} from "@/lib/ar-angles";
import {
  AR_TXT,
  RepAnalyser,
  detectExercise,
  exerciseName,
  summarizeSet,
  type PoseSample,
  type RepRecord,
  type SetSummary,
} from "@/lib/ar-smart";
import { VoiceCoach } from "@/lib/ar-voice-coach";
import { Input } from "@/components/ui/input";
import { recordArWorkout } from "@/lib/ar-workout.functions";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { FormScanner } from "@/components/FormScanner";
import { BiomechanicsScanner } from "@/components/BiomechanicsScanner";

export const Route = createFileRoute("/_authenticated/ar")({
  head: () => ({
    meta: [
      { title: "Movement Scan — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Vienas Movement Scan sujungia gyvą trenerį, technikos peržiūrą ir judesio profilį.",
      },
      { property: "og:title", content: "Movement Scan — GYMS.LIFE" },
      {
        property: "og:description",
        content:
          "Gyvas judesio vertinimas, technikos peržiūra ir judesio profilis vienoje vietoje.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArMode,
});

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type Calibration = { cmPerPx: number; standingHipY: number; quality: number };

function ArMode() {
  const { t, lang } = useI18n();
  const base = baseLang(lang);
  const TX = AR_TXT[base];

  const videoRef = useRef<HTMLVideoElement>(null);
  const { start: openCamera, stop: releaseCamera, busy: cameraBusy } = useCameraStream(videoRef);
  const startRequest = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const analyserRef = useRef(new RepAnalyser(AR_EXERCISES[0]!));
  const samplesRef = useRef<PoseSample[]>([]);
  const calibFramesRef = useRef<CalibFrame[]>([]);
  const calibRef = useRef<Calibration | null>(null);
  const calibStartRef = useRef(0);
  const detectAtRef = useRef(0);
  const depthRef = useRef(0);
  const coachRef = useRef(new VoiceCoach());

  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [slug, setSlug] = useState(AR_EXERCISES[0]!.slug);
  const [reps, setReps] = useState(0);
  const [lastRep, setLastRep] = useState<RepRecord | null>(null);
  const [states, setStates] = useState<TargetState[]>([]);
  const [poseOn, setPoseOn] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calib, setCalib] = useState<Calibration | null>(null);
  const [depthCm, setDepthCm] = useState(0);
  const [summary, setSummary] = useState<SetSummary | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [repList, setRepList] = useState<RepRecord[]>([]);
  const [setWeight, setSetWeight] = useState("");
  const [savingSet, setSavingSet] = useState(false);
  const [savedSet, setSavedSet] = useState(false);
  const [completedSetId, setCompletedSetId] = useState<string | null>(null);
  const [tab, setTab] = useState<"live" | "scan" | "biomechanics">("live");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [fullscreen, setFullscreen] = useState(false);

  const [voice, setVoice] = useState(true);
  const [coachMode, setCoachMode] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState("");
  const [rate, setRate] = useState(1);
  // This number is the scale reference: `cmPerPx = (heightCm * 0.93) / meanH`
  // converts every pixel the camera sees into centimetres. Starting it at 178
  // meant the coach measured a body it had invented, and reported the result
  // in centimetres as if it had measured the athlete's.
  const [heightCm, setHeightCm] = useState("");

  const slugRef = useRef(slug);
  const autoRef = useRef(autoMode);
  const langRef = useRef(base);
  const voiceRef = useRef(voice);
  const coachModeRef = useRef(coachMode);
  const voiceUriRef = useRef(voiceUri);
  const rateRef = useRef(rate);
  const heightRef = useRef(heightCm);

  useEffect(() => {
    slugRef.current = slug;
    const ex = AR_EXERCISES.find((e) => e.slug === slug)!;
    analyserRef.current.reset(ex);
  }, [slug]);
  useEffect(() => {
    autoRef.current = autoMode;
  }, [autoMode]);
  useEffect(() => {
    langRef.current = base;
  }, [base]);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);
  useEffect(() => {
    coachModeRef.current = coachMode;
  }, [coachMode]);
  useEffect(() => {
    voiceUriRef.current = voiceUri;
  }, [voiceUri]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    heightRef.current = heightCm;
  }, [heightCm]);

  // The athlete's height already lives on their profile, where the meal plan,
  // the micronutrient scan and the body scan all read it. Asking for it again
  // here created a second copy that only this device could see, and left the
  // canonical one untouched.
  const { user } = useAuth();
  const { data: profileHeightCm } = useQuery({
    queryKey: ["profile-height", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("height_cm")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.height_cm ?? null;
    },
  });

  // restore saved preferences
  useEffect(() => {
    const stored = window.localStorage.getItem("forma_ar_calib");
    if (!stored) return;
    try {
      const p = JSON.parse(stored) as { heightCm?: string; voiceUri?: string; rate?: number };
      if (p.heightCm) setHeightCm(p.heightCm);
      if (p.voiceUri) setVoiceUri(p.voiceUri);
      if (p.rate) setRate(p.rate);
    } catch {
      /* ignore */
    }
  }, []);

  // Seeds the field from the profile, and never overrides a value the athlete
  // typed here for this device's camera.
  useEffect(() => {
    if (profileHeightCm == null) return;
    setHeightCm((current) => (current === "" ? String(profileHeightCm) : current));
  }, [profileHeightCm]);

  useEffect(() => {
    window.localStorage.setItem("forma_ar_calib", JSON.stringify({ heightCm, voiceUri, rate }));
  }, [heightCm, voiceUri, rate]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      setVoiceUri((prev) => {
        if (prev && list.some((v) => v.voiceURI === prev)) return prev;
        const wanted = langRef.current === "lt" ? "lt" : "en";
        const best =
          list.find((v) => v.lang.toLowerCase().startsWith(wanted)) ??
          list.find((v) => v.lang.toLowerCase().startsWith("en")) ??
          list[0];
        return best?.voiceURI ?? prev;
      });
    };
    load();
    const retry = window.setTimeout(load, 700);
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.clearTimeout(retry);
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);

  const releaseSession = useCallback(() => {
    startRequest.current++;
    releaseCamera();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    if (speakTimer.current) clearTimeout(speakTimer.current);
    speakTimer.current = null;
    window.speechSynthesis?.cancel();
  }, [releaseCamera]);

  useEffect(() => () => releaseSession(), [releaseSession]);

  // Fullscreen must always be escapable.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Chrome silently pauses long-running speech synthesis; nudge it awake.
  useEffect(() => {
    if (!live || typeof window === "undefined" || !window.speechSynthesis) return;
    const id = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth.paused) synth.resume();
    }, 5000);
    return () => window.clearInterval(id);
  }, [live]);

  /* ---------------- voice ---------------- */

  const pickVoice = () => {
    const list = window.speechSynthesis.getVoices();
    const chosen = list.find((v) => v.voiceURI === voiceUriRef.current);
    if (chosen) return chosen;
    const wanted = langRef.current === "lt" ? "lt" : "en";
    return (
      list.find((v) => v.lang.toLowerCase().startsWith(wanted)) ??
      list.find((v) => v.lang.toLowerCase().startsWith("en")) ??
      list[0]
    );
  };

  const utterance = (text: string) => {
    const utter = new SpeechSynthesisUtterance(text);
    const picked = pickVoice();
    if (picked) {
      utter.voice = picked;
      utter.lang = picked.lang;
    } else {
      utter.lang = langRef.current === "lt" ? "lt-LT" : "en-US";
    }
    utter.rate = rateRef.current;
    utter.volume = 1;
    return utter;
  };

  const unlockedRef = useRef(false);
  const speakingSinceRef = useRef(0);

  const speak = (text: string, force = false) => {
    if (!voiceRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
    const now = Date.now();
    if (!force && speakRef.current.text === text && now - speakRef.current.at < 6000) return;
    const synth = window.speechSynthesis;
    if (synth.paused) synth.resume();

    // Never cut a line that just started — cancel() followed immediately by
    // speak() is silently dropped on iOS/Chrome, which killed the coach voice.
    const busy = synth.speaking || synth.pending;
    if (busy && now - speakingSinceRef.current < 2500) return;

    speakRef.current = { text, at: now };
    speakingSinceRef.current = now;

    const say = () => {
      const utter = utterance(text);
      utter.onend = () => {
        speakingSinceRef.current = 0;
      };
      utter.onerror = () => {
        speakingSinceRef.current = 0;
      };
      synth.speak(utter);
    };

    if (busy) {
      synth.cancel();
      speakTimer.current = setTimeout(() => {
        speakTimer.current = null;
        say();
      }, 80);
    } else {
      say();
    }
  };

  /** iOS/Android only allow speech after a real user gesture. */
  const unlockVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const warmup = new SpeechSynthesisUtterance(langRef.current === "lt" ? "Pasiruošk" : "Ready");
    const picked = pickVoice();
    if (picked) {
      warmup.voice = picked;
      warmup.lang = picked.lang;
    }
    warmup.volume = unlockedRef.current ? 0.01 : 1;
    warmup.rate = rateRef.current;
    synth.speak(warmup);
    unlockedRef.current = true;
  };

  /* ---------------- session ---------------- */

  const facingRef = useRef(facing);

  /** Swaps cameras without resetting the analysed set. */
  const switchCamera = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    facingRef.current = next;
    if (!live) return;
    try {
      await openCamera(next);
    } catch (error) {
      stopCamera();
      toast.error(errorMessage(error, t("ar.failed")));
    }
  };

  const start = async () => {
    releaseSession();
    const request = startRequest.current;
    setLoading(true);
    if (voiceRef.current) unlockVoice();
    try {
      const vision = await import("@mediapipe/tasks-vision");
      if (request !== startRequest.current) return;
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      if (request !== startRequest.current) return;
      const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      if (request !== startRequest.current) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;
      if (!(await openCamera(facingRef.current)) || request !== startRequest.current) return;

      analyserRef.current.reset(AR_EXERCISES.find((e) => e.slug === slugRef.current)!);
      calibFramesRef.current = [];
      calibStartRef.current = 0;
      calibRef.current = null;
      samplesRef.current = [];
      setCalib(null);
      setSummary(null);
      setSavedSet(false);
      setCompletedSetId(null);
      setReps(0);
      setLastRep(null);
      setRepList([]);
      setCalibrating(true);
      coachRef.current.reset(performance.now());
      setLive(true);
      loop();
      speak(TX.ready, true);
    } catch (error) {
      if (request !== startRequest.current) return;
      stopCamera();
      toast.error(errorMessage(error, t("ar.failed")));
    } finally {
      if (request === startRequest.current) setLoading(false);
    }
  };

  /** Writes the analysed AR set into the real training history. */
  const saveSet = async () => {
    if (!summary || !completedSetId || savedSet) return;
    setSavingSet(true);
    try {
      const ex = AR_EXERCISES.find((e) => e.slug === slugRef.current)!;
      const name = ex.name[base];
      const normalizedWeight = setWeight.trim().replace(",", ".");
      await recordArWorkout({
        data: {
          sessionId: completedSetId,
          exerciseSlug: ex.slug,
          exerciseName: name,
          reps: summary.reps,
          weightKg: normalizedWeight === "" ? 0 : Number(normalizedWeight),
          notes: `${summary.headline} ${summary.fix}`.trim(),
        },
      });
      setSavedSet(true);
      toast.success(t("nx.ar.saved"));
    } catch (error) {
      toast.error(errorMessage(error, t("common.error")));
    } finally {
      setSavingSet(false);
    }
  };

  const finishSet = () => {
    const result = summarizeSet(analyserRef.current.reps, langRef.current);
    setSummary(result);
    setSavedSet(false);
    setCompletedSetId(result ? crypto.randomUUID() : null);
    stopCamera();
    if (result) speak(`${result.headline} ${result.fix}`.trim(), true);
  };

  const stopCamera = () => {
    releaseSession();
    setLoading(false);
    setLive(false);
    setPoseOn(false);
    setCalibrating(false);
    setStates([]);
  };

  /* ---------------- render loop ---------------- */

  const loop = () => {
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker || video.readyState < 2) return;
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pose = result?.landmarks?.[0] as Point[] | undefined;
      if (!pose) {
        setStates([]);
        setPoseOn(false);
        return;
      }
      setPoseOn(true);

      // --- background calibration during the first seconds of standing ---
      if (!calibRef.current) {
        if (!calibStartRef.current) calibStartRef.current = now;
        calibFramesRef.current.push({ pose, w: canvas.width, h: canvas.height });
        if (now - calibStartRef.current > 3500 && calibFramesRef.current.length > 20) {
          // Without a real height there is no scale. `evaluateStep` already
          // handles that: it reports in pixels and returns no `cmPerPx`, so
          // the calibration below simply does not complete.
          const res = evaluateStep(
            "stand",
            calibFramesRef.current,
            Number(heightRef.current) || 0,
            langRef.current,
          );
          if (res.cmPerPx && res.standingHipY) {
            const next = {
              cmPerPx: res.cmPerPx,
              standingHipY: res.standingHipY,
              quality: Math.round(res.quality),
            };
            calibRef.current = next;
            setCalib(next);
            setCalibrating(false);
            speak(TX.calDone, true);
          } else {
            calibStartRef.current = now;
          }
          calibFramesRef.current = [];
        }
      }

      // --- automatic exercise recognition ---
      samplesRef.current.push({ pose, t: now });
      samplesRef.current = samplesRef.current.filter((s) => now - s.t < 2500);
      if (autoRef.current && now - detectAtRef.current > 900) {
        detectAtRef.current = now;
        const guess = detectExercise(samplesRef.current);
        if (guess && guess !== slugRef.current) {
          slugRef.current = guess;
          setSlug(guess);
          setReps(0);
          setLastRep(null);
          analyserRef.current.reset(AR_EXERCISES.find((e) => e.slug === guess)!);
          speak(TX.detected(exerciseName(guess, langRef.current)), true);
        }
      }

      const exercise = AR_EXERCISES.find((e) => e.slug === slugRef.current)!;
      const evaluated = evaluateTargets(pose, exercise, langRef.current);
      setStates(evaluated);

      // --- depth readout in cm ---
      const cal = calibRef.current;
      if (cal) {
        const hips = [pose[23], pose[24]].filter(Boolean) as Point[];
        if (hips.length) {
          const hipY = (hips.reduce((n, p) => n + p.y, 0) / hips.length) * canvas.height;
          const cm = Math.max(0, Math.round((hipY - cal.standingHipY) * cal.cmPerPx));
          if (Math.abs(cm - depthRef.current) >= 1) {
            depthRef.current = cm;
            setDepthCm(cm);
          }
        }
      }

      // --- rep analysis ---
      const rep = analyserRef.current.push(pose, langRef.current, now);
      if (rep) {
        setLastRep(rep);
        setRepList([...analyserRef.current.reps]);
        setReps(analyserRef.current.reps.length);
      }

      if (coachModeRef.current) {
        // Advanced live coaching: counts, short error calls and tempo pushes.
        const line = coachRef.current.tick({
          now,
          lang: langRef.current,
          states: evaluated,
          rep,
          repCount: analyserRef.current.reps.length,
        });
        if (line) speak(line, true);
      } else if (rep) {
        speak(rep.score >= 85 ? t("rt.ar.cleanRep") : rep.fix || t("rt.ar.oneMore"), true);
      }

      /* ---------------- drawing ---------------- */
      const px = (p: Point) => ({ x: p.x * canvas.width, y: p.y * canvas.height });
      const worst = evaluated.find((s) => s.status !== "ok");

      ctx.lineWidth = Math.max(3, canvas.width / 260);
      ctx.strokeStyle = worst ? "rgba(255,170,60,0.95)" : "rgba(190,255,60,0.95)";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 14;
      for (const [a, b] of SKELETON) {
        const pa = pose[a];
        const pb = pose[b];
        if (!pa || !pb) continue;
        const A = px(pa);
        const B = px(pb);
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const p of pose) {
        const P = px(p);
        ctx.beginPath();
        ctx.arc(P.x, P.y, Math.max(3, canvas.width / 340), 0, Math.PI * 2);
        ctx.fill();
      }

      // only draw the joint that currently needs attention — keeps the view clean
      const focus = worst ?? evaluated[0];
      if (focus) {
        const V = px(focus.vertex);
        const r = Math.max(26, canvas.width / 18);
        const ok = focus.status === "ok";
        ctx.strokeStyle = ok ? "rgba(190,255,60,1)" : "rgba(255,120,80,1)";
        ctx.lineWidth = Math.max(3, canvas.width / 300);
        ctx.beginPath();
        ctx.arc(V.x, V.y, r, 0, (Math.PI * 2 * Math.min(focus.angle, 180)) / 180);
        ctx.stroke();
        ctx.font = `bold ${Math.max(16, Math.round(canvas.width / 34))}px sans-serif`;
        ctx.fillStyle = ok ? "rgba(190,255,60,1)" : "rgba(255,140,90,1)";
        ctx.fillText(`${focus.angle}°`, V.x + r + 8, V.y);

        if (!ok) {
          const dir = focus.status === "high" ? 1 : -1;
          const len = r * 1.6;
          ctx.beginPath();
          ctx.moveTo(V.x, V.y - dir * r);
          ctx.lineTo(V.x, V.y - dir * (r + len));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(V.x, V.y - dir * (r + len) - dir * 4);
          ctx.lineTo(V.x - 12, V.y - dir * (r + len) + dir * 16);
          ctx.lineTo(V.x + 12, V.y - dir * (r + len) + dir * 16);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,140,90,1)";
          ctx.fill();
        }
      }
    };

    rafRef.current = requestAnimationFrame(render);
  };

  const exercise = AR_EXERCISES.find((e) => e.slug === slug)!;
  // No measured target is not a clean rep. `evaluateTargets` returns nothing
  // for joints the camera could not see, and "form looks good" there is a
  // verdict on something nobody looked at.
  const nothingMeasured = states.length === 0;
  const cue = nothingMeasured
    ? t("ar.noPose")
    : (states.find((s) => s.status !== "ok")?.cue ?? t("ar.formOk"));

  return (
    <div className="fl-context-route fl-workspace fl-camera-workspace fl-page-enter">
      {!fullscreen && (
        <header className="fl-workspace-hero fl-camera-hero">
          <div>
            <p className="fl-workspace-eyebrow">
              GYMS.LIFE / {base === "lt" ? "JUDESYS" : "MOVEMENT"}
            </p>
            <h1 className="fl-workspace-title">
              {base === "lt" ? "Movement Scan." : "Movement Scan."}
            </h1>
            <p>
              {base === "lt"
                ? "Vienas judesio centras: gyvas treneris, technikos peržiūra ir judesio profilis."
                : "One movement workspace: live coaching, technique review and movement profile."}
            </p>
          </div>
          <div className="fl-camera-hero-mark" aria-hidden="true">
            <Activity />
          </div>
        </header>
      )}

      {!fullscreen && (
        <div
          className="fl-camera-modebar"
          role="group"
          aria-label={base === "lt" ? "Analizės režimai" : "Analysis modes"}
        >
          {(
            [
              ["live", Camera, base === "lt" ? "Gyvas treneris" : "Live coach"],
              ["scan", Target, base === "lt" ? "Technikos analizė" : "Technique review"],
              ["biomechanics", Activity, base === "lt" ? "Judesio profilis" : "Movement profile"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => {
                if (key === tab) return;
                if (live) finishSet();
                else stopCamera();
                window.speechSynthesis?.cancel();
                setTab(key);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {!fullscreen && (
        <p className="fl-camera-mode-copy">
          {tab === "live"
            ? base === "lt"
              ? "Gyvas režimas apdoroja vaizdą šiame įrenginyje. Kamera įsijungia tik tau pasirinkus."
              : "Live mode processes video on this device. The camera starts only when you choose."
            : tab === "scan"
              ? base === "lt"
                ? "Pradėjus analizę, penki kameros kadrai siunčiami technikos peržiūrai."
                : "Starting a review sends five camera frames for technique analysis."
              : base === "lt"
                ? "Pasirinkta nuotrauka siunčiama judesio profilio analizei. Rezultatas yra įvertis."
                : "Your selected photo is sent for movement-profile analysis. The result is an estimate."}
        </p>
      )}

      {tab === "scan" && <FormScanner />}
      {tab === "biomechanics" && <BiomechanicsScanner />}

      <div className={cn("fl-camera-layout", tab !== "live" && "hidden")}>
        <div
          className={cn(
            "panel fl-camera-panel overflow-hidden",
            fullscreen && "fixed inset-0 z-50 flex flex-col rounded-none border-0 bg-background",
          )}
        >
          <div
            className={cn(
              "fl-camera-stage relative w-full",
              fullscreen ? "min-h-0 flex-1" : "aspect-[4/3] sm:aspect-video",
            )}
          >
            {fullscreen && (
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label={t("nx.ar.exitFullscreen")}
                className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs font-bold uppercase tracking-widest text-foreground shadow-lg backdrop-blur"
              >
                <Minimize2 className="size-4" /> {t("nx.ar.exitFullscreen")}
              </button>
            )}

            <video
              ref={videoRef}
              aria-label={base === "lt" ? "Gyvos kameros vaizdas" : "Live camera preview"}
              muted
              autoPlay
              playsInline
              className={cn(
                "absolute inset-0 size-full object-contain",
                facing === "user" && "-scale-x-100",
              )}
            />
            <canvas
              ref={canvasRef}
              className={cn(
                "absolute inset-0 size-full object-contain",
                facing === "user" && "-scale-x-100",
              )}
            />

            {live && (
              <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary backdrop-blur">
                  <span className="size-2 animate-pulse rounded-full bg-primary" /> live
                </span>
                <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-foreground backdrop-blur">
                  {poseOn ? exercise.name[base] : TX.detecting}
                </span>
                {calibrating && (
                  <span className="rounded-full bg-accent/85 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-background backdrop-blur">
                    {TX.autoCal}
                  </span>
                )}
              </div>
            )}

            {live && (
              <div
                className={cn(
                  "absolute right-3 grid gap-2 text-center",
                  fullscreen ? "top-16" : "top-3",
                )}
              >
                <div className="rounded-xl bg-surface px-4 py-2 backdrop-blur">
                  <div className="text-display text-4xl leading-none text-primary">{reps}</div>
                  <div className="text-[10px] uppercase tracking-widest text-foreground/70">
                    {t("ar.reps")}
                  </div>
                </div>
                {lastRep && (
                  <div className="rounded-xl bg-surface px-4 py-2 backdrop-blur">
                    <div
                      className="text-display text-3xl leading-none"
                      style={{
                        color: lastRep.score >= 85 ? "var(--primary)" : "var(--accent)",
                      }}
                    >
                      {lastRep.score}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-foreground/70">
                      {TX.quality}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!live && (
              <div className="fl-camera-idle absolute inset-0 grid place-items-center p-6 text-center">
                <div>
                  <span className="fl-camera-idle-icon">
                    <Camera aria-hidden="true" />
                  </span>
                  <h2 className="fl-camera-idle-title">
                    {base === "lt" ? "Tavo erdvė judėti." : "Your space to move."}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm">{TX.ready}</p>
                  <Button
                    onClick={start}
                    disabled={loading}
                    size="lg"
                    className="glow-ring mt-5 px-10 font-bold"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 size-4" />
                    )}
                    {loading ? t("ar.loading") : summary ? TX.again : t("ar.start")}
                  </Button>
                  {loading && (
                    <button type="button" className="fl-camera-cancel" onClick={stopCamera}>
                      {base === "lt" ? "Atšaukti" : "Cancel"}
                    </button>
                  )}
                  <span className="fl-camera-idle-note">
                    {base === "lt"
                      ? "Visas kūnas kadre · Gera šviesa"
                      : "Full body in frame · Good lighting"}
                  </span>
                </div>
              </div>
            )}

            {live && !poseOn && (
              <div className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-surface px-4 py-2 text-xs font-bold uppercase tracking-widest text-accent backdrop-blur">
                {t("ar.noPose")}
              </div>
            )}

            {live && poseOn && (
              <div
                className={cn(
                  "absolute bottom-3 left-3 max-w-[60%] rounded-xl px-4 py-2 text-sm font-bold backdrop-blur",
                  nothingMeasured
                    ? "bg-surface-2/90 text-muted-foreground"
                    : states.some((s) => s.status !== "ok")
                      ? "bg-destructive/85 text-foreground"
                      : "bg-primary/85 text-primary-foreground",
                )}
              >
                {cue}
              </div>
            )}

            {live && calib && (
              <div className="absolute bottom-3 right-3 rounded-xl bg-surface px-4 py-2 text-center backdrop-blur">
                <div className="text-display text-3xl leading-none text-accent">{depthCm} cm</div>
                <div className="text-[10px] uppercase tracking-widest text-foreground/70">
                  {t("ar.depth")}
                </div>
              </div>
            )}
          </div>

          <div
            className={cn(
              "fl-camera-controls flex flex-wrap items-center gap-2 p-4",
              fullscreen &&
                "max-h-[45vh] shrink-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]",
            )}
          >
            {live && (
              <Button onClick={finishSet} className="font-bold">
                <Square className="mr-1 size-4" /> {TX.finish}
              </Button>
            )}
            <Button
              aria-pressed={voice}
              variant={voice ? "secondary" : "outline"}
              onClick={() => {
                const next = !voice;
                setVoice(next);
                voiceRef.current = next;
                if (next) unlockVoice();
                else window.speechSynthesis?.cancel();
              }}
            >
              {t("ar.voice")}
            </Button>
            <Button
              aria-pressed={coachMode}
              variant={coachMode ? "secondary" : "outline"}
              disabled={!voice}
              onClick={() => {
                const next = !coachMode;
                setCoachMode(next);
                coachModeRef.current = next;
                if (next) unlockVoice();
              }}
            >
              {t("rt.ar.voiceCoach")}
            </Button>
            <Button variant="outline" onClick={switchCamera} disabled={loading || cameraBusy}>
              <SwitchCamera className="mr-1 size-4" />
              {facing === "environment" ? t("nx.ar.front") : t("nx.ar.rear")}
            </Button>
            <Button variant="outline" onClick={() => setFullscreen((f) => !f)}>
              {fullscreen ? (
                <Minimize2 className="mr-1 size-4" />
              ) : (
                <Maximize2 className="mr-1 size-4" />
              )}
              {fullscreen ? t("nx.ar.exitFullscreen") : t("nx.ar.fullscreen")}
            </Button>

            <button
              type="button"
              aria-expanded={showSettings}
              aria-controls="camera-settings"
              onClick={() => setShowSettings((s) => !s)}
              className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="size-4" /> {TX.settings}
              <ChevronDown className={cn("size-4 transition", showSettings && "rotate-180")} />
            </button>
          </div>
          {showSettings && (
            <div id="camera-settings" className="fl-camera-settings grid gap-4 p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Gauge className="size-4 text-primary" /> {TX.settings}
              </h2>

              <div className="flex gap-2">
                <Button
                  aria-pressed={autoMode}
                  variant={autoMode ? "default" : "outline"}
                  onClick={() => setAutoMode(true)}
                  className="flex-1"
                >
                  {TX.auto}
                </Button>
                <Button
                  aria-pressed={!autoMode}
                  variant={!autoMode ? "default" : "outline"}
                  onClick={() => setAutoMode(false)}
                  className="flex-1"
                >
                  {TX.manual}
                </Button>
              </div>

              {!autoMode && (
                <select
                  aria-label={base === "lt" ? "Pratimas" : "Exercise"}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setReps(0);
                    setLastRep(null);
                  }}
                  className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm"
                >
                  {AR_EXERCISES.map((e) => (
                    <option key={e.slug} value={e.slug}>
                      {e.name[base]}
                    </option>
                  ))}
                </select>
              )}

              <label className="grid gap-1.5 text-sm">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("ar.height")}
                </span>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="h-10 rounded-lg border border-border bg-surface-2 px-3"
                />
                {Number(heightCm) > 0 ? null : (
                  <span className="text-xs leading-relaxed text-amber-400 light:text-amber-700">
                    {t("ar.heightNeeded")}
                  </span>
                )}
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("ar.voiceSelect")}
                </span>
                <select
                  value={voiceUri}
                  onChange={(e) => setVoiceUri(e.target.value)}
                  className="h-10 rounded-lg border border-border bg-surface-2 px-3"
                >
                  <option value="">{t("ar.voiceDefault")}</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                  {t("ar.rate")} <span className="text-primary">{rate.toFixed(1)}x</span>
                </span>
                <input
                  type="range"
                  min={0.6}
                  max={1.6}
                  step={0.1}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="accent-[var(--primary)]"
                />
              </label>

              {calib && (
                <p className="text-xs text-primary">
                  {TX.calDone} · {calib.quality}% · {calib.cmPerPx.toFixed(3)} cm/px
                </p>
              )}
            </div>
          )}
        </div>

        <aside
          className={cn("fl-camera-evidence grid content-start gap-4", fullscreen && "hidden")}
        >
          {summary ? (
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Sparkles className="size-4 text-primary" /> {TX.summary}
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-surface-2 p-3">
                  <div className="text-display text-3xl text-primary">{summary.score}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {TX.quality}
                  </div>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <div className="text-display text-3xl text-foreground">{summary.reps}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("ar.reps")}
                  </div>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <div className="text-display text-2xl text-accent">{summary.tempo}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {TX.tempo}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold">{summary.headline}</p>
              {summary.fix && <p className="mt-1 text-sm text-accent">→ {summary.fix}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{summary.praise}</p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Scale className="size-4 text-primary" /> {TX.symmetry}:{" "}
                {summary.asymmetry === null ? "—" : `${summary.asymmetry}°`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Input
                  value={setWeight}
                  onChange={(e) => setSetWeight(e.target.value)}
                  inputMode="decimal"
                  aria-label={t("nx.ar.weight")}
                  placeholder={t("nx.ar.weight")}
                  className="h-9 w-28"
                />
                <Button
                  size="sm"
                  onClick={saveSet}
                  disabled={savingSet || savedSet}
                  className="font-bold"
                >
                  {savingSet ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  {t("nx.ar.saveSet")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Activity className="size-4 text-primary" /> {TX.lastRep}
              </h2>
              {lastRep ? (
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span className="font-semibold">{TX.quality}</span>
                    <span
                      className="text-display text-2xl"
                      style={{ color: lastRep.score >= 85 ? "var(--primary)" : "var(--accent)" }}
                    >
                      {lastRep.score}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span className="font-semibold">{TX.tempo}</span>
                    <span className="text-display text-xl text-foreground">
                      {lastRep.down.toFixed(1)}s / {lastRep.up.toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span className="font-semibold">{TX.symmetry}</span>
                    <span
                      className="text-display text-xl"
                      style={{
                        color:
                          lastRep.asymmetry === null
                            ? "var(--muted-foreground)"
                            : lastRep.asymmetry <= 10
                              ? "var(--primary)"
                              : "var(--accent)",
                      }}
                    >
                      {lastRep.asymmetry === null ? "—" : `${lastRep.asymmetry}°`}
                    </span>
                  </div>
                  {lastRep.fix && <p className="text-sm text-accent">→ {lastRep.fix}</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{TX.ready}</p>
              )}
            </div>
          )}

          <div className="panel p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <Activity className="size-4 text-primary" /> {t("nx.ar.repLog")}
            </h2>
            {repList.length ? (
              <div className="mt-3 grid max-h-64 gap-1.5 overflow-y-auto text-xs">
                {[...repList].reverse().map((r) => (
                  <div
                    key={r.index}
                    className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2"
                  >
                    <span className="font-mono text-muted-foreground">
                      {t("nx.ar.rep")} {r.index}
                    </span>
                    <span className="font-mono">
                      {t("nx.ar.tempoCol")} {r.down.toFixed(1)}/{r.up.toFixed(1)}s
                    </span>
                    <span className="font-mono">
                      {t("nx.ar.depthCol")} {Math.round(r.bottomAngle)}°
                    </span>
                    <span
                      className="text-display text-lg"
                      style={{ color: r.score >= 85 ? "var(--primary)" : "var(--accent)" }}
                    >
                      {r.score}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("nx.ar.repLogEmpty")}</p>
            )}
          </div>

          <div className="panel p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <Target className="size-4 text-primary" /> {t("ar.targets")}
            </h2>
            <div className="mt-3 grid gap-2">
              {exercise.targets.map((target) => {
                const state = states.find((s) => s.id === target.id);
                const ok = state?.status === "ok";
                return (
                  <div
                    key={target.id}
                    className="rounded-xl bg-surface-2 px-4 py-3 text-sm"
                    style={{
                      boxShadow: state
                        ? `inset 0 0 0 1px ${ok ? "var(--primary-dim)" : "rgba(255,140,90,.5)"}`
                        : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{target.label[base]}</span>
                      <span
                        className={`fl-camera-angle ${state ? (ok ? "text-primary" : "text-accent") : "text-muted-foreground"}`}
                      >
                        {state ? `${state.angle}°` : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("ar.range")}: {target.min}°–{target.max}°
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel flex gap-3 p-5 text-xs text-muted-foreground">
            <Cpu className="size-5 shrink-0 text-primary" />
            {t("ar.privacy")}
          </div>
        </aside>
      </div>
    </div>
  );
}
