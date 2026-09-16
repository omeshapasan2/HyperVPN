import React, { useState, useEffect } from "react";
import { AppSettings, IspVerifyResult } from "../types/config";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  Timer,
  Save,
  Database,
  ArrowRight,
} from "lucide-react";

interface VerifyTabProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export const VerifyTab: React.FC<VerifyTabProps> = ({ settings, onSaveSettings }) => {
  const [selectedIsp, setSelectedIsp] = useState<"slt" | "dialog">(settings.defaultIsp || "slt");

  // ISP credentials draft state
  const [sltCredentials, setSltCredentials] = useState(settings.slt);
  const [dialogCredentials, setDialogCredentials] = useState(settings.dialog);
  const [isSaved, setIsSaved] = useState(false);

  // Verification Step state: "idle" | "measuring_before" | "waiting" | "measuring_after" | "result"
  const [step, setStep] = useState<"idle" | "measuring_before" | "waiting" | "measuring_after" | "result">("idle");
  const [beforeResult, setBeforeResult] = useState<IspVerifyResult | null>(null);
  const [afterResult, setAfterResult] = useState<IspVerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cooldown countdown timer (in seconds)
  const [cooldownRemaining, setCooldownRemaining] = useState(120);

  useEffect(() => {
    setSltCredentials(settings.slt);
    setDialogCredentials(settings.dialog);
  }, [settings]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "waiting" && cooldownRemaining > 0) {
      interval = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, cooldownRemaining]);

  // Save credentials handler
  const handleSaveCredentials = async () => {
    const updated: AppSettings = {
      ...settings,
      defaultIsp: selectedIsp,
      slt: sltCredentials,
      dialog: dialogCredentials,
    };
    await onSaveSettings(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Run ISP API query
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

  // Start Before Measurement
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

  // Measure After (Final check)
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

  // Reset entire flow
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
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Tab Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          ISP Usage Verification Engine
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Verify if your outbound traffic is truly being tunneled through your VLESS Reality server without
          consuming standard ISP data quotas.
        </p>
      </div>

      {/* ISP Selection & Credentials Card */}
      <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">ISP Account Configuration</h3>
          </div>
          {/* ISP Selector Pills */}
          <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setSelectedIsp("slt")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                selectedIsp === "slt"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              SLT Broadband
            </button>
            <button
              onClick={() => setSelectedIsp("dialog")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                selectedIsp === "dialog"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Dialog Axiata
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        {selectedIsp === "slt" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Subscriber ID
              </label>
              <input
                type="text"
                value={sltCredentials.subscriberId}
                onChange={(e) =>
                  setSltCredentials({ ...sltCredentials, subscriberId: e.target.value })
                }
                placeholder="e.g. 0112345678"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
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
                placeholder="eyJhbGciOi..."
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Client ID (optional)
              </label>
              <input
                type="text"
                value={sltCredentials.clientId || ""}
                onChange={(e) =>
                  setSltCredentials({ ...sltCredentials, clientId: e.target.value })
                }
                placeholder="b7402e9d66808f762ccedbe42c20668e"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                MSISDN / Account Number
              </label>
              <input
                type="text"
                value={dialogCredentials.msisdn}
                onChange={(e) =>
                  setDialogCredentials({ ...dialogCredentials, msisdn: e.target.value })
                }
                placeholder="e.g. 771234567"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                UUID (Selfcare User ID)
              </label>
              <input
                type="text"
                value={dialogCredentials.uuid}
                onChange={(e) =>
                  setDialogCredentials({ ...dialogCredentials, uuid: e.target.value })
                }
                placeholder="User UUID"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Session Cookie
              </label>
              <input
                type="password"
                value={dialogCredentials.cookie}
                onChange={(e) =>
                  setDialogCredentials({ ...dialogCredentials, cookie: e.target.value })
                }
                placeholder="JSESSIONID=..."
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-500">
            Stored locally in <code className="text-indigo-300">settings.json</code>. Never transmitted to third parties.
          </span>
          <button
            onClick={handleSaveCredentials}
            className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-indigo-400" />
            {isSaved ? "Saved!" : "Save Credentials"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-xs text-rose-200 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Verification Wizard Steps Card */}
      <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-6 shadow-lg space-y-6">
        {/* Step Indicator Bar */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                step === "idle"
                  ? "bg-indigo-600 text-white"
                  : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              1
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Baseline Snapshot</span>
              <span className="text-[11px] text-gray-400">Record current ISP quota</span>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-gray-600" />

          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                step === "waiting"
                  ? "bg-indigo-600 text-white animate-pulse"
                  : step === "result" || step === "measuring_after"
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-gray-800 text-gray-500"
              }`}
            >
              2
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Traffic Test</span>
              <span className="text-[11px] text-gray-400">Stream or download data</span>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-gray-600" />

          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                step === "result"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-500"
              }`}
            >
              3
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Verdict & Diff</span>
              <span className="text-[11px] text-gray-400">Compare balances</span>
            </div>
          </div>
        </div>

        {/* Step 1: Idle / Start */}
        {step === "idle" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
              <Play className="w-6 h-6 ml-0.5" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-bold text-white">Ready to Verify Tunnel Isolation</h4>
              <p className="text-xs text-gray-400">
                Click below to query your ISP's selfcare portal and establish your initial quota baseline.
              </p>
            </div>
            <button
              onClick={handleStartVerification}
              disabled={!hasCredentials}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950 transition-all inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Capture Initial Snapshot
            </button>
            {!hasCredentials && (
              <p className="text-[11px] text-amber-400">
                Please enter and save your {selectedIsp.toUpperCase()} credentials above first.
              </p>
            )}
          </div>
        )}

        {/* Measuring Before / After Spinner */}
        {(step === "measuring_before" || step === "measuring_after") && (
          <div className="text-center py-10 space-y-3">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-300 font-medium">
              {step === "measuring_before"
                ? `Querying ${selectedIsp.toUpperCase()} for baseline snapshot...`
                : `Querying ${selectedIsp.toUpperCase()} for post-test comparison...`}
            </p>
          </div>
        )}

        {/* Step 2: Waiting Cooldown */}
        {step === "waiting" && beforeResult && (
          <div className="space-y-6">
            <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Baseline Remaining</span>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {beforeResult.remainingText} ({beforeResult.packageName || "Standard"})
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Timestamp</span>
                <div className="text-xs font-mono text-gray-400">
                  {new Date(beforeResult.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div className="text-center py-4 space-y-4">
              <div className="flex items-center justify-center gap-2 text-indigo-400">
                <Timer className="w-6 h-6 animate-pulse" />
                <span className="text-2xl font-bold font-mono text-white">
                  {Math.floor(cooldownRemaining / 60)}:
                  {(cooldownRemaining % 60).toString().padStart(2, "0")}
                </span>
              </div>

              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-white">
                  Transfer Heavy Traffic Through HyperVPN Now
                </h4>
                <p className="text-xs text-gray-400">
                  Play a 4K YouTube video or download a large test file while connected to VPN. When the
                  cooldown reaches zero or you are ready, click "Check Final Quota".
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleMeasureAfter}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Check Final Quota
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Final Comparison Result */}
        {step === "result" && beforeResult && afterResult && (
          <div className="space-y-6 animate-fadeIn">
            {(() => {
              const beforeBytes = beforeResult.remainingBytes || 0;
              const afterBytes = afterResult.remainingBytes || 0;
              const deltaBytes = beforeBytes - afterBytes;
              // If remaining bytes didn't decrease or decreased by less than 50MB
              const isTunneling = deltaBytes <= 50 * 1024 * 1024;

              return (
                <div className="space-y-6">
                  {/* Big Banner */}
                  <div
                    className={`p-5 rounded-2xl border flex items-start gap-4 ${
                      isTunneling
                        ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-200 shadow-lg shadow-emerald-950/30"
                        : "bg-amber-950/40 border-amber-800/80 text-amber-200 shadow-lg shadow-amber-950/30"
                    }`}
                  >
                    {isTunneling ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white">
                        {isTunneling
                          ? "VPN Verification Successful: Traffic is Fully Isolated"
                          : "Warning: ISP Quota Decreased"}
                      </h4>
                      <p className="text-xs">
                        {isTunneling
                          ? "Your ISP balance remained unchanged (or delta was <50MB) during the test. Outbound traffic successfully tunneled through your VLESS Reality server."
                          : `Your ISP remaining balance decreased by ${(deltaBytes / (1024 * 1024)).toFixed(
                              1
                            )} MB. Some traffic may have bypassed the VPN or an un-proxied process consumed local bandwidth.`}
                      </p>
                    </div>
                  </div>

                  {/* Before vs After Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-1">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">
                        Before Test (Baseline)
                      </span>
                      <div className="text-xl font-bold font-mono text-white">
                        {beforeResult.remainingText}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {new Date(beforeResult.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-1">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">
                        After Test (Final)
                      </span>
                      <div className="text-xl font-bold font-mono text-white">
                        {afterResult.remainingText}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {new Date(afterResult.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleReset}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950 transition-all flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Run Another Verification Test
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
