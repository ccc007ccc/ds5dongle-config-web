import { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ConfigValidationIssue } from "../../protocol/config";

interface FloatControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  issue?: ConfigValidationIssue;
  onChange: (value: number) => void;
}

export function FloatControl({ label, value, min, max, step, issue, onChange }: FloatControlProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.currentTarget.value);
    if (Number.isFinite(next)) {
      onChange(next);
    }
  };

  const handleSliderChange = ([next]: number[]) => {
    if (Number.isFinite(next)) {
      onChange(next);
    }
  };

  return (
    <label className={`control-row ${issue ? "invalid" : ""}`}>
      <span>
        <strong>{label}</strong>
        {issue && <small>{issue.message}</small>}
      </span>
      <div className="range-inputs">
        <Slider min={min} max={max} step={step} value={[value]} onValueChange={handleSliderChange} />
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value.toFixed(2)}
          onChange={handleChange}
          aria-invalid={Boolean(issue)}
          className="font-bold"
        />
      </div>
    </label>
  );
}
