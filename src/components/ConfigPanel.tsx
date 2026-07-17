import type { ChangeEvent, ReactNode } from "react";
import { Cpu, Radio, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UseDs5BridgeResult } from "../hooks/useDs5Bridge";
import { fieldIssue, hasCapability } from "../protocol/config";
import { M61Capability } from "../protocol/m61Management";
import { IntegerControl } from "./config/IntegerControl";
import { ToggleControl } from "./config/ToggleControl";

export function ConfigPanel({ bridge }: { bridge: UseDs5BridgeResult }) {
  const { t } = useTranslation();
  const config = bridge.draft;
  const disconnected = !bridge.isConnected;
  const supports = (capability: number) => hasCapability(config, capability);

  return (
    <Card className="panel config-panel">
      <CardHeader className="p-0">
        <CardTitle className="panel-title">
          <Radio size={18} />
          <h2>{t("config.title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="config-sections p-0">
        <div className="config-column">
          <section className="config-section config-section-featured">
            <SectionHeading icon={<Volume2 size={18} />} title={t("config.sections.audio")} description={t("config.sections.audioDescription")} />
            <ToggleControl
              label={t("config.microphoneEnabled")}
              value={config.microphoneEnabled}
              helpContent={t("config.help.microphoneEnabled")}
              disabled={disconnected || !supports(M61Capability.Microphone)}
              onChange={(value) => bridge.setDraftField("microphoneEnabled", value)}
            />
            <ToggleControl
              label={t("config.speakerEnabled")}
              value={config.speakerEnabled}
              helpContent={t("config.help.speakerEnabled")}
              disabled={disconnected || !supports(M61Capability.SpeakerGate)}
              onChange={(value) => bridge.setDraftField("speakerEnabled", value)}
            />
            <SelectControl
              label={t("config.speakerRoute")}
              value={config.speakerRoute}
              disabled={disconnected || !supports(M61Capability.SpeakerRoute)}
              options={[
                [0, t("config.speakerRoutes.auto")],
                [1, t("config.speakerRoutes.mono")],
                [2, t("config.speakerRoutes.stereo")],
              ]}
              onChange={(value) => bridge.setDraftField("speakerRoute", value as 0 | 1 | 2)}
            />
            <IntegerControl
              label={t("config.hapticsGainQ8")}
              value={config.hapticsGainQ8}
              min={256}
              max={512}
              helpContent={t("config.help.hapticsGainQ8")}
              issue={fieldIssue(bridge.issues, "hapticsGainQ8")}
              disabled={disconnected || !supports(M61Capability.HapticsGain)}
              onChange={(value) => bridge.setDraftField("hapticsGainQ8", value)}
            />
          </section>
        </div>

        <div className="config-column">
          <section className="config-section">
            <SectionHeading icon={<Cpu size={18} />} title={t("config.sections.performance")} description={t("config.sections.performanceDescription")} />
            <SelectControl
              label={t("config.cpuGovernor")}
              value={config.cpuGovernor}
              disabled={disconnected || !supports(M61Capability.Dvfs)}
              options={[[0, t("config.cpuGovernors.manual")], [1, t("config.cpuGovernors.realtime")]]}
              onChange={(value) => bridge.setDraftField("cpuGovernor", value as 0 | 1)}
            />
            <SelectControl
              label={t("config.cpuProfile")}
              value={config.cpuProfile}
              disabled={disconnected || !supports(M61Capability.Dvfs)}
              options={[
                [0, t("config.cpuProfiles.eco")],
                [1, t("config.cpuProfiles.balanced")],
                [2, t("config.cpuProfiles.performance")],
                [3, t("config.cpuProfiles.custom")],
              ]}
              onChange={(value) => bridge.setDraftField("cpuProfile", value as 0 | 1 | 2 | 3)}
            />
            <IntegerControl
              label={t("config.manualCpuMhz")}
              value={config.manualCpuMhz}
              min={320}
              max={400}
              helpContent={t("config.help.manualCpuMhz")}
              issue={fieldIssue(bridge.issues, "manualCpuMhz")}
              disabled={disconnected || !supports(M61Capability.Dvfs) || config.cpuProfile !== 3}
              onChange={(value) => bridge.setDraftField("manualCpuMhz", value)}
            />
          </section>

          <section className="config-section">
            <SectionHeading icon={<Radio size={18} />} title={t("config.sections.device")} description={t("config.sections.deviceDescription")} />
            <ToggleControl
              label={t("config.autoReconnectEnabled")}
              value={config.autoReconnectEnabled}
              helpContent={t("config.help.autoReconnectEnabled")}
              disabled={disconnected || !supports(M61Capability.AutoReconnect)}
              onChange={(value) => bridge.setDraftField("autoReconnectEnabled", value)}
            />
            <ToggleControl
              label={t("config.statusLedEnabled")}
              value={config.statusLedEnabled}
              helpContent={t("config.help.statusLedEnabled")}
              disabled={disconnected || !supports(M61Capability.StatusLed)}
              onChange={(value) => bridge.setDraftField("statusLedEnabled", value)}
            />
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="config-section-heading">
      <span className="config-section-icon">{icon}</span>
      <div><h3>{title}</h3><p>{description}</p></div>
    </div>
  );
}

function SelectControl({ label, value, options, disabled, onChange }: {
  label: string;
  value: number;
  options: Array<[number, string]>;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => onChange(Number(event.currentTarget.value));
  return (
    <label className="control-row" aria-disabled={disabled}>
      <span className="control-label"><strong>{label}</strong></span>
      <select value={value} disabled={disabled} onChange={handleChange}>
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}
