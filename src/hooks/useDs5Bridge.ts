import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ConfigBody,
  ConfigDecodeError,
  DEFAULT_CONFIG,
  ConfigValidationIssue,
  configsEqual,
  normalizeConfig,
  releaseDefaultsForDevice,
  usesElevatedCpuPerformance,
  validateConfig,
} from "../protocol/config";
import {
  Ds5BridgeHidClient,
  NO_DEVICE_SELECTED_ERROR,
  WEBHID_UNAVAILABLE_ERROR,
  getDeviceLabel,
  webHidAvailable,
} from "../protocol/ds5BridgeHid";
import type { AudioActivityState } from "../protocol/ds5BridgeHid";
import type { M61Telemetry } from "../protocol/m61Management";

type Operation = "connecting" | "reading" | "readingFirmware" | "applying" | "saving" | "reconnecting" | "poweringOff" | "pairing" | "disconnectingController" | "forgettingController" | null;
type SaveState = "idle" | "dirty" | "applied" | "saved";
const TELEMETRY_REFRESH_INTERVAL_MS = 5_000;
const USB_RECONNECT_TIMEOUT_MS = 12_000;
const USB_RECONNECT_TIMEOUT_ERROR = "usbReconnectTimedOut";

export interface UseDs5BridgeResult {
  supported: boolean;
  client: Ds5BridgeHidClient | null;
  deviceLabel: string;
  firmwareVersion: string | null;
  signalStrengthRssi: number | null;
  audioActivity: AudioActivityState | null;
  telemetry: M61Telemetry | null;
  authorizedDevices: HIDDevice[];
  config: ConfigBody | null;
  draft: ConfigBody;
  issues: ConfigValidationIssue[];
  saveState: SaveState;
  operation: Operation;
  error: string | null;
  statusText: string;
  isConnected: boolean;
  isDirty: boolean;
  isDefaultConfig: boolean;
  needsUsbReconnect: boolean;
  setDraftField: <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => void;
  refreshAuthorizedDevices: () => Promise<void>;
  connect: () => Promise<void>;
  connectAuthorized: (device: HIDDevice) => Promise<void>;
  readConfig: () => Promise<void>;
  saveToFlash: () => Promise<void>;
  reconnectUsb: () => Promise<void>;
  powerOffController: () => Promise<void>;
  pairController: () => Promise<void>;
  disconnectController: () => Promise<void>;
  forgetController: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  clearError: () => void;
}

export function useDs5Bridge(): UseDs5BridgeResult {
  const { t } = useTranslation();
  const supported = webHidAvailable();
  const [client, setClient] = useState<Ds5BridgeHidClient | null>(null);
  const [authorizedDevices, setAuthorizedDevices] = useState<HIDDevice[]>([]);
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [signalStrengthRssi, setSignalStrengthRssi] = useState<number | null>(null);
  const [audioActivity, setAudioActivity] = useState<AudioActivityState | null>(null);
  const [telemetry, setTelemetry] = useState<M61Telemetry | null>(null);
  const [config, setConfig] = useState<ConfigBody | null>(null);
  const [draft, setDraft] = useState<ConfigBody>(DEFAULT_CONFIG);
  const [operation, setOperation] = useState<Operation>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsUsbReconnect, setNeedsUsbReconnect] = useState(false);
  const clientRef = useRef<Ds5BridgeHidClient | null>(null);
  const configRef = useRef<ConfigBody | null>(null);
  const draftRef = useRef<ConfigBody>(DEFAULT_CONFIG);
  const applyingRef = useRef(false);
  const applyQueuedRef = useRef(false);
  const usbEffectivePollingRateRef = useRef(DEFAULT_CONFIG.usbPollingRateMode);
  const usbReconnectPendingRef = useRef(false);
  const usbReconnectTimeoutRef = useRef<number | null>(null);

  const issues = useMemo(() => validateConfig(draft), [draft]);
  const deviceDefaults = useMemo(
    () => config ? releaseDefaultsForDevice(config) : DEFAULT_CONFIG,
    [config],
  );
  const isConnected = Boolean(client?.device.opened);
  const isDirty = !configsEqual(config, draft);
  const isDefaultConfig = configsEqual(draft, deviceDefaults);
  const deviceLabel = client ? getDeviceLabel(client.device) : t("device.none");

  const statusText = useMemo(() => {
    if (!supported) {
      return t("status.webHidUnavailable");
    }
    if (operation) {
      return operationLabel(operation, t);
    }
    if (!client) {
      return t("status.ready");
    }
    if (isDirty) {
      return t("status.unsaved");
    }
    if (saveState === "applied") {
      return t("status.applied");
    }
    if (saveState === "saved") {
      return t("status.saved");
    }
    return t("status.connected");
  }, [client, isDirty, operation, saveState, supported, t]);

  const refreshAuthorizedDevices = useCallback(async () => {
    if (!supported) {
      setAuthorizedDevices([]);
      return;
    }

    setAuthorizedDevices(await Ds5BridgeHidClient.authorizedDevices());
  }, [supported]);

  const readConfigWithClient = useCallback(async (nextClient: Ds5BridgeHidClient, syncUsbEffectiveConfig = false) => {
    setOperation("reading");
    try {
      const nextConfig = normalizeConfig(await nextClient.readConfig());
      if (clientRef.current !== nextClient) {
        return;
      }
      configRef.current = nextConfig;
      draftRef.current = nextConfig;
      if (syncUsbEffectiveConfig) {
        usbEffectivePollingRateRef.current = nextConfig.usbPollingRateMode;
        setNeedsUsbReconnect(false);
      }
      setConfig(nextConfig);
      setDraft(nextConfig);
      setSaveState("idle");
      setError(null);
    } finally {
      if (clientRef.current === nextClient) {
        setOperation(null);
      }
    }
  }, []);

  const readTelemetryWithClient = useCallback(async (nextClient: Ds5BridgeHidClient) => {
    try {
      const nextTelemetryReport = await nextClient.readTelemetry();
      if (clientRef.current === nextClient) {
        setSignalStrengthRssi(nextTelemetryReport.rssi);
        setAudioActivity(nextTelemetryReport.audioActivity);
        setTelemetry(nextTelemetryReport.telemetry);
      }
    } catch {
      if (clientRef.current === nextClient) {
        setSignalStrengthRssi(null);
        setAudioActivity(null);
        setTelemetry(null);
      }
    }
  }, []);

  const attachClient = useCallback(
    async (nextClient: Ds5BridgeHidClient) => {
      const previousClient = clientRef.current;
      setOperation("connecting");
      try {
        await nextClient.open();
        // A real wired DualSense has the same Sony VID/PID and gamepad
        // collection. Do not expose controls until the device proves that it
        // implements the versioned M61C management protocol.
        const nextConfig = normalizeConfig(await nextClient.readConfig());

        if (previousClient && previousClient.device !== nextClient.device) {
          await previousClient.close();
        }

        clientRef.current = nextClient;
        configRef.current = nextConfig;
        draftRef.current = nextConfig;
        usbEffectivePollingRateRef.current = nextConfig.usbPollingRateMode;
        setClient(nextClient);
        setConfig(nextConfig);
        setDraft(nextConfig);
        setNeedsUsbReconnect(false);
        setSaveState("idle");
        setFirmwareVersion(null);
        setSignalStrengthRssi(null);
        setAudioActivity(null);
        setTelemetry(null);
        setError(null);

        try {
          setOperation("readingFirmware");
          const nextFirmwareVersion = await nextClient.readFirmwareVersion();
          if (clientRef.current === nextClient) {
            setFirmwareVersion(nextFirmwareVersion);
          }
        } catch (cause) {
          if (clientRef.current === nextClient) {
            setFirmwareVersion(null);
            setError(errorMessage(cause, t));
          }
        }
      } catch (cause) {
        if (!previousClient || previousClient.device !== nextClient.device) {
          try {
            await nextClient.close();
          } catch {
            // Preserve the protocol error that explains why connection failed.
          }
        }
        throw cause;
      } finally {
        setOperation(null);
      }
      void readTelemetryWithClient(nextClient);
    },
    [readTelemetryWithClient, t],
  );

  const connect = useCallback(async () => {
    try {
      await attachClient(await Ds5BridgeHidClient.requestDevice());
      await refreshAuthorizedDevices();
    } catch (cause) {
      setError(errorMessage(cause, t));
      setOperation(null);
    }
  }, [attachClient, refreshAuthorizedDevices, t]);

  const connectAuthorized = useCallback(
    async (device: HIDDevice) => {
      try {
        await attachClient(new Ds5BridgeHidClient(device));
      } catch (cause) {
        setError(errorMessage(cause, t));
        setOperation(null);
      }
    },
    [attachClient, t],
  );

  const readConfig = useCallback(async () => {
    if (!client) {
      return;
    }

    try {
      await readConfigWithClient(client);
    } catch (cause) {
      if (clientRef.current === client) {
        setError(errorMessage(cause, t));
        setOperation(null);
      }
    }
  }, [client, readConfigWithClient, t]);

  const applyLatestDraft = useCallback(async (): Promise<boolean> => {
    if (applyingRef.current) {
      applyQueuedRef.current = true;
      return false;
    }

    const operationClient = clientRef.current;
    applyingRef.current = true;
    setOperation("applying");
    try {
      while (true) {
        applyQueuedRef.current = false;

        const nextClient = clientRef.current;
        if (!nextClient) {
          break;
        }

        const nextDraft = normalizeConfig(draftRef.current);
        if (validateConfig(nextDraft).length > 0 || configsEqual(configRef.current, nextDraft)) {
          break;
        }

        await nextClient.applyConfig(nextDraft);
        if (clientRef.current !== nextClient) {
          break;
        }
        configRef.current = nextDraft;
        setConfig(nextDraft);
        setNeedsUsbReconnect(
          nextDraft.usbPollingRateMode !== usbEffectivePollingRateRef.current,
        );
        setSaveState("applied");
        setError(null);

        if (configsEqual(draftRef.current, nextDraft)) {
          draftRef.current = nextDraft;
          setDraft(nextDraft);
        }

        if (!applyQueuedRef.current && configsEqual(configRef.current, draftRef.current)) {
          break;
        }
      }
    } catch (cause) {
      if (clientRef.current === operationClient) {
        setError(errorMessage(cause, t));
      }
      return false;
    } finally {
      applyingRef.current = false;
      if (clientRef.current === operationClient) {
        setOperation(null);
      }
    }

    return true;
  }, [t]);

  const saveToFlash = useCallback(async () => {
    if (!client || isDirty) {
      return;
    }
    const riskyPerformance = draft.microphoneEnabled || usesElevatedCpuPerformance(draft);
    if (riskyPerformance && !window.confirm(t("actions.savePerformanceConfirm"))) return;

    setOperation("saving");
    try {
      await client.saveToFlash();
      if (clientRef.current === client) {
        setSaveState("saved");
        setError(null);
      }
    } catch (cause) {
      if (clientRef.current === client) {
        setError(errorMessage(cause, t));
      }
    } finally {
      if (clientRef.current === client) {
        setOperation(null);
      }
    }
  }, [client, draft, isDirty, t]);

  const reconnectUsb = useCallback(async () => {
    if (!client) {
      return;
    }

    setOperation("reconnecting");
    usbReconnectPendingRef.current = true;
    try {
      await client.reconnectUsb();
      setError(null);
      if (usbReconnectPendingRef.current) {
        usbReconnectTimeoutRef.current = window.setTimeout(() => {
          if (!usbReconnectPendingRef.current) return;
          usbReconnectPendingRef.current = false;
          usbReconnectTimeoutRef.current = null;
          setOperation(null);
          setError(t(`errors.${USB_RECONNECT_TIMEOUT_ERROR}`));
        }, USB_RECONNECT_TIMEOUT_MS);
      }
    } catch (cause) {
      usbReconnectPendingRef.current = false;
      setError(errorMessage(cause, t));
      setOperation(null);
    }
  }, [client, t]);

  const powerOffController = useCallback(async () => {
    if (!client || !window.confirm(t("actions.powerOffConfirm"))) return;
    setOperation("poweringOff");
    try {
      await client.powerOffController();
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      if (clientRef.current === client) {
        setOperation(null);
      }
    }
  }, [client, t]);

  const runControllerCommand = useCallback(async (
    operationName: "pairing" | "disconnectingController" | "forgettingController",
    command: (activeClient: Ds5BridgeHidClient) => Promise<void>,
  ) => {
    if (!client) return;
    setOperation(operationName);
    try {
      await command(client);
      setError(null);
      window.setTimeout(() => void readTelemetryWithClient(client), 500);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      if (clientRef.current === client) {
        setOperation(null);
      }
    }
  }, [client, readTelemetryWithClient, t]);

  const pairController = useCallback(() =>
    runControllerCommand("pairing", (activeClient) => activeClient.pairController()), [runControllerCommand]);

  const disconnectController = useCallback(async () => {
    if (!window.confirm(t("actions.disconnectConfirm"))) return;
    await runControllerCommand("disconnectingController", (activeClient) => activeClient.disconnectController());
  }, [runControllerCommand, t]);

  const forgetController = useCallback(async () => {
    if (!window.confirm(t("actions.forgetConfirm"))) return;
    await runControllerCommand("forgettingController", (activeClient) => activeClient.forgetController());
  }, [runControllerCommand, t]);

  const setDraftField = useCallback(
    <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => {
      if (!clientRef.current?.device.opened) {
        return;
      }
      if (operation !== null && operation !== "applying") {
        return;
      }

      const nextDraft = { ...draftRef.current, [field]: value };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setSaveState("dirty");
      void applyLatestDraft();
    },
    [applyLatestDraft, operation],
  );

  const resetToDefaults = useCallback(async () => {
    const nextClient = clientRef.current;
    const currentConfig = configRef.current;
    if (!nextClient || !currentConfig) {
      return;
    }

    const nextDefaults = releaseDefaultsForDevice(currentConfig);
    draftRef.current = nextDefaults;
    setDraft(nextDefaults);
    setSaveState("dirty");

    const applied = await applyLatestDraft();
    if (!applied || !configsEqual(configRef.current, nextDefaults)) {
      return;
    }

    setOperation("saving");
    try {
      await nextClient.saveToFlash();
      if (clientRef.current === nextClient) {
        setSaveState("saved");
        setError(null);
      }
    } catch (cause) {
      if (clientRef.current === nextClient) {
        setError(errorMessage(cause, t));
      }
    } finally {
      if (clientRef.current === nextClient) {
        setOperation(null);
      }
    }
  }, [applyLatestDraft, t]);

  useEffect(() => {
    void refreshAuthorizedDevices();
  }, [refreshAuthorizedDevices]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void readTelemetryWithClient(client);
    }, TELEMETRY_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [client, readTelemetryWithClient]);

  useEffect(() => {
    if (!navigator.hid) {
      return;
    }

    const handleDisconnect = (event: HIDConnectionEvent) => {
      // Use the authoritative ref so a delayed disconnect event from a
      // previously selected device cannot clear a newly attached client.
      if (clientRef.current?.device === event.device) {
        clientRef.current = null;
        configRef.current = null;
        draftRef.current = DEFAULT_CONFIG;
        usbEffectivePollingRateRef.current = DEFAULT_CONFIG.usbPollingRateMode;
        setClient(null);
        setFirmwareVersion(null);
        setSignalStrengthRssi(null);
        setAudioActivity(null);
        setTelemetry(null);
        setConfig(null);
        setDraft(DEFAULT_CONFIG);
        setNeedsUsbReconnect(false);
        setSaveState("idle");
        if (usbReconnectPendingRef.current) {
          setOperation("reconnecting");
          setError(null);
        } else {
          setOperation(null);
          setError(t("errors.disconnected"));
        }
      }
      void refreshAuthorizedDevices();
    };

    const handleConnect = (event: HIDConnectionEvent) => {
      void refreshAuthorizedDevices();
      if (!usbReconnectPendingRef.current || !Ds5BridgeHidClient.isSupportedDevice(event.device)) {
        return;
      }

      usbReconnectPendingRef.current = false;
      if (usbReconnectTimeoutRef.current !== null) {
        window.clearTimeout(usbReconnectTimeoutRef.current);
        usbReconnectTimeoutRef.current = null;
      }
      void attachClient(new Ds5BridgeHidClient(event.device))
        .then(() => setNeedsUsbReconnect(false))
        .catch((cause) => {
          setOperation(null);
          setError(errorMessage(cause, t));
        });
    };

    navigator.hid.addEventListener("disconnect", handleDisconnect);
    navigator.hid.addEventListener("connect", handleConnect);

    return () => {
      navigator.hid?.removeEventListener("disconnect", handleDisconnect);
      navigator.hid?.removeEventListener("connect", handleConnect);
    };
  }, [attachClient, refreshAuthorizedDevices, t]);

  useEffect(() => () => {
    if (usbReconnectTimeoutRef.current !== null) {
      window.clearTimeout(usbReconnectTimeoutRef.current);
    }
  }, []);

  return {
    supported,
    client,
    deviceLabel,
    firmwareVersion,
    signalStrengthRssi,
    audioActivity,
    telemetry,
    authorizedDevices,
    config,
    draft,
    issues,
    saveState,
    operation,
    error,
    statusText,
    isConnected,
    isDirty,
    isDefaultConfig,
    needsUsbReconnect,
    setDraftField,
    refreshAuthorizedDevices,
    connect,
    connectAuthorized,
    readConfig,
    saveToFlash,
    reconnectUsb,
    powerOffController,
    pairController,
    disconnectController,
    forgetController,
    resetToDefaults,
    clearError: () => setError(null),
  };
}

function operationLabel(operation: Exclude<Operation, null>, t: (key: string) => string): string {
  switch (operation) {
    case "connecting":
      return t("status.connecting");
    case "reading":
      return t("status.reading");
    case "readingFirmware":
      return t("status.readingFirmware");
    case "applying":
      return t("status.applying");
    case "saving":
      return t("status.saving");
    case "reconnecting":
      return t("status.reconnecting");
    case "poweringOff":
      return t("status.poweringOff");
    case "pairing":
      return t("status.pairing");
    case "disconnectingController":
      return t("status.disconnectingController");
    case "forgettingController":
      return t("status.forgettingController");
  }
}

function errorMessage(cause: unknown, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (cause instanceof ConfigDecodeError) {
    if (cause.code === "invalidConfig") {
      const fields = Array.isArray(cause.details.issues) ? cause.details.issues : [];
      const issues = fields.map((field) => t(`validation.${String(field)}`)).join("; ");

      return t("errors.invalidConfig", { issues });
    }

    if (cause.code === "versionMismatch") {
      return t("errors.configVersionMismatch", cause.details);
    }

    return t("errors.invalidBytes", cause.details);
  }

  if (cause instanceof Error) {
    if (cause.message === NO_DEVICE_SELECTED_ERROR) {
      return t("errors.noDeviceSelected");
    }

    if (cause.message === WEBHID_UNAVAILABLE_ERROR) {
      return t("errors.webHidUnavailable");
    }

    return cause.message;
  }

  return t("errors.unexpectedWebHid");
}
