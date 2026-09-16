import React, { useState } from "react";
import { VlessConfig } from "../types/config";
import { ConfigCard } from "./ConfigCard";
import { ConfigEditModal } from "./ConfigEditModal";
import { ConfigDeleteModal } from "./ConfigDeleteModal";
import {
  Plus,
  Search,
  Zap,
  Server,
  ClipboardPaste,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface ConfigsTabProps {
  configs: VlessConfig[];
  activeConfigId: string | null;
  isConnected: boolean;
  pingingIds: Set<string>;
  onSelectConfig: (id: string) => void;
  onSaveConfig: (config: VlessConfig) => void;
  onDeleteConfig: (id: string) => void;
  onCopyUri: (config: VlessConfig) => Promise<boolean>;
  onPingConfig: (id: string) => void;
  onPingAll: () => void;
  onAddFromUri: (uri: string) => Promise<{ success: boolean; config?: VlessConfig; error?: string }>;
}

export const ConfigsTab: React.FC<ConfigsTabProps> = ({
  configs,
  activeConfigId,
  isConnected,
  pingingIds,
  onSelectConfig,
  onSaveConfig,
  onDeleteConfig,
  onCopyUri,
  onPingConfig,
  onPingAll,
  onAddFromUri,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [quickPasteUri, setQuickPasteUri] = useState("");
  const [quickPasteError, setQuickPasteError] = useState<string | null>(null);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<VlessConfig | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<VlessConfig | null>(null);

  // Filtered configs
  const filteredConfigs = configs.filter((cfg) => {
    const q = searchQuery.toLowerCase();
    return (
      cfg.remark.toLowerCase().includes(q) ||
      cfg.host.toLowerCase().includes(q) ||
      (cfg.sni && cfg.sni.toLowerCase().includes(q)) ||
      cfg.security.toLowerCase().includes(q)
    );
  });

  const handleQuickPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPasteUri.trim()) return;
    setQuickPasteError(null);
    const res = await onAddFromUri(quickPasteUri.trim());
    if (res.success) {
      setQuickPasteUri("");
    } else {
      setQuickPasteError(res.error || "Failed to parse VLESS URI");
    }
  };

  const handleOpenAdd = () => {
    setEditingConfig(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (cfg: VlessConfig) => {
    setEditingConfig(cfg);
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (cfg: VlessConfig) => {
    setDeletingConfig(cfg);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-5">
      {/* Top action bar: Quick Paste + Add Button + Ping All */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Quick Paste Form */}
        <form onSubmit={handleQuickPaste} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <ClipboardPaste className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={quickPasteUri}
              onChange={(e) => {
                setQuickPasteUri(e.target.value);
                if (quickPasteError) setQuickPasteError(null);
              }}
              placeholder="Quick Paste vless:// URI to import instantly..."
              className="w-full pl-9 pr-4 py-2 bg-gray-900/90 border border-gray-800 rounded-xl text-xs text-gray-200 font-mono placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={!quickPasteUri.trim()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Import
          </button>
        </form>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onPingAll}
            disabled={configs.length === 0}
            className="px-3.5 py-2 bg-gray-900/80 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Ping all configurations in parallel"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Ping All
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-950"
          >
            <Plus className="w-4 h-4" />
            Add Server
          </button>
        </div>
      </div>

      {/* Quick Paste Error Message */}
      {quickPasteError && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{quickPasteError}</span>
        </div>
      )}

      {/* Search and Server Count Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search servers by name, host, SNI..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-900/60 border border-gray-800/80 rounded-xl text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <span className="text-xs text-gray-400">
          Showing <span className="font-semibold text-white">{filteredConfigs.length}</span> of{" "}
          <span className="font-semibold text-white">{configs.length}</span> servers
        </span>
      </div>

      {/* Server List Grid */}
      {configs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
            <Server className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">No VLESS Servers Added Yet</h3>
          <p className="text-xs text-gray-400 max-w-sm mb-4">
            Paste a <code className="text-indigo-300">vless://</code> URI above or click "Add Server" to
            configure your first XTLS Reality or TLS outbound tunnel.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add First Server
          </button>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-500">
          No servers matching "{searchQuery}"
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredConfigs.map((cfg) => (
            <ConfigCard
              key={cfg.id}
              config={cfg}
              isActive={cfg.id === activeConfigId}
              isConnected={isConnected}
              isPinging={pingingIds.has(cfg.id)}
              onSelect={() => onSelectConfig(cfg.id)}
              onEdit={() => handleOpenEdit(cfg)}
              onDelete={() => handleOpenDelete(cfg)}
              onPing={() => onPingConfig(cfg.id)}
              onCopyUri={() => onCopyUri(cfg)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ConfigEditModal
        isOpen={isEditModalOpen}
        initialConfig={editingConfig}
        onClose={() => setIsEditModalOpen(false)}
        onSave={onSaveConfig}
      />

      <ConfigDeleteModal
        isOpen={isDeleteModalOpen}
        config={deletingConfig}
        isActive={deletingConfig?.id === activeConfigId}
        isConnected={isConnected}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => deletingConfig && onDeleteConfig(deletingConfig.id)}
      />
    </div>
  );
};
