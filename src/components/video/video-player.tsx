"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

import { formatPlaybackTime } from "@/lib/video/utils";
import { cn } from "@/lib/utils";

type PlayerStatus = "loading" | "ready" | "error";

export type VideoTrack = {
  src: string;
  label: string;
  kind?: "subtitles" | "captions";
  srcLang?: string;
  default?: boolean;
};

type VideoPlayerProps = {
  src: string;
  poster?: string | null;
  className?: string;
  tracks?: VideoTrack[];
};

const SEEK_STEP_SECONDS = 5;
const VOLUME_STEP = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function VideoPlayer({ src, poster, className, tracks = [] }: VideoPlayerProps) {
  const t = useTranslations("player");

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof video.textTracks === "undefined") {
      return;
    }
    for (const track of Array.from(video.textTracks)) {
      track.mode = captionsEnabled ? "showing" : "hidden";
    }
  }, [captionsEnabled]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    video.currentTime = clamp(seconds, 0, duration);
  }

  function seekBy(deltaSeconds: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    seekTo(video.currentTime + deltaSeconds);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = !video.muted;
  }

  function changeVolume(nextVolume: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.volume = clamp(nextVolume, 0, 1);
    if (nextVolume > 0 && video.muted) {
      video.muted = false;
    }
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "BUTTON") {
        return;
      }
      switch (event.key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          seekBy(-SEEK_STEP_SECONDS);
          break;
        case "ArrowRight":
          event.preventDefault();
          seekBy(SEEK_STEP_SECONDS);
          break;
        case "ArrowUp":
          event.preventDefault();
          changeVolume((videoRef.current?.volume ?? volume) + VOLUME_STEP);
          break;
        case "ArrowDown":
          event.preventDefault();
          changeVolume((videoRef.current?.volume ?? volume) - VOLUME_STEP);
          break;
        case "m":
        case "M":
          event.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          event.preventDefault();
          void toggleFullscreen();
          break;
      }
  };

  const rangeMax = duration > 0 ? duration : 1;
  const progressValue = duration > 0 ? clamp(currentTime, 0, duration) : 0;
  const hasCaptions = tracks.length > 0;
  const isMuted = muted || volume === 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="group"
      aria-label={t("controls")}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <video
        ref={videoRef}
        key={src}
        className="h-full w-full"
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        onLoadStart={() => {
          setStatus("loading");
          setIsPlaying(false);
          setCurrentTime(0);
          setDuration(0);
        }}
        onPlay={() => {
          setIsPlaying(true);
          setStatus("ready");
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setStatus("loading")}
        onPlaying={() => setStatus("ready")}
        onCanPlay={() => setStatus("ready")}
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) {
            setDuration(event.currentTarget.duration);
          }
          setStatus("ready");
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) {
            setDuration(event.currentTarget.duration);
          }
        }}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
        onError={() => setStatus("error")}
      >
        {tracks.map((track) => (
          <track
            key={`${track.src}-${track.srcLang ?? "default"}`}
            src={track.src}
            label={track.label}
            kind={track.kind ?? "subtitles"}
            srcLang={track.srcLang}
            default={track.default}
          />
        ))}
      </video>

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-black/50">
          <Loader2
            className="size-8 animate-spin text-white motion-reduce:animate-none"
            aria-label={t("loading")}
            role="status"
          />
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/90">
          {t("error")}
        </div>
      )}

      {status !== "error" && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-10">
          <input
            type="range"
            min={0}
            max={rangeMax}
            step={0.1}
            value={progressValue}
            disabled={duration <= 0}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label={t("scrub")}
            className="h-1.5 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
          />

          <div className="mt-1 flex items-center gap-3 text-white">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? t("pause") : t("play")}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
            >
              {isPlaying ? (
                <Pause className="size-5" aria-hidden="true" />
              ) : (
                <Play className="size-5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? t("unmute") : t("mute")}
              aria-pressed={isMuted}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
            >
              {isMuted ? (
                <VolumeX className="size-5" aria-hidden="true" />
              ) : (
                <Volume2 className="size-5" aria-hidden="true" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              aria-label={t("volume")}
              className="h-1.5 w-20 cursor-pointer accent-primary sm:w-24"
            />

            <span className="ml-1 shrink-0 text-xs font-medium tabular-nums">
              <span aria-label={t("timeCurrent")}>{formatPlaybackTime(currentTime)}</span>
              <span className="mx-1 text-white/60">/</span>
              <span aria-label={t("timeDuration")}>{formatPlaybackTime(duration)}</span>
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              {hasCaptions && (
                <button
                  type="button"
                  onClick={() => setCaptionsEnabled((current) => !current)}
                  aria-label={captionsEnabled ? t("captionsOff") : t("captions")}
                  aria-pressed={captionsEnabled}
                  className={cn(
                    "rounded-lg p-1.5 text-sm font-bold uppercase transition-colors hover:bg-white/15",
                    captionsEnabled ? "bg-primary text-primary-foreground" : "text-white",
                  )}
                >
                  CC
                </button>
              )}
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
              >
                {isFullscreen ? (
                  <Minimize className="size-5" aria-hidden="true" />
                ) : (
                  <Maximize className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
