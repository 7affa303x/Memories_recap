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

/**
 * Live is Paddle.js default — only pass environment when sandbox.
 * pwCustomer must be a Paddle customer id (ctm_...), never our user id/email.
 */
export function PaddleProvider({
  children,
  paddleCustomerId,
}: {
  children: ReactNode;
  paddleCustomerId?: string | null;
}) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      setReady(true);
      return;
    }

    const isSandbox =
      process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ||
      token.startsWith("test_");

    // Live builds must use live_ tokens; sandbox uses test_.
    if (!isSandbox && !token.startsWith("live_")) {
      console.warn("Paddle client token is not a live_ token; skipping init");
      setReady(true);
      return;
    }
    if (isSandbox && token.startsWith("live_")) {
      console.warn("Sandbox env set but live_ token provided; skipping init");
      setReady(true);
      return;
    }

    let cancelled = false;
    const options: Parameters<typeof initializePaddle>[0] = {
      token,
      pwCustomer:
        paddleCustomerId && paddleCustomerId.startsWith("ctm_")
          ? { id: paddleCustomerId }
          : undefined,
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
    };

    if (isSandbox) {
      options.environment = "sandbox" as Environments;
    }

    initializePaddle(options).then((instance) => {
      if (cancelled) return;
      setPaddle(instance ?? null);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [paddleCustomerId]);

  return (
    <PaddleContext.Provider value={{ paddle, ready }}>
      {children}
    </PaddleContext.Provider>
  );
}
