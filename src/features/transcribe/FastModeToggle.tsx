import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";
import { Switch } from "./DiarizationToggle";

export function FastModeToggle(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const on = useTranscribeStore((s) => s.fastMode);
  const set = useTranscribeStore((s) => s.setFastMode);
  const diarization = useTranscribeStore((s) => s.diarization);
  const timestamps = useTranscribeStore((s) => s.timestamps);
  const detailed = diarization || timestamps;
  return (
    <div className="flex flex-col gap-1">
      <Switch
        on={on && !detailed}
        onChange={set}
        disabled={detailed}
        disabledHint={translate(lang, "txFastModeDisabledHint" as never)}
        label={translate(lang, "txFastMode" as never)}
        hint={translate(lang, "txFastModeNote" as never)}
      />
      {detailed ? (
        <p className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          {translate(lang, "txFastModeDisabledHint" as never)}
        </p>
      ) : null}
    </div>
  );
}
