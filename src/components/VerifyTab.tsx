import React, { useState, useEffect } from "react";
import { AppSettings, IspVerifyResult, SltUsageResponse } from "../types/config";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Timer,
  Save,
  ArrowRight,
  Package,
  Film,
  RefreshCw,
  Layers,
} from "lucide-react";

interface VerifyTabProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export const VerifyTab: React.FC<VerifyTabProps> = ({ settings, onSaveSettings }) => {
  const [selectedIsp, setSelectedIsp] = useState<"slt" | "dialog">(() => {
    const saved = localStorage.getItem("hypervpn_draft_selected_isp");
    if (saved === "slt" || saved === "dialog") return saved;
    return settings.defaultIsp || "slt";
  });

  const [sltCredentials, setSltCredentials] = useState(() => {
    const draft = localStorage.getItem("hypervpn_draft_slt");
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch {}
    }
    return settings.slt;
  });

  const [dialogCredentials, setDialogCredentials] = useState(() => {
    const draft = localStorage.getItem("hypervpn_draft_dialog");
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch {}
    }
    return settings.dialog;
  });

  const [isSaved, setIsSaved] = useState(false);

  // Verification Step state
  const [step, setStep] = useState<"idle" | "measuring_before" | "waiting" | "measuring_after" | "result">("idle");
  const [beforeResult, setBeforeResult] = useState<IspVerifyResult | null>(null);
  const [afterResult, setAfterResult] = useState<IspVerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cooldown countdown timer
  const [cooldownRemaining, setCooldownRemaining] = useState(120);

  // SLT Usage card state (combines Primary Package & VAS / Entertainment Bundles)
  const [sltUsage, setSltUsage] = useState<SltUsageResponse | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("hypervpn_draft_selected_isp", selectedIsp);
    } catch {}
  }, [selectedIsp]);

  useEffect(() => {
    try {
      localStorage.setItem("hypervpn_draft_slt", JSON.stringify(sltCredentials));
    } catch {}
  }, [sltCredentials]);

  useEffect(() => {
    try {
      localStorage.setItem("hypervpn_draft_dialog", JSON.stringify(dialogCredentials));
    } catch {}
  }, [dialogCredentials]);

  useEffect(() => {
    // Only overwrite if no local draft exists
    if (!localStorage.getItem("hypervpn_draft_slt")) {
      setSltCredentials(settings.slt);
    }
    if (!localStorage.getItem("hypervpn_draft_dialog")) {
      setDialogCredentials(settings.dialog);
    }
  }, [settings]);

  // Flush drafts on teardown
  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        localStorage.setItem("hypervpn_draft_selected_isp", selectedIsp);
        localStorage.setItem("hypervpn_draft_slt", JSON.stringify(sltCredentials));
        localStorage.setItem("hypervpn_draft_dialog", JSON.stringify(dialogCredentials));
      } catch {}
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [selectedIsp, sltCredentials, dialogCredentials]);

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

    // Clear persisted drafts after successfully saving
    try {
      localStorage.removeItem("hypervpn_draft_selected_isp");
      localStorage.removeItem("hypervpn_draft_slt");
      localStorage.removeItem("hypervpn_draft_dialog");
    } catch {}

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

  const handleFetchSltUsage = async () => {
    if (!sltCredentials.subscriberId || !sltCredentials.token) {
      setUsageError("Enter SLT Subscriber ID and Token above first");
      return;
    }
    setLoadingUsage(true);
    setUsageError(null);
    try {
      const res = await invoke<SltUsageResponse>("get_slt_full_usage", {
        creds: {
          subscriberId: sltCredentials.subscriberId.trim(),
          token: sltCredentials.token.trim(),
          clientId: (sltCredentials.clientId || "").trim(),
        },
      });
      setSltUsage(res);
    } catch (err) {
      const msg = typeof err === "string" ? err : (err as Error).message || "Failed to load SLT usage data";
      setUsageError(msg);
    } finally {
      setLoadingUsage(false);
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

      {/* Redesigned SLT Usage Card (When SLT is active) */}
      {selectedIsp === "slt" && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-zinc-300" />
              <span className="text-[11px] font-bold text-zinc-300">
                SLT Usage
              </span>
            </div>
            <button
              onClick={handleFetchSltUsage}
              disabled={loadingUsage || !sltCredentials.subscriberId || !sltCredentials.token}
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 hover:text-white text-[10px] font-medium rounded-md transition-colors flex items-center gap-1 border border-zinc-700"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${loadingUsage ? "animate-spin" : ""}`} />
              {loadingUsage ? "Fetching..." : "Fetch Usage"}
            </button>
          </div>

          {usageError && (
            <div className="p-2 bg-zinc-950/80 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-zinc-500 shrink-0" />
              <span className="truncate">{usageError}</span>
            </div>
          )}

          {loadingUsage && (
            <div className="text-center py-4 space-y-1.5">
              <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin mx-auto" />
              <p className="text-[10px] text-zinc-500 font-medium">
                Querying SLT Usage &amp; VAS APIs...
              </p>
            </div>
          )}

          {!loadingUsage && sltUsage && (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
              {/* Reported Time & Status Header */}
              {(sltUsage.status || sltUsage.reportedTime) && (
                <div className="flex items-center justify-between px-2 py-1 bg-zinc-950/60 rounded-md border border-zinc-800/60 text-[9px] text-zinc-400 font-mono">
                  <span>
                    Status:{" "}
                    <span className={sltUsage.status === "THROTTLED" ? "text-amber-400 font-bold" : "text-zinc-200 font-bold"}>
                      {sltUsage.status || "ACTIVE"}
                    </span>
                  </span>
                  {sltUsage.reportedTime && (
                    <span className="text-zinc-500">As of: {sltUsage.reportedTime}</span>
                  )}
                </div>
              )}

              {/* 1. Primary Package Info (from UsageSummary API 1) */}
              {sltUsage.primaryPackage && (
                <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded text-[9px] font-bold shrink-0">
                        Base
                      </span>
                      <span className="text-[11px] font-bold text-white truncate" title={sltUsage.primaryPackage.packageName}>
                        {sltUsage.primaryPackage.packageName}
                      </span>
                    </div>
                    {sltUsage.primaryPackage.usageDetails[0]?.expiryDate && (
                      <span className="text-[9px] text-zinc-500 font-mono shrink-0">
                        Exp: {sltUsage.primaryPackage.usageDetails[0].expiryDate}
                      </span>
                    )}
                  </div>

                  {/* Primary Package Consumption */}
                  {sltUsage.primaryPackage.usageDetails.length > 0 ? (
                    sltUsage.primaryPackage.usageDetails.map((detail, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-200 font-semibold">
                            {detail.used} / {detail.limit} {detail.volumeUnit}
                          </span>
                          <span className="text-zinc-400">
                            remaining -{" "}
                            <span className="text-white font-bold">
                              {detail.remaining} {detail.volumeUnit}
                            </span>
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-white transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(0, detail.percentage))}%`,
                            }}
                          />
                        </div>

                        {detail.name && (
                          <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-0.5">
                            <span>{detail.name}</span>
                            <span>{detail.percentage.toFixed(1)}% consumed</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-zinc-200 font-semibold">
                          {sltUsage.primaryPackage.totalUsed} / {sltUsage.primaryPackage.totalLimit} {sltUsage.primaryPackage.volumeUnit}
                        </span>
                        <span className="text-zinc-400">
                          remaining -{" "}
                          <span className="text-white font-bold">
                            {sltUsage.primaryPackage.totalRemaining} {sltUsage.primaryPackage.volumeUnit}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. VAS & Entertainment Bundles (from GetDashboardVASBundles API 2) */}
              {sltUsage.vasBundles && sltUsage.vasBundles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-0.5 pt-0.5">
                    VAS &amp; Entertainment Add-ons
                  </div>
                  {sltUsage.vasBundles.map((bundle, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2.5 space-y-1.5 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          {bundle.isEntertainment ? (
                            <span className="px-1.5 py-0.5 bg-zinc-800 text-white border border-zinc-600 rounded text-[9px] font-bold flex items-center gap-1 shrink-0">
                              <Film className="w-2.5 h-2.5 text-zinc-300" />
                              Streaming
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded text-[9px] font-medium flex items-center gap-1 shrink-0">
                              <Layers className="w-2.5 h-2.5 text-zinc-500" />
                              Add-on
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-white truncate" title={bundle.name}>
                            {bundle.name}
                          </span>
                        </div>

                        {bundle.expiryDate && (
                          <span className="text-[9px] text-zinc-500 font-mono shrink-0">
                            Exp: {bundle.expiryDate}
                          </span>
                        )}
                      </div>

                      {/* Display format: If limit is null/unlimited (like Entertainment Combo Pack), show name -> used GB Used */}
                      {bundle.limit ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-zinc-200">
                              {bundle.used} / {bundle.limit} {bundle.volumeUnit}
                            </span>
                            <span className="text-zinc-400">
                              remaining -{" "}
                              <span className="text-white font-bold">
                                {bundle.remaining || "0.0"} {bundle.volumeUnit}
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                bundle.isEntertainment ? "bg-white" : "bg-zinc-400"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, bundle.percentage))}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-zinc-900/60 px-2 py-1 rounded-md border border-zinc-800/60 font-mono text-[11px]">
                          <span className="text-zinc-400 text-[10px]">{bundle.name}</span>
                          <span className="text-white font-bold">
                            {bundle.used} {bundle.volumeUnit} Used
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loadingUsage && !sltUsage && !usageError && (
            <p className="text-[10px] text-zinc-500 text-center py-2">
              Click &quot;Fetch Usage&quot; to view primary package allowance and active entertainment add-ons.
            </p>
          )}
        </div>
      )}

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
