import { Download, Power, RefreshCw, RotateCcw, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UseDs5BridgeResult } from "../hooks/useDs5Bridge";

interface ActionsPanelProps {
  bridge: UseDs5BridgeResult;
  hasIssues: boolean;
  isBusy: boolean;
}

export function ActionsPanel({ bridge, hasIssues, isBusy }: ActionsPanelProps) {
  return (
    <aside className="panel side-panel">
      <div className="panel-title">
        <Download size={18} />
        <h2>Actions</h2>
      </div>

      <div className="action-stack">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={bridge.readConfig}
          disabled={!bridge.client || isBusy}
          title="Read current config from report 0xF7"
        >
          <RefreshCw size={17} />
          Read
        </Button>
        <Button
          type="button"
          className="w-full"
          onClick={bridge.applyConfig}
          disabled={!bridge.client || isBusy || !bridge.isDirty || hasIssues}
          title="Send command 0x01 through report 0xF6"
        >
          <Send size={17} />
          Apply to Device
        </Button>
        <Button
          type="button"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          onClick={bridge.saveToFlash}
          disabled={!bridge.client || isBusy || bridge.isDirty}
          title={bridge.isDirty ? "Apply changes before saving" : "Send command 0x02 through report 0xF6"}
        >
          <Save size={17} />
          Save to Flash
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={bridge.reconnectUsb}
          disabled={!bridge.client || isBusy}
          title="Send command 0x03 through report 0xF6"
        >
          <Power size={17} />
          Reconnect USB
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={bridge.resetDraft}
          disabled={!bridge.config || isBusy || !bridge.isDirty}
          title="Restore the last config read or applied"
        >
          <RotateCcw size={17} />
          Reset Edits
        </Button>
      </div>

      <div className="state-box">
        <div className="label">State</div>
        <strong>{bridge.statusText}</strong>
        {bridge.issues.length > 0 && (
          <ul>
            {bridge.issues.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
