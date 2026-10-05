import { useEffect, useRef, useState } from "react";
import { getExerciseMedia } from "@/lib/exercise-media";

export function WorkoutMotionPreview({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const media = getExerciseMedia(slug);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || media.type !== "video") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (active && !reduced && finePointer) void video.play().catch(() => {});
    else video.pause();
  }, [active, media.type]);

  if (!media.isAvailable) return null;

  return (
    <div
      className="fl-workout-motion-preview"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      tabIndex={0}
      aria-label={title}
    >
      {media.type === "video" && media.videoUrl ? (
        <video
          ref={videoRef}
          src={media.videoUrl}
          poster={media.posterUrl}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      ) : media.posterUrl ? (
        <img src={media.posterUrl} alt="" loading="lazy" aria-hidden="true" />
      ) : null}
      <span aria-hidden="true" className="fl-workout-motion-preview-shade" />
      <span className="fl-workout-motion-preview-label">{title}</span>
    </div>
  );
}
