import React, { useState, useEffect } from "react";
import { AppSettings, IspVerifyResult } from "../types/config";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Timer,
  Save,
  ArrowRight,
} from "lucide-react";

interface VerifyTabProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export const VerifyTab: React.FC<VerifyTabProps> = ({ settings, onSaveSettings }) => {
  const [selectedIsp, setSelectedIsp] = useState<"slt" | "dialog">(settings.defaultIsp || "slt");

  const [sltCredentials, setSltCredentials] = useState(settings.slt);
  const [dialogCredentials, setDialogCredentials] = useState(settings.dialog);
  const [isSaved, setIsSaved] = useState(false);

  // Verification Step state
  const [step, setStep] = useState<"idle" | "measuring_before" | "waiting" | "measuring_after" | "result">("idle");
  const [beforeResult, setBeforeResult] = useState<IspVerifyResult | null>(null);
  const [afterResult, setAfterResult] = useState<IspVerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cooldown countdown timer
  const [cooldownRemaining, setCooldownRemaining] = useState(120);

  useEffect(() => {
    setSltCredentials(settings.slt);
    setDialogCredentials(settings.dialog);
  }, [settings]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "waiting" && cooldownRemaining > 0) {
      interval = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, cooldownRemaining]);

  const handleSaveCredentials = async () => {
    const updated: AppSettings = {
      ...settings,
      defaultIsp: selectedIsp,
      slt: sltCredentials,
      dialog: dialogCredentials,
    };
    await onSaveSettings(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const queryIsp = async (): Promise<IspVerifyResult> => {
    if (selectedIsp === "slt") {
      return await invoke<IspVerifyResult>("verify_isp_slt", {
        creds: {
          subscriberId: sltCredentials.subscriberId.trim(),
          token: sltCredentials.token.trim(),
          clientId: (sltCredentials.clientId || "").trim(),
        },
      });
    } else {
      return await invoke<IspVerifyResult>("verify_isp_dialog", {
        creds: {
          msisdn: dialogCredentials.msisdn.trim(),
          uuid: dialogCredentials.uuid.trim(),
          cookie: dialogCredentials.cookie.trim(),
          selectedUsageTypeIndex: dialogCredentials.selectedUsageTypeIndex || 0,
        },
      });
    }
  };

  const handleStartVerification = async () => {
    setErrorMsg(null);
    setStep("measuring_before");
    try {
      const res = await queryIsp();
      if (res.error) {
        setErrorMsg(res.error || "Failed to query ISP usage.");
        setStep("idle");
        return;
      }
      setBeforeResult(res);
      setCooldownRemaining(120);
      setStep("waiting");
    } catch (err) {
      setErrorMsg((err as Error).message || "Verification request failed.");
      setStep("idle");
    }
  };

  const handleMeasureAfter = async () => {
    setErrorMsg(null);
    setStep("measuring_after");
    try {
      const res = await queryIsp();
      if (res.error) {
        setErrorMsg(res.error || "Failed to query ISP usage.");
        setStep("waiting");
        return;
      }
      setAfterResult(res);
      setStep("result");
    } catch (err) {
      setErrorMsg((err as Error).message || "Verification request failed.");
      setStep("waiting");
    }
  };

  const handleReset = () => {
    setStep("idle");
    setBeforeResult(null);
    setAfterResult(null);
    setErrorMsg(null);
    setCooldownRemaining(120);
  };

  const hasCredentials =
    selectedIsp === "slt"
      ? !!(sltCredentials.subscriberId && sltCredentials.token)
      : !!(dialogCredentials.msisdn && dialogCredentials.cookie);

  return (
    <div className="flex-1 flex flex-col p-3.5 overflow-y-auto space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
          Verify Quota Isolation
        </h2>

        {/* ISP Selector Toggle */}
        <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setSelectedIsp("slt")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              selectedIsp === "slt"
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            SLT
          </button>
          <button
            onClick={() => setSelectedIsp("dialog")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              selectedIsp === "dialog"
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Dialog
          </button>
        </div>
      </div>

      {/* Credentials Card */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
        {selectedIsp === "slt" ? (
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Subscriber ID
              </label>
              <input
                type="text"
                value={sltCredentials.subscriberId}
                onChange={(e) =>
                  setSltCredentials({ ...sltCredentials, subscriberId: e.target.value })
                }
                placeholder="e.g. 0112345678"
                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Authorization Token (JWT)
              </label>
              <input
                type="password"
                value={sltCredentials.token}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text.includes("x-ibm-client-id:") || text.includes("\n") || text.toLowerCase().includes("authorization:")) {
                    e.preventDefault();
                    let parsedToken = "";
                    let parsedClientId = sltCredentials.clientId;
                    for (const line of text.split("\n")) {
                      const lineTrim = line.trim();
                      if (lineTrim.toLowerCase().startsWith("authorization:")) {
                        parsedToken = lineTrim.substring(14).trim().replace(/^bearer\s+/i, "");
                      } else if (lineTrim.toLowerCase().startsWith("x-ibm-client-id:")) {
                        parsedClientId = lineTrim.substring(16).trim();
                      } else if (!lineTrim.includes(":") && lineTrim.length > 20 && !lineTrim.startsWith("http")) {
                        parsedToken = lineTrim.replace(/^bearer\s+/i, "");
                      }
                    }
                    if (!parsedToken) {
                      parsedToken = text.trim().replace(/^bearer\s+/i, "");
                    }
                    setSltCredentials({
                      ...sltCredentials,
                      token: parsedToken,
                      clientId: parsedClientId || "b7402e9d66808f762ccedbe42c20668e",
                    });
                  }
                }}
                onChange={(e) => {
                  let val = e.target.value.trim();
                  if (val.toLowerCase().startsWith("bearer ")) {
                    val = val.substring(7).trim();
                  }
                  setSltCredentials({ ...sltCredentials, token: val });
                }}
                placeholder="Paste token or header block"
                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                MSISDN / Account
              </label>
              <input
                type="text"
                value={dialogCredentials.msisdn}
                onChange={(e) =>
                  setDialogCredentials({ ...dialogCredentials, msisdn: e.target.value })
                }
                placeholder="e.g. 771234567"
                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Session Cookie
              </label>
              <input
                type="password"
                value={dialogCredentials.cookie}
                onChange={(e) =>
                  setDialogCredentials({ ...dialogCredentials, cookie: e.target.value })
                }
                placeholder="JSESSIONID=..."
                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <button
            onClick={handleSaveCredentials}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-zinc-700"
          >
            <Save className="w-3 h-3" />
            {isSaved ? "Saved" : "Save Credentials"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-200 flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{errorMsg}</span>
        </div>
      )}

      {/* Wizard Steps Box */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-3">
        {/* Step Indicator */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 border-b border-zinc-800/80 pb-2">
          <span className={step === "idle" || step === "measuring_before" ? "text-white" : "text-zinc-600"}>
            1. Baseline
          </span>
          <ArrowRight className="w-3 h-3 text-zinc-600" />
          <span className={step === "waiting" ? "text-white" : "text-zinc-600"}>
            2. Test Traffic
          </span>
          <ArrowRight className="w-3 h-3 text-zinc-600" />
          <span className={step === "result" ? "text-white" : "text-zinc-600"}>
            3. Result
          </span>
        </div>

        {/* Step 1: Idle */}
        {step === "idle" && (
          <div className="text-center py-4 space-y-2.5">
            <p className="text-xs text-zinc-400">
              Query {selectedIsp.toUpperCase()} selfcare to record initial quota baseline.
            </p>
            <button
              onClick={handleStartVerification}
              disabled={!hasCredentials}
              className="px-4 py-2 bg-white hover:bg-zinc-200 disabled:opacity-40 text-black font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              Capture Baseline
            </button>
            {!hasCredentials && (
              <p className="text-[10px] text-zinc-500">
                Please enter credentials above first.
              </p>
            )}
          </div>
        )}

        {/* Measuring Spinners */}
        {(step === "measuring_before" || step === "measuring_after") && (
          <div className="text-center py-6 space-y-2">
            <div className="w-6 h-6 border-2 border-zinc-400 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400">
              {step === "measuring_before"
                ? `Querying ${selectedIsp.toUpperCase()} baseline...`
                : `Querying ${selectedIsp.toUpperCase()} final quota...`}
            </p>
          </div>
        )}

        {/* Step 2: Waiting Cooldown */}
        {step === "waiting" && beforeResult && (
          <div className="space-y-3 animate-fadeIn">
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Baseline Quota</span>
                <span className="font-mono font-bold text-white">{beforeResult.remainingText}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase block">Time</span>
                <span className="font-mono text-zinc-400">{new Date(beforeResult.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="text-center py-2 space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-white">
                <Timer className="w-4 h-4" />
                <span className="text-xl font-bold font-mono">
                  {Math.floor(cooldownRemaining / 60)}:
                  {(cooldownRemaining % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Stream a video or download a file through HyperVPN now.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleMeasureAfter}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Check Final Quota
                </button>
                <button
                  onClick={handleReset}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && beforeResult && afterResult && (
          <div className="space-y-3 animate-fadeIn">
            {(() => {
              const beforeBytes = beforeResult.remainingBytes || 0;
              const afterBytes = afterResult.remainingBytes || 0;
              const deltaBytes = beforeBytes - afterBytes;
              const isTunneling = deltaBytes <= 50 * 1024 * 1024;

              return (
                <div className="space-y-3">
                  {/* Verdict Banner */}
                  <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                      {isTunneling ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-zinc-400" />
                      )}
                      <span>
                        {isTunneling
                          ? "Traffic is Isolated (0 MB ISP Quota Used)"
                          : "ISP Quota Decreased"}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {isTunneling
                        ? "ISP balance remained unchanged. Traffic successfully tunneled via VLESS."
                        : `ISP remaining quota decreased by ${(deltaBytes / (1024 * 1024)).toFixed(1)} MB.`}
                    </p>
                  </div>

                  {/* Before vs After */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">Before</span>
                      <span className="font-mono font-bold text-white">{beforeResult.remainingText}</span>
                    </div>
                    <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block">After</span>
                      <span className="font-mono font-bold text-white">{afterResult.remainingText}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleReset}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 border border-zinc-700"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Test Again
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
