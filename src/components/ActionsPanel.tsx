import { Download, FileJson, Power, PowerOff, RefreshCw, RotateCcw, Save, Trash2, Unplug, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UseDs5BridgeResult } from "../hooks/useDs5Bridge";
import { M61Capability } from "../protocol/m61Management";

interface ActionsPanelProps {
  bridge: UseDs5BridgeResult;
  isBusy: boolean;
}

export function ActionsPanel({ bridge, isBusy }: ActionsPanelProps) {
  const { t } = useTranslation();
  const controllerPowerOffSupported = Boolean(
    bridge.config && (bridge.config.capabilities & M61Capability.ControllerPowerOff),
  );

  return (
    <Card className="panel side-panel">
      <CardHeader className="p-0">
        <CardTitle className="panel-title">
          <Download size={18} />
          <h2>{t("actions.title")}</h2>
        </CardTitle>
      </CardHeader>

      <CardContent className="action-stack p-0">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={bridge.readConfig}
          disabled={!bridge.client || isBusy}
          title={t("actions.readTitle")}
        >
          <RefreshCw size={17} />
          {t("actions.read")}
        </Button>
        <Button
          type="button"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          onClick={bridge.saveToFlash}
          disabled={!bridge.client || isBusy || bridge.isDirty}
          title={bridge.isDirty ? t("actions.saveDirtyTitle") : t("actions.saveTitle")}
        >
          <Save size={17} />
          {t("actions.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={bridge.reconnectUsb}
          disabled={!bridge.client || isBusy}
          title={t("actions.reconnectTitle")}
        >
          <Power size={17} />
          {t("actions.reconnect")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={bridge.powerOffController}
          disabled={!bridge.client || isBusy || !controllerPowerOffSupported}
          title={t("actions.powerOffTitle")}
        >
          <PowerOff size={17} />
          {t("actions.powerOff")}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={bridge.pairController} disabled={!bridge.client || isBusy} title={t("actions.pairTitle")}>
          <UserPlus size={17} />{t("actions.pair")}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={bridge.disconnectController} disabled={!bridge.client || isBusy || !bridge.telemetry?.bluetoothConnected} title={t("actions.disconnectTitle")}>
          <Unplug size={17} />{t("actions.disconnect")}
        </Button>
        <Button type="button" variant="destructive" className="w-full" onClick={bridge.forgetController} disabled={!bridge.client || isBusy || !bridge.telemetry?.savedController} title={t("actions.forgetTitle")}>
          <Trash2 size={17} />{t("actions.forget")}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => exportDiagnostics(bridge)} disabled={!bridge.telemetry} title={t("actions.exportDiagnosticsTitle")}>
          <FileJson size={17} />{t("actions.exportDiagnostics")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={bridge.resetToDefaults}
          disabled={!bridge.client || isBusy || bridge.isDefaultConfig}
          title={t("actions.resetTitle")}
        >
          <RotateCcw size={17} />
          {t("actions.reset")}
        </Button>
      </CardContent>

      <CardContent className="p-0">
        <div className="state-box">
          <div className="label">{t("actions.state")}</div>
          <strong>{bridge.statusText}</strong>
          {bridge.issues.length > 0 && (
            <ul>
              {bridge.issues.map((issue) => (
                <li key={issue.field}>{t(`validation.${issue.field}`)}</li>
              ))}
            </ul>
          )}
          {bridge.needsUsbReconnect && <div className="state-warning">{t("actions.reconnectRequired")}</div>}
          {bridge.telemetry && (
            <ul className="diagnostics-list">
              <li>{t("diagnostics.management")}: {bridge.telemetry.managementSequence} / {bridge.telemetry.lastManagementError}</li>
              <li>{t("diagnostics.usbDrops")}: {bridge.telemetry.usbInputDropped}</li>
              <li>{t("diagnostics.hostDrops")}: {bridge.telemetry.hostReportDropped}</li>
              <li>{t("diagnostics.audioDrops")}: {bridge.telemetry.audioIngressDropped + bridge.telemetry.hapticsQueueDropped}</li>
              <li>{t("diagnostics.codecErrors")}: {bridge.telemetry.speakerErrors + bridge.telemetry.microphoneErrors}</li>
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function exportDiagnostics(bridge: UseDs5BridgeResult): void {
  if (!bridge.telemetry) return;
  const payload = JSON.stringify({
    product: "M61 DualSense Dongle",
    exportedAt: new Date().toISOString(),
    firmware: bridge.firmwareVersion,
    config: bridge.config,
    telemetry: bridge.telemetry,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `m61-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
