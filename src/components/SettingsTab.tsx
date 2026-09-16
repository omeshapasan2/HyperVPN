import React, { useState } from "react";
import { AppSettings, UpdateCheckResult } from "../types/config";
import { BinariesStatus } from "../hooks/useSettings";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  XCircle,
  Save,
  RotateCw,
  Plus,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Download,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface SettingsTabProps {
  settings: AppSettings;
  binaries: BinariesStatus;
  isElevated: boolean;
  updateInfo: UpdateCheckResult | null;
  checkingUpdate: boolean;
  updateError: string | null;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onCheckBinaries: () => Promise<void>;
  onRelaunchAsAdmin: () => Promise<void>;
  onCheckForUpdates: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  binaries,
  isElevated,
  updateInfo,
  checkingUpdate,
  updateError,
  onSaveSettings,
  onCheckBinaries,
  onRelaunchAsAdmin,
  onCheckForUpdates,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newExclusion, setNewExclusion] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddExclusion = () => {
    if (!newExclusion.trim()) return;
    const cidr = newExclusion.trim();
    if (!formData.customLanExclusions.includes(cidr)) {
      setFormData({
        ...formData,
        customLanExclusions: [...formData.customLanExclusions, cidr],
      });
    }
    setNewExclusion("");
  };

  const handleRemoveExclusion = (index: number) => {
    const updated = formData.customLanExclusions.filter((_, i) => i !== index);
    setFormData({ ...formData, customLanExclusions: updated });
  };

  const handleOpenDownload = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3.5 overflow-y-auto space-y-3 select-none">
      {/* Tab Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
          Settings
        </h2>

        <button
          type="submit"
          form="settings-form"
          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-zinc-700"
        >
          <Save className="w-3 h-3" />
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Administrator Elevation Status Card */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
          <span className="text-[11px] font-bold text-zinc-300">
            Privileges & Security
          </span>
          {isElevated ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-300">
              <ShieldCheck className="w-3 h-3 text-white" /> Elevated (Admin)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
              <ShieldAlert className="w-3 h-3 text-zinc-400" /> Standard User
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-0.5">
          <p className="text-[10px] text-zinc-400 max-w-[230px]">
            {isElevated
              ? "HyperVPN has full administrator privileges to manage the WinTun kernel adapter and route tables."
              : "Administrator privileges are required for kernel packet injection."}
          </p>
          {!isElevated && (
            <button
              type="button"
              onClick={() => onRelaunchAsAdmin()}
              className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black text-[10px] font-bold rounded-lg transition-colors shrink-0 shadow-sm"
            >
              Restart as Admin
            </button>
          )}
        </div>
      </div>

      {/* In-App GitHub Releases Updater Card */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            <span className="text-[11px] font-bold text-zinc-300">
              Software Updates
            </span>
          </div>
          <button
            type="button"
            onClick={() => onCheckForUpdates()}
            disabled={checkingUpdate}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 hover:text-white text-[10px] font-medium rounded-md transition-colors flex items-center gap-1 border border-zinc-700"
          >
            <RotateCw className={`w-2.5 h-2.5 ${checkingUpdate ? "animate-spin" : ""}`} />
            {checkingUpdate ? "Checking..." : "Check Updates"}
          </button>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-400">Current Installed Version</span>
            <span className="font-mono font-bold text-zinc-200">
              v{updateInfo?.currentVersion || "1.0.0"}
            </span>
          </div>

          {updateError && (
            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] text-zinc-400">
              {updateError}
            </div>
          )}

          {updateInfo && !checkingUpdate && (
            <div className="mt-2 pt-2 border-t border-zinc-800/60 space-y-2">
              {updateInfo.hasUpdate ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-white" />
                      New Version Available: v{updateInfo.latestVersion}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenDownload(updateInfo.downloadUrl)}
                      className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Download className="w-3 h-3" />
                      Get Update
                    </button>
                  </div>

                  {updateInfo.releaseNotes && (
                    <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">
                      {updateInfo.releaseNotes}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                    You are running the latest version.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenDownload(updateInfo.downloadUrl)}
                    className="text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5"
                  >
                    Releases <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <form id="settings-form" onSubmit={handleSave} className="space-y-3">
        {/* Core Sidecar Binaries Status */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
            <span className="text-[11px] font-bold text-zinc-300">
              Core Binaries
            </span>
            <button
              type="button"
              onClick={() => onCheckBinaries()}
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-medium rounded-md transition-colors flex items-center gap-1 border border-zinc-700"
            >
              <RotateCw className="w-2.5 h-2.5" />
              Check
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {/* xray.exe */}
            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 flex flex-col justify-between gap-1">
              <span className="text-[10px] font-mono font-bold text-zinc-300">xray.exe</span>
              {binaries.xrayFound ? (
                <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-300">
                  <CheckCircle2 className="w-2.5 h-2.5 text-white" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-500">
                  <XCircle className="w-2.5 h-2.5 text-zinc-500" /> Missing
                </span>
              )}
            </div>

            {/* tun2socks.exe */}
            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 flex flex-col justify-between gap-1">
              <span className="text-[10px] font-mono font-bold text-zinc-300">tun2socks</span>
              {binaries.tun2socksFound ? (
                <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-300">
                  <CheckCircle2 className="w-2.5 h-2.5 text-white" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-500">
                  <XCircle className="w-2.5 h-2.5 text-zinc-500" /> Missing
                </span>
              )}
            </div>

            {/* wintun.dll */}
            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 flex flex-col justify-between gap-1">
              <span className="text-[10px] font-mono font-bold text-zinc-300">wintun.dll</span>
              {binaries.wintunFound ? (
                <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-300">
                  <CheckCircle2 className="w-2.5 h-2.5 text-white" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-500">
                  <XCircle className="w-2.5 h-2.5 text-zinc-500" /> Missing
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Windows System & Startup Behavior */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2">
          <span className="text-[11px] font-bold text-zinc-300 block border-b border-zinc-800/80 pb-1.5">
            System & Startup
          </span>

          <div className="space-y-1.5">
            {/* Auto Start */}
            <label className="flex items-center justify-between p-2 bg-zinc-950/60 border border-zinc-800/60 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors">
              <span className="text-xs font-medium text-zinc-300">Start with Windows</span>
              <input
                type="checkbox"
                checked={formData.autoStart}
                onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
                className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>

            {/* Auto Connect */}
            <label className="flex items-center justify-between p-2 bg-zinc-950/60 border border-zinc-800/60 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors">
              <span className="text-xs font-medium text-zinc-300">Auto-Connect on Launch</span>
              <input
                type="checkbox"
                checked={formData.autoConnectOnLaunch}
                onChange={(e) =>
                  setFormData({ ...formData, autoConnectOnLaunch: e.target.checked })
                }
                className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>

            {/* Minimize to Tray */}
            <label className="flex items-center justify-between p-2 bg-zinc-950/60 border border-zinc-800/60 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors">
              <span className="text-xs font-medium text-zinc-300">Minimize to Tray on Close</span>
              <input
                type="checkbox"
                checked={formData.minimizeToTrayOnClose}
                onChange={(e) =>
                  setFormData({ ...formData, minimizeToTrayOnClose: e.target.checked })
                }
                className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-white focus:ring-0 cursor-pointer accent-white"
              />
            </label>
          </div>
        </div>

        {/* Local Proxy Ports */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2">
          <span className="text-[11px] font-bold text-zinc-300 block border-b border-zinc-800/80 pb-1.5">
            Local Ports
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                SOCKS5 Inbound
              </label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={formData.socksPort}
                onChange={(e) =>
                  setFormData({ ...formData, socksPort: parseInt(e.target.value) || 10808 })
                }
                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                Xray Stats Port
              </label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={formData.statsPort}
                onChange={(e) =>
                  setFormData({ ...formData, statsPort: parseInt(e.target.value) || 10085 })
                }
                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        </div>

        {/* Custom LAN & Subnet Exclusions */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2">
          <span className="text-[11px] font-bold text-zinc-300 block border-b border-zinc-800/80 pb-1.5">
            LAN Exclusions
          </span>

          <div className="flex flex-wrap gap-1">
            {["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"].map(
              (subnet) => (
                <span
                  key={subnet}
                  className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800 font-mono text-[10px]"
                >
                  {subnet}
                </span>
              )
            )}
          </div>

          {/* Add custom exclusion */}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={newExclusion}
              onChange={(e) => setNewExclusion(e.target.value)}
              placeholder="e.g. 192.168.10.0/24"
              className="flex-1 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              type="button"
              onClick={handleAddExclusion}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0 border border-zinc-700"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {/* List of custom exclusions */}
          {formData.customLanExclusions.length > 0 && (
            <div className="space-y-1 pt-1">
              {formData.customLanExclusions.map((cidr, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-2.5 py-1 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300"
                >
                  <span>{cidr}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExclusion(index)}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
