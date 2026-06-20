import { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ConfigValidationIssue } from "../../protocol/config";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface IntegerControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  helpContent?: string;
  issue?: ConfigValidationIssue;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function IntegerControl({
  label,
  value,
  min,
  max,
  helpContent,
  issue,
  disabled = false,
  onChange,
}: IntegerControlProps) {
  const { t } = useTranslation();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }

    const next = Number(event.currentTarget.value);
    if (Number.isFinite(next)) {
      onChange(Math.round(next));
    }
  };

  const handleSliderChange = ([next]: number[]) => {
    if (disabled) {
      return;
    }

    if (Number.isFinite(next)) {
      onChange(Math.round(next));
    }
  };

  return (
    <div className={`control-row ${issue ? "invalid" : ""}`} aria-disabled={disabled}>
      <div>
        <span className="control-label">
          <strong>{label}</strong>
          {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
        </span>
        {issue && <small>{t(`validation.${issue.field}`)}</small>}
      </div>
      <div className="range-inputs">
        <Slider
          min={min}
          max={max}
          step={1}
          value={[value]}
          disabled={disabled}
          onValueChange={handleSliderChange}
        />
        <Input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={handleChange}
          aria-invalid={Boolean(issue)}
          disabled={disabled}
          className="font-bold"
        />
      </div>
    </div>
  );
}
