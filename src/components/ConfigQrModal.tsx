import React, { useState, useEffect, useMemo } from "react";
import qrcode from "qrcode-generator";
import { VlessConfig } from "../types/config";
import { serializeVlessUri } from "../utils/vless";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { X, Copy, Check, QrCode } from "lucide-react";

interface ConfigQrModalProps {
  isOpen: boolean;
  config: VlessConfig | null;
  onClose: () => void;
}

export const ConfigQrModal: React.FC<ConfigQrModalProps> = ({
  isOpen,
  config,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // Generate serialized URI only when modal is open and config is provided
  const vlessUri = useMemo(() => {
    if (!isOpen || !config) return "";
    return serializeVlessUri(config);
  }, [isOpen, config]);

  // Generate SVG path for QR code
  const { pathData, viewBoxSize } = useMemo(() => {
    if (!vlessUri) return { pathData: "", viewBoxSize: 0 };
    try {
      // Type 0 = auto-detect minimum type size (1..40), 'M' = Medium error correction (~15%)
      const qr = qrcode(0, "M");
      qr.addData(vlessUri);
      qr.make();

      const count = qr.getModuleCount();
      const margin = 2; // Quiet zone
      const size = count + margin * 2;

      let d = "";
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (qr.isDark(row, col)) {
            d += `M${col + margin},${row + margin}h1v1h-1z `;
          }
        }
      }

      return { pathData: d, viewBoxSize: size };
    } catch (err) {
      console.error("Failed to generate QR code:", err);
      return { pathData: "", viewBoxSize: 0 };
    }
  }, [vlessUri]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset copied state on open/close
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !config) return null;

  const handleCopy = async () => {
    if (!vlessUri) return;
    try {
      await writeText(vlessUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      navigator.clipboard.writeText(vlessUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-[320px] p-4 flex flex-col items-center gap-3 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <QrCode className="w-4 h-4 text-zinc-300 shrink-0" />
            <h3 className="text-xs font-bold text-white truncate">
              {config.remark || "Server Configuration"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-3 rounded-xl flex items-center justify-center shadow-inner">
          {pathData ? (
            <svg
              viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
              className="w-48 h-48"
              shapeRendering="crispEdges"
            >
              <path d={pathData} fill="#000000" />
            </svg>
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-xs text-zinc-400">
              Generating QR...
            </div>
          )}
        </div>

        {/* Server Host/Port meta */}
        <div className="text-[11px] font-mono text-zinc-400 text-center truncate max-w-full px-1">
          {config.host}:{config.port} ({config.security.toUpperCase()})
        </div>

        {/* Copy Button & Actions */}
        <div className="w-full flex flex-col gap-1.5 pt-1">
          <button
            onClick={handleCopy}
            className="w-full py-2 px-3 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-black" />
                <span>Copied Config!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-black" />
                <span>Copy Config</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
