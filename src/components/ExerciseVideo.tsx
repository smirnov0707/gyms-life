import React, { useState, useEffect, useRef } from "react";
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
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isInteractive, setIsInteractive] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Matomumo sekimas telefonams (Intersection Observer)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 2. Kadrų animacijos ciklas
  useEffect(() => {
    if (media.type !== "frames" || !media.frames || media.frames.length <= 1) return;

    const shouldRun = isHovered !== undefined 
      ? isHovered 
      : (autoPlay && (isInViewport || isInteractive));

    if (!shouldRun) {
      setFrameIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % (media.frames?.length || 1));
    }, 850);

    return () => clearInterval(interval);
  }, [media, autoPlay, isHovered, isInViewport, isInteractive]);

  // Pelės judėjimas (Desktop)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  // Liečiamasis valdymas (Mobile)
  const handleTouchStart = () => {
    setIsInteractive(true);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12); // Haptinis paspaudimo atsakas telefone
    }
  };

  const isEccentric = frameIndex === 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsInteractive(true)}
      onMouseLeave={() => {
        setIsInteractive(false);
        setMousePos({ x: 0.5, y: 0.5 });
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={() => setTimeout(() => setIsInteractive(false), 2000)}
      style={{
        transform: isInteractive
          ? `perspective(1000px) rotateX(${(mousePos.y - 0.5) * -10}deg) rotateY(${(mousePos.x - 0.5) * 10}deg) scale3d(1.015, 1.015, 1.015)`
          : "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
        transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={`relative w-full h-full overflow-hidden rounded-xl bg-neutral-950 border border-white/10 shadow-2xl group select-none touch-manipulation ${className}`}
    >
      {/* Medijos atvaizdavimas */}
      {media.type === "video" && media.videoUrl ? (
        <video
          src={media.videoUrl}
          poster={media.posterUrl}
          autoPlay={autoPlay}
          loop
          muted
          playsInline
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : media.type === "frames" && media.frames && media.frames.length > 0 ? (
        <div className="relative w-full h-full">
          <img
            src={media.frames[frameIndex]}
            alt={title || slug}
            className="w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-600">
          <span className="text-xs font-mono">{title || slug}</span>
        </div>
      )}

      {/* Biomechaninis HUD Telemetrijos sluoksnis */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/90 via-black/25 to-transparent flex flex-col justify-between p-3 sm:p-4">
        {/* Viršutinis statusas */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] sm:text-[9px] font-mono tracking-widest text-emerald-300 uppercase">
              AI OPTIMIZED
            </span>
          </div>
          
          <div className="text-[9px] sm:text-[10px] font-mono text-neutral-300 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10">
            {isEccentric ? "ECCENTRIC" : "CONCENTRIC"}
          </div>
        </div>

        {/* Vidurinis tinklelis (Desktop hover arba Mobile touch) */}
        <div className={`transition-opacity duration-300 ${isInteractive ? "opacity-100" : "opacity-0"} absolute inset-0 flex items-center justify-center pointer-events-none`}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-dashed border-emerald-500/30 flex items-center justify-center animate-spin-slow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/10" />
          </div>
          <div className="absolute top-1/2 left-3 sm:left-4 text-[8px] sm:text-[9px] font-mono text-emerald-400 -translate-y-1/2">
            VECT: {isEccentric ? "0.0°" : "+45.0°"}
          </div>
        </div>

        {/* Apatinis pavadinimas ir pozicijos fazė */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-[8px] sm:text-[9px] font-mono text-neutral-400 tracking-wider uppercase">LOAD MATRIX</div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">{title || slug.replace(/-/g, " ").toUpperCase()}</div>
          </div>
          
          <div className="flex items-center shrink-0 bg-black/70 backdrop-blur-md px-2 py-0.5 sm:py-1 rounded-md border border-white/10">
            <span className={`text-[9px] sm:text-[10px] font-mono font-bold ${isEccentric ? "text-neutral-400" : "text-emerald-400"}`}>
              {isEccentric ? "POS 0" : "POS 1"}
            </span>
          </div>
        </div>
      </div>

      {/* Dinaminis šviesos atspindys (tik Desktop pele) */}
      <div
        className="hidden sm:block absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 200px at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.08), transparent 70%)`,
        }}
      />
    </div>
  );
};

export default ExerciseVideo;
