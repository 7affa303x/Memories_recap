"use client";

import { useEffect, useRef } from "react";

const PLAY_EVENT = "memories-recap:video-play";

type Props = {
  src: string;
  className?: string;
  /** Unique id for this player instance within the page */
  playerId: string;
};

/**
 * Only one RecapVideo plays at a time across the page.
 * Fires a window event on play so siblings pause.
 */
export function RecapVideo({ src, className, playerId }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPlay = () => {
      window.dispatchEvent(
        new CustomEvent(PLAY_EVENT, { detail: { playerId } })
      );
    };

    const onOtherPlay = (event: Event) => {
      const otherId = (event as CustomEvent<{ playerId: string }>).detail
        ?.playerId;
      if (!otherId || otherId === playerId) return;
      if (!el.paused) el.pause();
    };

    el.addEventListener("play", onPlay);
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => {
      el.removeEventListener("play", onPlay);
      window.removeEventListener(PLAY_EVENT, onOtherPlay);
    };
  }, [playerId]);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      controls
      playsInline
      preload="metadata"
    />
  );
}
