import { Power, Usb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeviceStripProps {
  authorizedDevices: HIDDevice[];
  client: unknown | null;
  deviceLabel: string;
  isBusy: boolean;
  supported: boolean;
  onConnect: () => void;
  onConnectAuthorized: (device: HIDDevice) => void;
}

export function DeviceStrip({
  authorizedDevices,
  client,
  deviceLabel,
  isBusy,
  supported,
  onConnect,
  onConnectAuthorized,
}: DeviceStripProps) {
  return (
    <section className="device-strip">
      <div className="device-main">
        <div className="device-icon">
          <Usb size={22} />
        </div>
        <div>
          <div className="label">Device</div>
          <strong>{deviceLabel}</strong>
        </div>
      </div>
      <div className="device-actions">
        {authorizedDevices.length > 0 && !client && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onConnectAuthorized(authorizedDevices[0])}
            disabled={isBusy}
            title="Open the first previously authorized device"
          >
            <Power size={17} />
            Open
          </Button>
        )}
        <Button
          type="button"
          onClick={onConnect}
          disabled={!supported || isBusy}
          title="Choose a DS5 Bridge HID device"
        >
          <Usb size={17} />
          Connect
        </Button>
      </div>
    </section>
  );
}
