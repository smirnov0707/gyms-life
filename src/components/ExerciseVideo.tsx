import React, { useState, useEffect } from "react";
import { getExerciseMedia } from "../lib/exercise-media";

interface ExerciseVideoProps {
  slug: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  isHovered?: boolean;
}

export const ExerciseVideo: React.FC<ExerciseVideoProps> = ({
  slug,
  title = "",
  className = "",
  autoPlay = true,
  isHovered,
}) => {
  const media = getExerciseMedia(slug);
  const [frameIndex, setFrameIndex] = useState(0);

  // Kadrų animavimo ciklas (0.jpg <-> 1.jpg)
  useEffect(() => {
    if (media.type !== "frames" || !media.frames || media.frames.length <= 1) return;

    // Jei perduotas isHovered, animuojame tik užvedus pelyte, kitaip - visada kai autoPlay=true
    const shouldAnimate = isHovered !== undefined ? isHovered : autoPlay;
    if (!shouldAnimate) {
      setFrameIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % (media.frames?.length || 1));
    }, 900); // 0.9s per kadra - optimalus judesio tempas

    return () => clearInterval(interval);
  }, [media, autoPlay, isHovered]);

  // 1. Realus MP4 vaizdo įrašas
  if (media.type === "video" && media.videoUrl) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <video
          src={media.videoUrl}
          poster={media.posterUrl}
          autoPlay={autoPlay}
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // 2. Ciklinė kadrų demonstracija (Free Exercise DB)
  if (media.type === "frames" && media.frames && media.frames.length > 0) {
    return (
      <div className={`relative w-full h-full overflow-hidden flex items-center justify-center bg-black/30 ${className}`}>
        <img
          src={media.frames[frameIndex]}
          alt={title || slug}
          className="w-full h-full object-cover transition-opacity duration-200"
          loading="lazy"
        />
        {media.frames.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-neutral-300 border border-white/10 pointer-events-none">
            {frameIndex === 0 ? "START" : "END"}
          </div>
        )}
      </div>
    );
  }

  // 3. Fallback
  return (
    <div className={`w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-600 ${className}`}>
      <span className="text-xs font-mono">{title || slug}</span>
    </div>
  );
};

export default ExerciseVideo;
