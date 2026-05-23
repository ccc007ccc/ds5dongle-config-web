import { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ConfigValidationIssue } from "../../protocol/config";

interface VolumeByteControlProps {
  label: string;
  value: number;
  issue?: ConfigValidationIssue;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  valueToSlider?: (value: number) => number;
  sliderToValue?: (value: number) => number;
  inputMin?: number;
  inputMax?: number;
  inputStep?: number;
  inputFractionDigits?: number;
  valueToInput?: (value: number) => number;
  inputToValue?: (value: number) => number;
  onChange: (value: number) => void;
}

export function VolumeByteControl({
  label,
  value,
  issue,
  sliderMin = 0,
  sliderMax = 127,
  sliderStep = 1,
  valueToSlider = (next) => next,
  sliderToValue = (next) => next,
  inputMin = 0,
  inputMax = 127,
  inputStep = 1,
  inputFractionDigits = 0,
  valueToInput = (next) => next,
  inputToValue = (next) => next,
  onChange,
}: VolumeByteControlProps) {
  const { t } = useTranslation();
  const sliderValue = clamp(valueToSlider(value), sliderMin, sliderMax);
  const inputValue = valueToInput(value);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.currentTarget.value);
    if (Number.isFinite(next)) {
      onChange(Math.round(inputToValue(next)));
    }
  };

  const handleSliderChange = ([next]: number[]) => {
    if (Number.isFinite(next)) {
      onChange(Math.round(sliderToValue(next)));
    }
  };

  return (
    <label className={`control-row ${issue ? "invalid" : ""}`}>
      <span>
        <strong>{label}</strong>
        {issue && <small>{t(`validation.${issue.field}`)}</small>}
      </span>
      <div className="range-inputs">
        <Slider
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          value={[sliderValue]}
          onValueChange={handleSliderChange}
        />
        <Input
          type="number"
          min={inputMin}
          max={inputMax}
          step={inputStep}
          value={inputValue.toFixed(inputFractionDigits)}
          onChange={handleChange}
          aria-invalid={Boolean(issue)}
          className="font-bold"
        />
      </div>
    </label>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
