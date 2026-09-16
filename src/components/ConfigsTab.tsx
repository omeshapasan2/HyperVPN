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
    <div className="flex-1 flex flex-col p-3.5 overflow-y-auto space-y-3">
      {/* Top Action Bar */}
      <div className="flex items-center gap-2">
        <form onSubmit={handleQuickPaste} className="flex-1 relative min-w-0">
          <ClipboardPaste className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={quickPasteUri}
            onChange={(e) => {
              setQuickPasteUri(e.target.value);
              if (quickPasteError) setQuickPasteError(null);
            }}
            placeholder="Paste vless:// URI..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </form>

        <button
          onClick={onPingAll}
          disabled={configs.length === 0}
          className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors shrink-0 disabled:opacity-40"
          title="Ping all servers"
        >
          <Zap className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleOpenAdd}
          className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-medium text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {/* Quick Paste Error Message */}
      {quickPasteError && (
        <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{quickPasteError}</span>
        </div>
      )}

      {/* Search Bar */}
      {configs.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${configs.length} servers...`}
            className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-900/50 border border-zinc-800/80 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
      )}

      {/* Server List */}
      {configs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
          <Server className="w-8 h-8 text-zinc-600 mb-2" />
          <h3 className="text-xs font-bold text-zinc-300 mb-1">No Servers Added</h3>
          <p className="text-[11px] text-zinc-500 max-w-xs mb-3">
            Paste a vless:// URI above or click "Add" to configure your server.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Server
          </button>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500">
          No servers matching "{searchQuery}"
        </div>
      ) : (
        <div className="flex flex-col gap-2">
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
