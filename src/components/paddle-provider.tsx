"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  initializePaddle,
  type Paddle,
  type Environments,
} from "@paddle/paddle-js";

type PaddleContextValue = {
  paddle: Paddle | null;
  ready: boolean;
};

const PaddleContext = createContext<PaddleContextValue>({
  paddle: null,
  ready: false,
});

export function usePaddle() {
  return useContext(PaddleContext);
}

export function PaddleProvider({ children }: { children: ReactNode }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      setReady(true);
      return;
    }

    const environment = (
      process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production"
    ) as Environments;

    let cancelled = false;
    initializePaddle({
      token,
      environment,
      checkout: {
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl:
            typeof window !== "undefined"
              ? `${window.location.origin}/billing?checkout=success`
              : undefined,
        },
      },
    }).then((instance) => {
      if (cancelled) return;
      setPaddle(instance ?? null);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PaddleContext.Provider value={{ paddle, ready }}>
      {children}
    </PaddleContext.Provider>
  );
}
