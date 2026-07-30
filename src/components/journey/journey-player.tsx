"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { JOURNEY_HUB, JOURNEY_SCENES, type JourneyScene } from "@/lib/journey-scenes";

type Phase = "scenes" | "hub" | "done";

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(18);
  }
}

function SceneMedia({
  scene,
  active,
  prefetch,
}: {
  scene: JourneyScene;
  active: boolean;
  prefetch?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !scene.video) return;
    if (active) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [active, scene.video]);

  if (scene.video) {
    return (
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={scene.video}
        poster={scene.poster}
        muted
        playsInline
        loop
        preload={active || prefetch ? "auto" : "metadata"}
        aria-hidden={!active}
      />
    );
  }

  return (
    <motion.img
      src={scene.poster}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      animate={
        active
          ? { scale: [1, 1.08], x: ["0%", "-1%"], y: ["0%", "-1.5%"] }
          : { scale: 1 }
      }
      transition={{ duration: 12, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
    />
  );
}

export function JourneyPlayer({
  continueHref = "/upload",
  brandName = "Memories Recap",
}: {
  continueHref?: string;
  brandName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("scenes");
  const [transitioning, setTransitioning] = useState(false);
  const lockRef = useRef(false);

  const scene = JOURNEY_SCENES[index];
  const nextScene = JOURNEY_SCENES[Math.min(index + 1, JOURNEY_SCENES.length - 1)];

  const goNext = useCallback(() => {
    if (lockRef.current || transitioning) return;
    lockRef.current = true;
    haptic();
    setTransitioning(true);

    window.setTimeout(() => {
      if (phase === "scenes") {
        if (index >= JOURNEY_SCENES.length - 1) {
          setPhase("hub");
        } else {
          setIndex((v) => v + 1);
        }
      }
      setTransitioning(false);
      lockRef.current = false;
    }, 420);
  }, [index, phase, transitioning]);

  const jumpTo = useCallback((i: number) => {
    haptic();
    setPhase("scenes");
    setIndex(i);
  }, []);

  const skip = useCallback(() => {
    haptic();
    setPhase("hub");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        if (phase === "scenes") goNext();
      }
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, phase, skip]);

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-black text-white select-none"
      style={{ touchAction: "manipulation" }}
    >
      <AnimatePresence mode="wait">
        {phase === "scenes" && scene ? (
          <motion.button
            key={scene.id}
            type="button"
            className="absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left"
            onClick={goNext}
            initial={{ opacity: 0, filter: "blur(18px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(22px)", scale: 1.04 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            aria-label={`${scene.title}. ${scene.hint}`}
          >
            <div
              className="absolute inset-0"
              style={{ background: scene.atmosphere }}
              aria-hidden
            />
            <SceneMedia scene={scene} active={!transitioning} prefetch />
            {nextScene && nextScene.id !== scene.id ? (
              <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
                <SceneMedia scene={nextScene} active={false} prefetch />
              </div>
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/35" />

            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <span className="font-display text-sm font-semibold tracking-wide text-white/90">
                {brandName}
              </span>
              <span
                role="button"
                tabIndex={0}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-md"
                onClick={(e) => {
                  e.stopPropagation();
                  skip();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    skip();
                  }
                }}
              >
                Skip intro
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                Scene {index + 1} / {JOURNEY_SCENES.length}
              </p>
              <h1 className="font-display mt-2 text-[34px] font-semibold leading-[1.05] tracking-tight">
                {scene.title}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
                {scene.subtitle}
              </p>
              <motion.p
                className="mt-8 text-center text-sm font-medium"
                style={{ color: scene.accent }}
                animate={{ opacity: [0.45, 1, 0.45], y: [0, -4, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                {scene.hint}
              </motion.p>
            </div>
          </motion.button>
        ) : null}

        {phase === "hub" ? (
          <motion.div
            key="hub"
            className="absolute inset-0 flex flex-col bg-[radial-gradient(900px_500px_at_50%_-10%,#1a3d2e,transparent),linear-gradient(180deg,#07140f_0%,#020805_100%)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-emerald-100/90">
                {brandName}
              </span>
              <a
                href={continueHref}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-md"
              >
                Enter app
              </a>
            </div>

            <div className="mt-10">
              <h2 className="font-display text-[34px] font-semibold leading-tight tracking-tight text-emerald-50">
                {JOURNEY_HUB.title}
              </h2>
              <p className="mt-3 text-sm text-emerald-100/65">{JOURNEY_HUB.subtitle}</p>
            </div>

            <div className="mt-8 grid flex-1 grid-cols-2 gap-3 content-start">
              {JOURNEY_SCENES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpTo(i)}
                  className="group relative aspect-[3/4] overflow-hidden rounded-[20px] border border-white/10 text-left"
                >
                  <img
                    src={s.poster}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-active:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute bottom-3 left-3 right-3 font-display text-base font-semibold leading-tight">
                    {s.title}
                  </span>
                </button>
              ))}
            </div>

            <a
              href={continueHref}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[16px] bg-emerald-600 text-base font-semibold text-white"
              onClick={() => setPhase("done")}
            >
              Continue to {brandName}
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {transitioning ? (
        <div className="pointer-events-none absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
      ) : null}
    </div>
  );
}
