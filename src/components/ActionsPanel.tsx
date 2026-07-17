import { Download, Power, PowerOff, RefreshCw, RotateCcw, Save } from "lucide-react";
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
        </div>
      </CardContent>
    </Card>
  );
}
