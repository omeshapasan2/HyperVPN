import React from "react";
import { VlessConfig } from "../types/config";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfigDeleteModalProps {
  isOpen: boolean;
  config: VlessConfig | null;
  isActive: boolean;
  isConnected: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfigDeleteModal: React.FC<ConfigDeleteModalProps> = ({
  isOpen,
  config,
  isActive,
  isConnected,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !config) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-[320px] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-1.5 text-zinc-200">
            <AlertTriangle className="w-4 h-4 text-zinc-400" />
            <h2 className="text-xs font-bold">Delete Server</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 space-y-2.5">
          <p className="text-xs text-zinc-300">
            Delete <span className="font-bold text-white">"{config.remark}"</span> ({config.host}:{config.port})?
          </p>

          {isActive && isConnected && (
            <div className="p-2 bg-zinc-950 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span>
                This server is connected. Deleting will immediately disconnect the VPN.
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-3.5 py-2.5 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-white hover:bg-zinc-200 text-black transition-colors flex items-center gap-1 shadow-sm"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
