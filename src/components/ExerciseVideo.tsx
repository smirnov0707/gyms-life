import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { getExerciseMedia } from "../lib/exercise-media";

interface ExerciseVideoProps {
  slug: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  isHovered?: boolean;
}

/** Source demonstration only: no inferred phase, angle or athlete telemetry. */
export function ExerciseVideo({
  slug,
  title = "",
  className = "",
  autoPlay = false,
  isHovered,
}: ExerciseVideoProps) {
  const { lang, t } = useI18n();
  const lt = baseLang(lang) === "lt";
  const media = getExerciseMedia(slug);
  const frames = media.type === "frames" ? (media.frames ?? []) : [];
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setFrameIndex(0);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const shouldPlay = !motion.matches && (isHovered ?? autoPlay);
      setPlaying(shouldPlay);
      const video = videoRef.current;
      if (video) {
        if (shouldPlay) void video.play().catch(() => {});
        else video.pause();
      }
    };
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, [slug, autoPlay, isHovered]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(
      () => setFrameIndex((index) => (index + 1) % frames.length),
      1200,
    );
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  return (
    <figure className={`fl-exercise-demo ${className}`}>
      <div className="fl-exercise-demo-stage">
        {media.type === "video" && media.videoUrl ? (
          <video
            ref={videoRef}
            src={media.videoUrl}
            poster={media.posterUrl}
            controls
            loop
            muted
            playsInline
            preload="metadata"
            aria-label={title || slug}
          />
        ) : frames.length > 0 ? (
          <img src={frames[frameIndex] ?? frames[0]} alt={title || slug} loading="lazy" />
        ) : (
          <p className="p-6 text-center text-sm">
            {lt
              ? "Šio pratimo demonstracijos dar nėra."
              : "A demonstration is not available for this exercise yet."}
          </p>
        )}
      </div>
      <figcaption className="fl-exercise-demo-caption">
        <span>
          <span className="fl-exercise-demo-label">{t("ex.technique")}</span>
          <strong>{title || slug.replace(/-/g, " ")}</strong>
        </span>
        {frames.length > 1 && (
          <div className="fl-exercise-demo-controls">
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={
                playing
                  ? lt
                    ? "Sustabdyti demonstraciją"
                    : "Pause demonstration"
                  : lt
                    ? "Paleisti demonstraciją"
                    : "Play demonstration"
              }
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            {frames.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={frameIndex === index}
                aria-label={`${lt ? "Kadras" : "Frame"} ${index + 1}`}
                onClick={() => {
                  setPlaying(false);
                  setFrameIndex(index);
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}
      </figcaption>
    </figure>
  );
}

export default ExerciseVideo;
