import { useState } from "react";
import { Header } from "./components/Header";
import { Navigation, TabType } from "./components/Navigation";
import { ConfigsTab } from "./components/ConfigsTab";
import { UsageTab } from "./components/UsageTab";
import { VerifyTab } from "./components/VerifyTab";
import { SettingsTab } from "./components/SettingsTab";
import { LogsViewer } from "./components/LogsViewer";
import { useVpn } from "./hooks/useVpn";
import { useConfigs } from "./hooks/useConfigs";
import { useUsage } from "./hooks/useUsage";
import { useSettings } from "./hooks/useSettings";
import { useLogs } from "./hooks/useLogs";
import { VlessConfig } from "./types/config";

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>("configs");

  const { status, clearError, connect, disconnect } = useVpn();

  // Active config switch handler: if currently connected, reconnect to the new config
  const handleActiveConfigSwitched = async (newConfig: VlessConfig) => {
    if (status.connected) {
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

  const { history, resetHistory, refreshHistory } = useUsage();
  const { settings, binaries, saveSettings, checkBinaries } = useSettings();
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

          {activeTab === "verify" && (
            <VerifyTab settings={settings} onSaveSettings={saveSettings} />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              settings={settings}
              binaries={binaries}
              onSaveSettings={saveSettings}
              onCheckBinaries={checkBinaries}
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
