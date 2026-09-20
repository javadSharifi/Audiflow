import { useCallback, useEffect, useState } from "react";
import type { WizardStep } from "./WizardStepper";
import { WizardUploadStep } from "./WizardUploadStep";
import { WizardConfigsStep } from "./WizardConfigsStep";
import { WizardProgressStep } from "./WizardProgressStep";
import { WizardResultStep } from "./WizardResultStep";
import { useAppStore } from "../../stores/useAppStore";

import { isFirstRunDone } from "../../utils/bootPrefs";
import { isAndroid } from "../../utils/platform";
import { getVideoPermissionStatus, requestVideoPermissions } from "../../utils/tauri";

function isTerminal(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function ConverterWizard(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const files = useAppStore((s) => s.files);
  const jobs = useAppStore((s) => s.jobs);
  const activeTool = useAppStore((s) => s.activeTool);
  const [step, setStep] = useState<WizardStep>(1);

  // Request video permissions ONLY when user actively enters converter tab and onboarding is complete
  useEffect(() => {
    if (!isAndroid() || activeTool !== "converter" || !isFirstRunDone()) return;
    void getVideoPermissionStatus().then((status) => {
      if (status !== "granted" && status !== "notRequired") {
        requestVideoPermissions();
      }
    });
  }, [activeTool]);

  const busy = Array.from(jobs.values()).some((j) => j.status === "waiting" || j.status === "processing");

  const go = useCallback((n: WizardStep) => {
    setStep(n);
  }, []);

  const handleConvert = useCallback(() => {
    const { files: current, pushToast, startQueue } = useAppStore.getState();
    if (current.filter((f) => !f.error && f.hasAudio).length < current.length) {
      pushToast("warning", "errSomeFilesInvalid");
    }
    go(3);
    void startQueue().catch(() => {
      // Start failed (e.g. validation): let the user fix settings.
      go(2);
    });
  }, [go]);

  const handleRestart = useCallback(() => {
    const { clearFiles, clearFinishedJobs } = useAppStore.getState();
    clearFiles();
    void clearFinishedJobs().catch(() => {});
    go(1);
  }, [go]);

  // Auto-advance: queue settled while watching progress -> result.
  // Inputs clear on arrival so the next run starts clean; job records stay
  // so the result list can render.
  useEffect(() => {
    if (step !== 3 || busy) return;
    const list = Array.from(jobs.values());
    if (list.length > 0 && list.every((j) => isTerminal(j.status))) {
      useAppStore.getState().clearFiles();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional auto-advance to the result step once the queue settles
      go(4);
    }
  }, [step, busy, jobs, go]);

  // Files removed externally while on configs -> back to upload.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional step guard: navigate back when inputs vanish
    if (step === 2 && files.length === 0) go(1);
  }, [step, files.length, go]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 pt-4 md:gap-5 md:px-6 min-h-0 py-5 pb-28">
      <div key={step} className="wizard-step-in">
        {step === 1 && <WizardUploadStep lang={lang} onNext={() => go(2)} />}
        {step === 2 && <WizardConfigsStep lang={lang} onBack={() => go(1)} onConvert={handleConvert} />}
        {step === 3 && <WizardProgressStep lang={lang} />}
        {step === 4 && <WizardResultStep lang={lang} onRestart={handleRestart} />}
      </div>
    </div>
  );
}
