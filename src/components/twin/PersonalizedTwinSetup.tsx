import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { buildPersonalizedTwinPreparation } from "@/lib/personalized-twin.engine";
import { buildPersonalizedTwinCaptureFlow } from "@/lib/personalized-twin.capture-flow";
import {
  derivePersonalizedTwinUiPhase,
  type PersonalizedTwinLifecycleSnapshot,
} from "@/lib/personalized-twin.presentation";
import { PersonalizedTwinStatus } from "@/components/twin/PersonalizedTwinStatus";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import {
  deletePersonalizedTwinAction,
  getPersonalizedTwinLifecycle,
  retryPersonalizedTwinAction,
} from "@/lib/personalized-twin.lifecycle.functions";
import { GuidedTwinScanPreview } from "@/components/twin/GuidedTwinScanPreview";
import type { PersonalizedTwinProviderCapability } from "@/lib/personalized-twin.provider";
import {
  PERSONALIZED_TWIN_REQUIRED_ANGLES,
  type PersonalizedTwinAngle,
} from "@/lib/personalized-twin.schema";

const LABELS = {
  lt: {
    eyebrow: "PERSONALIZUOTAS TWIN",
    title: "Sukurti mano kūno avatarą",
    intro:
      "Pridėk tris savo kūno nuotraukas. Jos šiame etape lieka tik šiame įrenginyje ir nėra įkeliamos į serverį.",
    front: "Priekis",
    side: "Šonas",
    back: "Nugara",
    add: "Pridėti nuotrauką",
    replace: "Pakeisti",
    consent:
      "Suprantu, kad tai bus vizualinis avataras, o ne medicininis skenavimas ar tikslus anatomijos atkūrimas.",
    missing: "Trūksta kampų",
    readyLocal: "Nuotraukų rinkinys paruoštas.",
    providerMissing:
      "3D rekonstrukcijos paslauga dar neprijungta, todėl nuotraukos niekur nesiunčiamos ir avataras dar negeneruojamas.",
    privacy: "Nuotraukos nepersistinamos ir nepalieka šio puslapio.",
    differentCapture:
      "Dabartinis 3 nuotraukų režimas yra lokalus prototipas. Vertinamas 3D provideris naudoja vedamą vaizdo skenavimą, todėl šios nuotraukos jam nebus siunčiamos.",
    open: "Personalizuoti Twin",
    close: "Uždaryti nustatymą",
    remove: "Pašalinti",
    retry: "Bandyti iš naujo",
    deleteTwin: "Ištrinti mano Personalized Twin",
    processingDelete:
      "Kol vyksta išorinis apdorojimas, trynimas užrakintas iki provider cancel/delete patvirtinimo.",
    actionFailed: "Veiksmo atlikti nepavyko.",
  },
  en: {
    eyebrow: "PERSONALIZED TWIN",
    title: "Create my body avatar",
    intro:
      "Add three body photos. At this stage they remain only on this device and are not uploaded to a server.",
    front: "Front",
    side: "Side",
    back: "Back",
    add: "Add photo",
    replace: "Replace",
    consent:
      "I understand this will be a visual avatar, not a medical scan or exact anatomical reconstruction.",
    missing: "Missing views",
    readyLocal: "Photo set is ready.",
    providerMissing:
      "A 3D reconstruction provider is not connected yet, so the photos are not sent anywhere and no avatar is generated yet.",
    privacy: "Photos are not persisted and do not leave this page.",
    differentCapture:
      "The current three-photo mode is a local prototype. The provider under review uses guided video capture, so these photos will not be submitted to it.",
    open: "Personalize Twin",
    close: "Close setup",
    remove: "Remove",
    retry: "Try again",
    deleteTwin: "Delete my Personalized Twin",
    processingDelete:
      "Deletion is locked while external processing is active until provider cancel/delete is approved.",
    actionFailed: "The action could not be completed.",
  },
} as const;

type ShotMap = Partial<Record<PersonalizedTwinAngle, string>>;

export function PersonalizedTwinSetup({
  language,
  capability,
}: {
  language: "lt" | "en";
  capability: PersonalizedTwinProviderCapability | null;
}) {
  const copy = LABELS[language];
  const [shots, setShots] = useState<ShotMap>({});
  const [consent, setConsent] = useState(false);
  const [open, setOpen] = useState(false);
  const [lifecycle, setLifecycle] = useState<PersonalizedTwinLifecycleSnapshot | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const loadLifecycleFn = useServerFn(getPersonalizedTwinLifecycle);
  const deleteTwinFn = useServerFn(deletePersonalizedTwinAction);
  const retryTwinFn = useServerFn(retryPersonalizedTwinAction);
  const captureFlow = useMemo(() => buildPersonalizedTwinCaptureFlow(capability), [capability]);

  const loadLifecycle = useCallback(async () => {
    try {
      setLifecycle(await loadLifecycleFn({}));
    } catch {
      // Keep the local, privacy-safe capture UI usable if server status is temporarily unavailable.
    }
  }, [loadLifecycleFn]);

  useEffect(() => {
    void loadLifecycle();
  }, [loadLifecycle]);

  useEffect(() => {
    if (lifecycle?.status !== "processing") return;
    const timer = window.setInterval(() => void loadLifecycle(), 5_000);
    return () => window.clearInterval(timer);
  }, [lifecycle?.status, loadLifecycle]);

  const state = useMemo(
    () =>
      buildPersonalizedTwinPreparation({
        capturedAngles: PERSONALIZED_TWIN_REQUIRED_ANGLES.filter((angle) => Boolean(shots[angle])),
        consentGranted: consent,
        providerAvailable: captureFlow.currentUiCanSubmit,
      }),
    [shots, consent, captureFlow.currentUiCanSubmit],
  );
  const uiPhase = useMemo(
    () =>
      derivePersonalizedTwinUiPhase({
        localComplete: state.missingAngles.length === 0,
        consentGranted: consent,
        capability,
        lifecycleStatus: lifecycle?.status ?? null,
      }),
    [state.missingAngles.length, consent, capability, lifecycle?.status],
  );

  const setPhoto = (angle: PersonalizedTwinAngle, file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setShots((current) => ({ ...current, [angle]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <section
      className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"
      data-personalized-twin-setup
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <UserRound aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {copy.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">{copy.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">{copy.intro}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            {open ? copy.close : copy.open}
            <ChevronDown
              aria-hidden="true"
              className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
        </div>
      </button>

      {open ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PERSONALIZED_TWIN_REQUIRED_ANGLES.map((angle) => {
              const value = shots[angle];
              const label = copy[angle];
              return (
                <label
                  key={angle}
                  className="group relative min-h-36 overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                >
                  {value ? (
                    <>
                      <img
                        src={value}
                        alt={label}
                        className="absolute inset-0 size-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`${copy.remove}: ${label}`}
                        onClick={(event) => {
                          event.preventDefault();
                          setShots((current) => {
                            const next = { ...current };
                            delete next[angle];
                            return next;
                          });
                        }}
                        className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/70 text-white backdrop-blur"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    </>
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-neutral-500">
                      <Camera aria-hidden="true" className="size-7" />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/70 px-3 py-2 text-xs text-white backdrop-blur">
                    <span className="font-semibold">{label}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-300">
                      <Upload aria-hidden="true" className="size-3.5" />{" "}
                      {value ? copy.replace : copy.add}
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={`${copy.add}: ${label}`}
                    onChange={(event) => {
                      setPhoto(angle, event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              );
            })}
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-neutral-300">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 size-4 accent-violet-500"
            />
            <span>{copy.consent}</span>
          </label>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed">
            {state.missingAngles.length > 0 ? (
              <p className="text-neutral-300">
                {copy.missing}: {state.missingAngles.map((angle) => copy[angle]).join(", ")}.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 aria-hidden="true" className="size-4" /> {copy.readyLocal}
              </p>
            )}
            {captureFlow.requiresDifferentCapture ? (
              <p className="mt-2 text-neutral-400">{copy.differentCapture}</p>
            ) : state.status === "provider_unavailable" ? (
              <p className="mt-2 text-neutral-400">{copy.providerMissing}</p>
            ) : null}
            {captureFlow.requiresDifferentCapture ? (
              <GuidedTwinScanPreview language={language} capability={capability} />
            ) : null}
            <PersonalizedTwinStatus language={language} phase={uiPhase} />
            {lifecycle ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {lifecycle.status === "failed" ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={async () => {
                      setActionBusy(true);
                      try {
                        await retryTwinFn({ data: { captureSetId: lifecycle.captureSetId } });
                        setLifecycle(null);
                        setShots({});
                        setConsent(false);
                        toast.success(copy.retry);
                      } catch (error) {
                        toast.error(errorMessage(error, copy.actionFailed));
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {actionBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    {copy.retry}
                  </button>
                ) : null}
                {lifecycle.status !== "processing" ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={async () => {
                      setActionBusy(true);
                      try {
                        await deleteTwinFn({ data: { captureSetId: lifecycle.captureSetId } });
                        setLifecycle(null);
                        setShots({});
                        setConsent(false);
                        toast.success(copy.deleteTwin);
                      } catch (error) {
                        toast.error(errorMessage(error, copy.actionFailed));
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2 text-[11px] font-semibold text-red-200 disabled:opacity-50"
                  >
                    {actionBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {copy.deleteTwin}
                  </button>
                ) : (
                  <p className="w-full text-[11px] leading-relaxed text-amber-200/80">
                    {copy.processingDelete}
                  </p>
                )}
              </div>
            ) : null}
            <p className="mt-2 flex items-center gap-2 text-neutral-500">
              <ShieldCheck aria-hidden="true" className="size-4" /> {copy.privacy}
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
