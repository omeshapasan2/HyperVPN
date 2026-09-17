import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Navigation, TabType } from "./components/Navigation";
import { ConfigsTab } from "./components/ConfigsTab";
import { UsageTab } from "./components/UsageTab";
import { SpeedTestTab } from "./components/SpeedTestTab";
import { VerifyTab } from "./components/VerifyTab";
import { SettingsTab } from "./components/SettingsTab";
import { LogsViewer } from "./components/LogsViewer";
import { useVpn } from "./hooks/useVpn";
import { useConfigs } from "./hooks/useConfigs";
import { useUsage } from "./hooks/useUsage";
import { useSettings } from "./hooks/useSettings";
import { useLogs } from "./hooks/useLogs";
import { VlessConfig } from "./types/config";
import { ShieldAlert } from "lucide-react";

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const savedTab = localStorage.getItem("hypervpn_active_tab");
    if (savedTab && ["configs", "usage", "speed", "verify", "settings", "logs"].includes(savedTab)) {
      return savedTab as TabType;
    }
    return "configs";
  });

  useEffect(() => {
    try {
      localStorage.setItem("hypervpn_active_tab", activeTab);
    } catch (e) {
      console.warn("Failed to persist activeTab:", e);
    }
  }, [activeTab]);

  const [vpnConnected, setVpnConnected] = useState(false);

  // Active config switch handler: if currently connected, reconnect to the new config
  const handleActiveConfigSwitched = async (newConfig: VlessConfig) => {
    if (vpnConnected) {
      await connect(newConfig);
    }
  };

  const {
    configs,
    activeConfigId,
    activeConfig,
    pingingIds,
    selectActiveConfig,
    addFromUri,
    saveConfig,
    deleteConfig,
    copyConfigUri,
    pingSingleConfig,
    pingAll,
  } = useConfigs(handleActiveConfigSwitched);

  const { status, clearError, connect, disconnect } = useVpn(configs, activeConfigId);

  // Keep local vpnConnected updated for config switch handler
  if (status.connected !== vpnConnected) {
    setVpnConnected(status.connected);
  }

  const { history, resetHistory, refreshHistory } = useUsage();
  const {
    settings,
    binaries,
    isElevated,
    updateInfo,
    checkingUpdate,
    updateError,
    binariesUpdateInfo,
    checkingBinariesUpdate,
    binariesUpdateProgress,
    updatingBinaries,
    binariesUpdateError,
    saveSettings,
    checkBinaries,
    relaunchAsAdmin,
    checkForUpdates,
    checkCoreBinariesUpdates,
    updateCoreBinaries,
  } = useSettings();
  const { logs, clearLogs, refreshLogs } = useLogs();

  const handleToggle = () => {
    if (status.connected) {
      disconnect();
    } else if (activeConfig) {
      connect(activeConfig);
    }
  };

  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden text-zinc-100 select-none">
      {/* Left-side Vertical Rail Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Right Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Administrator Elevation Warning Banner */}
        {!isElevated && (
          <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-zinc-300">
            <div className="flex items-center gap-1.5 truncate">
              <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Standard privileges detected. WinTun adapter requires Admin rights.</span>
            </div>
            <button
              onClick={() => relaunchAsAdmin()}
              className="px-2 py-0.5 bg-white hover:bg-zinc-200 text-black font-bold text-[10px] rounded transition-colors shrink-0 shadow-sm ml-2"
            >
              Restart as Admin
            </button>
          </div>
        )}

        {/* Top Header with live status, speeds, and connect button */}
        <Header
          status={status}
          activeConfig={activeConfig}
          onToggleConnect={handleToggle}
          onClearError={clearError}
        />

        {/* Active Tab View */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === "configs" && (
            <ConfigsTab
              configs={configs}
              activeConfigId={activeConfigId}
              isConnected={status.connected}
              pingingIds={pingingIds}
              onSelectConfig={selectActiveConfig}
              onSaveConfig={saveConfig}
              onDeleteConfig={deleteConfig}
              onCopyUri={copyConfigUri}
              onPingConfig={pingSingleConfig}
              onPingAll={pingAll}
              onAddFromUri={addFromUri}
            />
          )}

          {activeTab === "usage" && (
            <UsageTab
              history={history}
              status={status}
              onResetHistory={resetHistory}
              onRefreshHistory={refreshHistory}
            />
          )}

          {activeTab === "speed" && <SpeedTestTab />}

          {activeTab === "verify" && (
            <VerifyTab settings={settings} onSaveSettings={saveSettings} />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              settings={settings}
              binaries={binaries}
              isElevated={isElevated}
              updateInfo={updateInfo}
              checkingUpdate={checkingUpdate}
              updateError={updateError}
              binariesUpdateInfo={binariesUpdateInfo}
              checkingBinariesUpdate={checkingBinariesUpdate}
              binariesUpdateProgress={binariesUpdateProgress}
              updatingBinaries={updatingBinaries}
              binariesUpdateError={binariesUpdateError}
              onSaveSettings={saveSettings}
              onCheckBinaries={checkBinaries}
              onRelaunchAsAdmin={relaunchAsAdmin}
              onCheckForUpdates={checkForUpdates}
              onCheckCoreBinariesUpdates={checkCoreBinariesUpdates}
              onUpdateCoreBinaries={updateCoreBinaries}
            />
          )}

          {activeTab === "logs" && (
            <LogsViewer
              logs={logs}
              onClearLogs={clearLogs}
              onRefreshLogs={refreshLogs}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
