import { useCallback, useEffect, useRef } from "react";
import { decodeDualSenseStickInput } from "../../protocol/dualsenseInput";

interface StickDeadzonePreviewProps {
  device: HIDDevice | null;
  leftDeadzonePercent: number;
  rightDeadzonePercent: number;
  leftLabel: string;
  rightLabel: string;
  waitingLabel: string;
  outputLabel: string;
}

interface StickState {
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  received: boolean;
}

export function StickDeadzonePreview({
  device,
  leftDeadzonePercent,
  rightDeadzonePercent,
  leftLabel,
  rightLabel,
  waitingLabel,
  outputLabel,
}: StickDeadzonePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const frameRef = useRef<number | null>(null);
  const stateRef = useRef<StickState>({
    leftX: 128,
    leftY: 128,
    rightX: 128,
    rightY: 128,
    received: false,
  });
  const deadzonesRef = useRef([leftDeadzonePercent, rightDeadzonePercent] as const);
  const labelsRef = useRef({ leftLabel, rightLabel, waitingLabel, outputLabel });

  deadzonesRef.current = [leftDeadzonePercent, rightDeadzonePercent] as const;
  labelsRef.current = { leftLabel, rightLabel, waitingLabel, outputLabel };

  const scheduleDraw = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      drawRef.current?.();
    });
  }, []);

  useEffect(() => {
    scheduleDraw();
  }, [leftDeadzonePercent, rightDeadzonePercent, leftLabel, rightLabel, waitingLabel, outputLabel, scheduleDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let palette = readPalette(canvas);
    const updatePalette = () => {
      palette = readPalette(canvas);
      scheduleDraw();
    };
    const themeObserver = new MutationObserver(updatePalette);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    drawRef.current = () => {
      const scale = Math.max(1, window.devicePixelRatio || 1);
      const cssWidth = Math.max(320, canvas.clientWidth);
      const cssHeight = Math.max(190, canvas.clientHeight);
      const pixelWidth = Math.round(cssWidth * scale);
      const pixelHeight = Math.round(cssHeight * scale);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);

      const state = stateRef.current;
      const labels = labelsRef.current;
      const [leftDeadzone, rightDeadzone] = deadzonesRef.current;
      const halfWidth = cssWidth / 2;
      const radius = Math.max(42, Math.min(70, halfWidth / 2 - 20, cssHeight / 2 - 34));
      const centerY = 30 + radius;

      drawStick(context, halfWidth / 2, centerY, radius, state.leftX, state.leftY, leftDeadzone, labels.leftLabel, state.received, labels.waitingLabel, palette);
      drawStick(context, halfWidth + halfWidth / 2, centerY, radius, state.rightX, state.rightY, rightDeadzone, labels.rightLabel, state.received, labels.waitingLabel, palette);

      context.fillStyle = palette.muted;
      context.font = "600 11px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText(labels.outputLabel, cssWidth / 2, cssHeight - 8);
    };

    const handleInputReport = (event: HIDInputReportEvent) => {
      if (event.device !== device) return;
      const sticks = decodeDualSenseStickInput(event.reportId, event.data);
      if (!sticks) return;
      stateRef.current = {
        ...sticks,
        received: true,
      };
      scheduleDraw();
    };

    stateRef.current = { leftX: 128, leftY: 128, rightX: 128, rightY: 128, received: false };
    device?.addEventListener("inputreport", handleInputReport);
    const resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(canvas);
    scheduleDraw();

    return () => {
      device?.removeEventListener("inputreport", handleInputReport);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      drawRef.current = null;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [device, scheduleDraw]);

  return <canvas ref={canvasRef} className="stick-deadzone-canvas" aria-label={`${leftLabel} / ${rightLabel}`} />;
}

function drawStick(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  x: number,
  y: number,
  deadzonePercent: number,
  label: string,
  received: boolean,
  waitingLabel: string,
  palette: ReturnType<typeof readPalette>,
) {
  context.fillStyle = palette.text;
  context.font = "700 13px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(label, centerX, 16);

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = palette.surface;
  context.fill();
  context.strokeStyle = palette.border;
  context.lineWidth = 1.5;
  context.stroke();

  const deadzoneRadius = radius * deadzonePercent / 100;
  if (deadzoneRadius > 0) {
    context.beginPath();
    context.arc(centerX, centerY, deadzoneRadius, 0, Math.PI * 2);
    context.fillStyle = "rgba(59, 130, 246, 0.18)";
    context.fill();
    context.strokeStyle = palette.primary;
    context.lineWidth = 1.5;
    context.stroke();
  }

  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(centerX - radius, centerY);
  context.lineTo(centerX + radius, centerY);
  context.moveTo(centerX, centerY - radius);
  context.lineTo(centerX, centerY + radius);
  context.stroke();

  const normalizedX = (x - 128) / (x >= 128 ? 127 : 128);
  const normalizedY = (128 - y) / (y <= 128 ? 128 : 127);
  const pointX = centerX + normalizedX * radius;
  const pointY = centerY - normalizedY * radius;
  context.beginPath();
  context.arc(pointX, pointY, 5, 0, Math.PI * 2);
  context.fillStyle = received ? palette.point : palette.muted;
  context.fill();
  context.strokeStyle = palette.surface;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = palette.muted;
  context.font = "600 11px ui-monospace, monospace";
  context.fillText(received ? `${x}, ${y} · ${deadzonePercent}%` : waitingLabel, centerX, centerY + radius + 18);
}

function readPalette(canvas: HTMLCanvasElement) {
  const styles = getComputedStyle(canvas);
  return {
    text: styles.color || "#0f172a",
    muted: styles.getPropertyValue("--muted-foreground").trim() || "#64748b",
    primary: styles.getPropertyValue("--primary").trim() || "#2563eb",
    border: styles.getPropertyValue("--border").trim() || "#94a3b8",
    surface: styles.getPropertyValue("--card").trim() || "#ffffff",
    grid: "rgba(100, 116, 139, 0.32)",
    point: "#06b6d4",
  };
}
