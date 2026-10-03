import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n } from "@/lib/i18n";
import { DELETE_ACCOUNT_CONFIRMATION, deleteMyAccount } from "@/lib/delete-account.functions";

/**
 * Leaving, and leaving for good.
 *
 * Neither existed. Nothing in the app called `supabase.auth.signOut` and the
 * auth context did not expose it, so a signed-in athlete could only end a
 * session by clearing site data — on a shared phone or a gym tablet that is a
 * handover, not a sign-out. And the privacy policy promised the right to
 * erasure, in eight languages, against code that had no way to perform it.
 *
 * The copy says what actually happens, including what does not go: billing
 * records are kept because statute requires it, and operational events survive
 * with the person's id set to null rather than being deleted. Promising a
 * cleaner sweep than the database performs would be the same defect one more
 * time.
 */

const COPY = {
  lt: {
    heading: "Paskyra",
    signOutTitle: "Atsijungti šiame įrenginyje",
    signOutBody:
      "Sesija baigiama tik šiame įrenginyje. Įrašai, išsaugoti neprisijungus ir dar neišsiųsti, lieka saugūs ir bus išsiųsti, kai vėl prisijungsi tuo pačiu profiliu.",
    signOut: "Atsijungti",
    signedOut: "Atsijungta.",
    dangerTitle: "Ištrinti paskyrą ir visus duomenis",
    dangerBody:
      "Negrįžtama. Ištrinami treniruočių įrašai, serijos, kūno matavimai, mitybos žurnalai, savijautos įvestys, planai, priminimai, papildai, Twin nuotraukų rinkiniai, sprendimų įrašai ir pati paskyra.",
    kept: "Nelieka ištrinta tik tai, ko neleidžia ištrinti įstatymas: mokėjimų ir sąskaitų įrašai, kuriuos saugo Paddle, bei techniniai veiklos įvykiai — jiems tavo identifikatorius pakeičiamas į tuščią, tad jie nebenurodo tavęs.",
    confirmLabel: `Įrašyk ${DELETE_ACCOUNT_CONFIRMATION}, kad patvirtintum`,
    delete: "Ištrinti paskyrą",
    deleting: "Trinama…",
    deleted: "Paskyra ir duomenys ištrinti.",
    failed: "Nepavyko ištrinti paskyros. Niekas nebuvo ištrinta — bandyk dar kartą.",
  },
  en: {
    heading: "Account",
    signOutTitle: "Sign out on this device",
    signOutBody:
      "Ends the session on this device only. Sets saved offline and not yet sent stay safe, and go out when you sign in again with the same profile.",
    signOut: "Sign out",
    signedOut: "Signed out.",
    dangerTitle: "Delete the account and all data",
    dangerBody:
      "This cannot be undone. It deletes workout sessions, sets, body measurements, nutrition logs, check-ins, plans, reminders, supplements, Twin photo sets, decision records and the account itself.",
    kept: "The only things kept are the ones the law does not allow us to delete: payment and invoice records held by Paddle, and technical operational events — your identifier on those is set to empty, so they no longer name you.",
    confirmLabel: `Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm`,
    delete: "Delete account",
    deleting: "Deleting…",
    deleted: "The account and its data are deleted.",
    failed: "The account could not be deleted. Nothing was removed — try again.",
  },
} as const;

export function AccountControls() {
  const { lang } = useI18n();
  const copy = COPY[baseLang(lang)];
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const erase = useServerFn(deleteMyAccount);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"none" | "signing_out" | "deleting">("none");

  const confirmed = typed.trim() === DELETE_ACCOUNT_CONFIRMATION;

  const leave = async () => {
    setBusy("signing_out");
    await signOut();
    toast.success(copy.signedOut);
    await navigate({ to: "/auth" });
  };

  const destroy = async () => {
    if (!confirmed || busy !== "none") return;
    setBusy("deleting");
    try {
      const result = await erase({ data: { confirmation: DELETE_ACCOUNT_CONFIRMATION } });
      if (result.status !== "deleted") {
        toast.error(copy.failed);
        setBusy("none");
        return;
      }
      // The session belongs to a user that no longer exists; clearing it here
      // means the next screen is the public one rather than a shell querying
      // for rows that are gone.
      await signOut();
      toast.success(copy.deleted);
      await navigate({ to: "/" });
    } catch {
      toast.error(copy.failed);
      setBusy("none");
    }
  };

  return (
    <section className="fl-workspace-panel grid gap-6 p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {copy.heading}
      </h2>

      <div className="grid gap-2">
        <h3 className="text-base font-semibold text-foreground">{copy.signOutTitle}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{copy.signOutBody}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void leave()}
          disabled={busy !== "none"}
          className="mt-1 min-h-11 w-full justify-center rounded-2xl font-semibold sm:w-auto sm:px-6"
        >
          {busy === "signing_out" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 size-4" />
          )}
          {copy.signOut}
        </Button>
      </div>

      <div className="grid gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <h3 className="flex items-start gap-2 text-base font-semibold text-foreground">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          {copy.dangerTitle}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{copy.dangerBody}</p>
        <p className="text-xs leading-5 text-muted-foreground">{copy.kept}</p>
        <label className="mt-2 grid gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {copy.confirmLabel}
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 max-w-56 font-mono tracking-normal"
          />
        </label>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void destroy()}
          disabled={!confirmed || busy !== "none"}
          className="mt-1 min-h-11 w-full justify-center rounded-2xl font-semibold sm:w-auto sm:px-6"
        >
          {busy === "deleting" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {busy === "deleting" ? copy.deleting : copy.delete}
        </Button>
      </div>
    </section>
  );
}

export default AccountControls;
