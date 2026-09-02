import { resolvePaddlePrice } from "@/lib/payments.functions";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"];

type PaddleJs = {
  Environment: {
    set: (environment: "sandbox" | "production") => void;
  };
  Initialize: (options: { token: string }) => void;
  Checkout: {
    open: (options: {
      items: Array<{ priceId: string; quantity: number }>;
      customer?: { email: string };
      customData?: Record<string, string>;
      settings: {
        displayMode: "overlay";
        successUrl: string;
        allowLogout: boolean;
        variant: "one-page";
      };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

// Single source of truth for which Paddle environment the client is in.
// Derived from the token prefix so it stays correct after the build-time
// token swap.
export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;

export async function initializePaddle() {
  if (paddleInitialized) return;

  if (!clientToken) {
    throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      const paddleJsEnvironment = getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      const paddle = window.Paddle;
      if (!paddle) {
        reject(new Error("Paddle SDK did not initialize"));
        return;
      }
      paddle.Environment.set(paddleJsEnvironment);
      paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  return resolvePaddlePrice({ data: { priceId, environment } });
}
