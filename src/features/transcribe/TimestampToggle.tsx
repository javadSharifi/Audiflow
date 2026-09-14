import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";
import { Switch } from "./DiarizationToggle";

export function TimestampToggle(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const on = useTranscribeStore((s) => s.timestamps);
  const set = useTranscribeStore((s) => s.setTimestamps);
  return (
    <Switch on={on} onChange={set} label={translate(lang, "txTimestamps" as never)} hint={translate(lang, "txTimestampsHint" as never)} />
  );
}
