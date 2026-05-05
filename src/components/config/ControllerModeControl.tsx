import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONTROLLER_MODE_OPTIONS, ControllerMode } from "../../protocol/config";

interface ControllerModeControlProps {
  value: ControllerMode;
  onChange: (value: ControllerMode) => void;
}

export function ControllerModeControl({ value, onChange }: ControllerModeControlProps) {
  return (
    <div className="control-row">
      <strong>Controller mode</strong>
      <Tabs
        value={String(value)}
        onValueChange={(next) => onChange(Number(next) as ControllerMode)}
        className="w-full"
      >
        <TabsList className="grid h-10 w-full grid-cols-2">
          {CONTROLLER_MODE_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={String(option.value)} className="h-8 text-sm font-bold">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
