import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FutureLabBodyMap } from "../../src/components/future-lab/FutureLabBodyMap";
import "../../src/styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

document.documentElement.classList.add("dark");
document.body.style.background = "#020711";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <main style={{ maxWidth: 1480, margin: "0 auto", padding: 16 }}>
        <p style={{ color: "#64748b", fontSize: 10 }}>TEST FIXTURE — NOT USER DATA</p>
        <FutureLabBodyMap />
      </main>
    </QueryClientProvider>
  </StrictMode>,
);
