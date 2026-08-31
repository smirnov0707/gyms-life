import React, { useEffect, useRef, useState } from "react";
import { Play, VolumeX } from "lucide-react";
import { getExerciseMedia } from "../lib/exercise-media";

interface ExerciseVideoProps {
  slug: string;
  title?: string;
  name?: string;
  muscleGroup?: string;
  equipment?: string | null;
  mistakes?: string;
  instructions?: string;
  className?: string;
  autoPlay?: boolean;
  isHovered?: boolean;
}

/**
 * Premium exercise media card.
 *
 * Real local technique clips are preferred. Exercise-database frame sequences
 * are animated when a clip is not available. The component is intentionally
 * presentation-focused so the same media treatment can be reused across the
 * dashboard, exercise library and quick-preview modal.
 */
export const ExerciseVideo: React.FC<ExerciseVideoProps> = ({
  slug,
  title,
  name,
  muscleGroup,
  equipment,
  mistakes,
  instructions,
  className = "",
  autoPlay = true,
  isHovered,
}) => {
  const media = getExerciseMedia(slug);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = name || title || slug.replace(/-/g, " ");
  const hasVideo = media.type === "video" && Boolean(media.videoUrl);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(Boolean(entry?.isIntersecting)),
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (media.type !== "frames" || !media.frames || media.frames.length <= 1) return;

    const shouldRun =
      isHovered !== undefined
        ? isHovered
        : autoPlay && (isInViewport || isInteractive);

    if (!shouldRun) {
      setFrameIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % media.frames!.length);
    }, 700);

    return () => window.clearInterval(interval);
  }, [autoPlay, isHovered, isInViewport, isInteractive, media]);

  const handleTouch = () => {
    setIsInteractive(true);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  };

  const videoShouldPlay =
    isHovered !== undefined ? isHovered : autoPlay && (isInViewport || isInteractive);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsInteractive(true)}
      onMouseLeave={() => setIsInteractive(false)}
      onTouchStart={handleTouch}
      onTouchEnd={() => window.setTimeout(() => setIsInteractive(false), 1200)}
      className={`group relative isolate h-full w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101411] shadow-[0_24px_70px_rgba(0,0,0,0.32)] ${className}`}
    >
      {hasVideo ? (
        <video
          src={media.videoUrl}
          poster={media.posterUrl}
          autoPlay={videoShouldPlay}
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={`${displayName} technique video`}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
        />
      ) : media.type === "frames" && media.frames?.length ? (
        <img
          src={media.frames[frameIndex]}
          alt={displayName}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
        />
      ) : (
        <img
          src={media.posterUrl || "/assets/ai/ex-default.jpg"}
          alt={displayName}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
        />
      )}

      {/* Cinematic readability layer — never a flat black card. */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,6,0.04)_20%,rgba(5,8,6,0.12)_45%,rgba(5,8,6,0.88)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <span className="rounded-full border border-white/15 bg-black/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur-xl">
          Technique guide
        </span>
        <span className="grid size-9 place-items-center rounded-full border border-primary/60 bg-black/30 text-primary shadow-[0_0_24px_rgba(160,220,40,0.18)] backdrop-blur-xl">
          {hasVideo ? <Play className="size-3.5 fill-current" /> : <VolumeX className="size-3.5" />}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.22em] text-primary/90">
          {muscleGroup ? muscleGroup.replace(/[_-]/g, " ") : "Movement"}
        </div>
        <h3 className="text-xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-2xl">
          {displayName}
        </h3>
        {equipment && (
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
            {equipment.replace(/[_-]/g, " ")}
          </p>
        )}
      </div>

      {(mistakes || instructions) && (
        <div className="pointer-events-none absolute bottom-4 right-4 hidden max-w-[55%] rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[9px] leading-relaxed text-white/75 backdrop-blur-xl sm:block">
          {instructions || mistakes}
        </div>
      )}
    </div>
  );
};

export default ExerciseVideo;
