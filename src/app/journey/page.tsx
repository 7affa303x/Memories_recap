"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// CDN URLs for cinematic images
const SCENES = [
  {
    id: "space",
    title: "The Great Descent",
    subtitle: "From Orbit to Earth",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663861386902/pKAYesXpyGDyJhwO.jpg",
    description: "A journey begins from the edge of space...",
  },
  {
    id: "orbit",
    title: "Breaking Through",
    subtitle: "Through the Clouds",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663861386902/YyOmqTBoCjzQEujt.jpg",
    description: "The atmosphere reveals itself in layers of light.",
  },
  {
    id: "clouds",
    title: "Descending",
    subtitle: "Sky to Sea",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663861386902/ClheqEUuOptmmPGb.jpg",
    description: "Clouds part as the turquoise ocean emerges below.",
  },
  {
    id: "beach-landing",
    title: "Arrival",
    subtitle: "Tropical Shore",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663861386902/zVKxuXLYTXfyVzyh.jpg",
    description: "The golden sand welcomes with warmth and light.",
  },
  {
    id: "family",
    title: "Home",
    subtitle: "Together on the Shore",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663861386902/NWgsBSeaJQMnYWoh.jpg",
    description: "Memories made together last forever.",
  },
];

export default function CinematicJourney() {
  const [currentScene, setCurrentScene] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState<Record<number, boolean>>({});
  const [showIntro, setShowIntro] = useState(true);
  const [isPreloaded, setIsPreloaded] = useState(false);

  // Preload all images
  useEffect(() => {
    const preload = () => {
      SCENES.forEach((scene, index) => {
        const img = new Image();
        img.src = scene.image;
        img.onload = () => {
          setImagesLoaded((prev) => ({ ...prev, [index]: true }));
        };
      });
      // Mark preloaded after a short delay
      setTimeout(() => setIsPreloaded(true), 500);
    };
    preload();
  }, []);

  const goToScene = useCallback(
    (index: number) => {
      if (isTransitioning || index === currentScene) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentScene(index);
        setIsTransitioning(false);
      }, 800);
    },
    [isTransitioning, currentScene]
  );

  const nextScene = useCallback(() => {
    const next = (currentScene + 1) % SCENES.length;
    goToScene(next);
  }, [currentScene, goToScene]);

  const prevScene = useCallback(() => {
    const prev = currentScene === 0 ? SCENES.length - 1 : currentScene - 1;
    goToScene(prev);
  }, [currentScene, goToScene]);

  // Auto-advance every 6 seconds (optional)
  useEffect(() => {
    if (showIntro) return;
    const timer = setTimeout(() => {
      if (!isTransitioning) nextScene();
    }, 6000);
    return () => clearTimeout(timer);
  }, [currentScene, showIntro, isTransitioning, nextScene]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") nextScene();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prevScene();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextScene, prevScene]);

  // Intro screen
  if (showIntro) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Animated background */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#1a1a2e_0%,#000000_100%)]"
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Stars */}
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-[2px] h-[2px] bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0.2, 1, 0.2],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-6">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
          >
            <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight mb-4">
              Memories Recap
            </h1>
            <p className="text-lg sm:text-xl text-white/70 mb-2">
              Interactive Cinematic Journey
            </p>
            <p className="text-sm text-white/50 mb-10">
              Phase 1 — Sky to Beach
            </p>
          </motion.div>

          <motion.button
            className="relative px-10 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white font-medium text-lg overflow-hidden"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowIntro(false)}
          >
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
            <span className="relative">Tap to Begin</span>
          </motion.button>

          <motion.p
            className="mt-6 text-xs text-white/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
          >
            Tap anywhere to transition between scenes
          </motion.p>
        </div>
      </motion.div>
    );
  }

  const scene = SCENES[currentScene];

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Main scene with Ken Burns effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScene}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{
            duration: 1.2,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {/* Background image with slow zoom */}
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1 }}
            animate={{ scale: 1.15 }}
            transition={{
              duration: 8,
              ease: "linear",
            }}
          >
            <img
              src={scene.image}
              alt={scene.title}
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Gradient overlays for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
        </motion.div>
      </AnimatePresence>

      {/* Scene info overlay */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`info-${currentScene}`}
          className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-24 pt-20"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
        >
          <motion.div
            className="mb-2"
            initial={{ width: 0 }}
            animate={{ width: "3rem" }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <div className="h-[2px] bg-gradient-to-r from-white/80 to-transparent" />
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {scene.title}
          </h2>
          <p className="text-sm text-white/60 mt-1 uppercase tracking-widest">
            {scene.subtitle}
          </p>
          <p className="text-base text-white/80 mt-3 max-w-sm">
            {scene.description}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Progress indicator */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-12 px-6">
        <div className="flex items-center gap-2">
          {SCENES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToScene(index)}
              className="h-[3px] flex-1 rounded-full transition-all duration-500"
              style={{
                backgroundColor:
                  index === currentScene
                    ? "rgba(255,255,255,0.9)"
                    : index < currentScene
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Navigation arrows (mobile touch areas) */}
      <div
        className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
        onClick={prevScene}
        onPointerDown={() => navigator.vibrate?.(10)}
      />
      <div
        className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer"
        onClick={nextScene}
        onPointerDown={() => navigator.vibrate?.(10)}
      />

      {/* Tap indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 3 }}
      >
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span>Tap right</span>
        </div>
      </motion.div>

      {/* Scene counter */}
      <div className="absolute top-16 right-6 z-20">
        <p className="text-xs text-white/50 font-mono">
          {currentScene + 1}/{SCENES.length}
        </p>
      </div>

      {/* Swipe gesture hint animation */}
      <motion.div
        className="absolute bottom-8 right-6 z-20"
        initial={{ x: 0 }}
        animate={{ x: [0, 10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 4 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </motion.div>

      {/* Transition flash effect */}
      {isTransitioning && (
        <motion.div
          className="absolute inset-0 z-40 bg-white"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      )}
    </div>
  );
}
