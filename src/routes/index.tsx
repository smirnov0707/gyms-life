import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Overview } from "@/components/Overview";
import { FutureLabLanding, copy as landingCopy } from "@/components/FutureLabLanding";
import { SHARE_CARD_HEIGHT, SHARE_CARD_URL, SHARE_CARD_WIDTH, SITE_URL } from "@/lib/site";

/**
 * The head is built from the landing copy, not written beside it.
 *
 * It used to say "GYMS.LIFE — Your personal Future Lab" and "Your training.
 * Your Digital Twin. Your next step." — the abstract line the page itself
 * stopped making when the hero was rewritten to name 175 exercises, sets that
 * survive a dead signal, and free-while-in-beta. A shared link, a search result
 * and a chat preview all kept the old claim, and nothing compared the two. This
 * is the same fix as `exerciseLinkLabel` and `exerciseHeadMeta` both reading
 * `getExerciseMedia`: derive the promise from the thing that keeps it.
 */
const hero = landingCopy.en;
const SHARE_TITLE = `${hero.title} ${hero.accent} — GYMS.LIFE`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SHARE_TITLE },
      { name: "description", content: hero.intro },
      { property: "og:title", content: SHARE_TITLE },
      { property: "og:description", content: hero.intro },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: SHARE_CARD_URL },
      { property: "og:image:width", content: String(SHARE_CARD_WIDTH) },
      { property: "og:image:height", content: String(SHARE_CARD_HEIGHT) },
      { property: "og:image:alt", content: `${hero.title} ${hero.accent}` },
      // `summary_large_image` is honest now: the image exists, is 1200x630, and
      // is generated from this page's own words.
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SHARE_CARD_URL },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  return user ? (
    <AppShell>
      <Overview />
    </AppShell>
  ) : (
    <FutureLabLanding />
  );
}
