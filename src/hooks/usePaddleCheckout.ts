import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    quantity: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);
      const paddle = window.Paddle;
      if (!paddle) throw new Error("Paddle SDK did not initialize");

      const checkout = {
        items: [{ priceId: paddlePriceId, quantity: options.quantity }],
        ...(options.customerEmail ? { customer: { email: options.customerEmail } } : {}),
        ...(options.customData ? { customData: options.customData } : {}),
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/app?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      } satisfies Parameters<typeof paddle.Checkout.open>[0];
      paddle.Checkout.open(checkout);
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
