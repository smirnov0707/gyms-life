import React, { useState, useRef } from "react";
import { Play, Pause, Sliders, CheckCircle2, XCircle, Camera } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { exerciseVideo, exerciseVideoPoster } from "@/lib/exercise-media";
import { Button } from "./ui/button";

export interface ExerciseVideoProProps {
  slug?: string | null;
  muscleGroup?: string | null;
  name?: string | null;
  equipment?: string | null | undefined;
  className?: string;
  mistakes?: string | null | undefined;
  instructions?: string | null | undefined;
}

export const ExerciseVideo: React.FC<ExerciseVideoProProps> = ({
  slug,
  muscleGroup,
  name,
  equipment,
  className,
  mistakes,
  instructions,
}) => {
  const { t, lang } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showComparison, setShowComparison] = useState(false);

  const clip = exerciseVideo(slug, muscleGroup, equipment);
  const poster = exerciseVideoPoster(slug, muscleGroup, equipment);


  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const frame = className ?? "aspect-video w-full bg-surface object-contain";

  const fallbackMistakes =
    lang === "lt"
      ? "Per didelis svoris ir įsibėgėjimas, nepilna judesio amplitudė, sulenkta nugara, kvėpavimo sulaikymas ir per greitas nuleidimas."
      : "Using too much weight and momentum, partial range of motion, rounded back, holding your breath, and lowering the weight too fast.";

  return (
    <div className="space-y-4">
      <div className="rounded-3xl overflow-hidden border border-border bg-surface shadow-2xl">
        <div className="relative">
          <video
            ref={videoRef}
            key={clip}
            src={clip}
            poster={poster}
            className={frame}
            autoPlay
            loop
            muted
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-background/70 backdrop-blur text-[11px] font-mono font-bold text-primary border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {t("ms.video.correctPath")}
          </span>
        </div>

        {/* Controls below the video — never covering it */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
              className="h-8 w-8 rounded-xl text-foreground"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <div className="flex gap-1 rounded-xl bg-surface p-1">
              {[0.5, 0.75, 1].map((r) => (
                <button
                  key={r}
                  onClick={() => changeRate(r)}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                    playbackRate === r
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>




          <Button
            onClick={() => setShowComparison(!showComparison)}
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs"
          >
            <Sliders className="w-3.5 h-3.5 mr-1 text-accent" />
            {showComparison ? t("ms.video.hideMistakes") : t("ms.video.mistakeAnalysis")}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button asChild size="sm" className="rounded-xl font-bold">
          <Link to="/ar">
            <Camera className="w-4 h-4 mr-1.5" /> {t("ms.video.testWithAr")}
          </Link>
        </Button>
      </div>

      {showComparison && (
        <div className="p-5 rounded-3xl bg-surface border border-border grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-primary text-xs font-mono font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" /> {t("ms.video.correctExecution")}
            </div>
            <p className="text-xs text-foreground leading-relaxed">{instructions || t("ms.video.correctExecutionDesc")}</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider">
              <XCircle className="w-4 h-4" /> {t("ms.video.commonMistakes")}
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {mistakes || fallbackMistakes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
