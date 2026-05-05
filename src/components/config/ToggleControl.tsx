import { Switch } from "@/components/ui/switch";

interface ToggleControlProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleControl({ label, value, onChange }: ToggleControlProps) {
  return (
    <div className="control-row toggle-row">
      <strong>{label}</strong>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        className="justify-self-end"
        title={value ? "Enabled" : "Disabled"}
      />
    </div>
  );
}
