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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">Delete Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          <p className="text-xs text-gray-300">
            Are you sure you want to delete the configuration{" "}
            <span className="font-semibold text-white">"{config.remark}"</span> ({config.host}:{config.port})?
          </p>

          {isActive && isConnected && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                This server is currently connected. Deleting it will immediately terminate the VPN connection.
              </span>
            </div>
          )}

          <p className="text-[11px] text-gray-500">This action cannot be undone.</p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Server
          </button>
        </div>
      </div>
    </div>
  );
};
