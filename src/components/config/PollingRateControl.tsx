import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POLLING_RATE_OPTIONS, PollingRateMode } from "../../protocol/config";

interface PollingRateControlProps {
  value: PollingRateMode;
  onChange: (value: PollingRateMode) => void;
}

export function PollingRateControl({ value, onChange }: PollingRateControlProps) {
  return (
    <div className="control-row">
      <strong>Polling rate mode</strong>
      <Tabs
        value={String(value)}
        onValueChange={(next) => onChange(Number(next) as PollingRateMode)}
        className="w-full"
      >
        <TabsList className="grid h-10 w-full grid-cols-3">
          {POLLING_RATE_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={String(option.value)} className="h-8 text-sm font-bold">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
