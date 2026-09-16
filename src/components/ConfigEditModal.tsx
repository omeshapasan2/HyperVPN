import React, { useState, useEffect } from "react";
import { VlessConfig } from "../types/config";
import { parseVlessUri, validateVlessConfig, generateConfigId } from "../utils/vless";
import { X, Sparkles, Check, AlertCircle, Shield, Key, Lock, Eye, EyeOff } from "lucide-react";

interface ConfigEditModalProps {
  isOpen: boolean;
  initialConfig: VlessConfig | null;
  onClose: () => void;
  onSave: (config: VlessConfig) => void;
}

export const ConfigEditModal: React.FC<ConfigEditModalProps> = ({
  isOpen,
  initialConfig,
  onClose,
  onSave,
}) => {
  const isEditing = !!initialConfig;
  const [activeMode, setActiveMode] = useState<"form" | "paste">(isEditing ? "form" : "paste");
  const [pasteUri, setPasteUri] = useState("");
  const [showUuid, setShowUuid] = useState(false);
  const [showPbk, setShowPbk] = useState(false);

  // Form State
  const [formData, setFormData] = useState<VlessConfig>({
    id: generateConfigId(),
    remark: "",
    host: "",
    port: 443,
    uuid: "",
    encryption: "none",
    flow: "xtls-rprx-vision",
    network: "tcp",
    headerType: "none",
    security: "reality",
    fp: "chrome",
    sni: "",
    pbk: "",
    sid: "",
    allowInsecure: false,
    rawOriginal: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (initialConfig) {
      setFormData(initialConfig);
      setActiveMode("form");
    } else {
      setFormData({
        id: generateConfigId(),
        remark: "My VLESS Server",
        host: "",
        port: 443,
        uuid: "",
        encryption: "none",
        flow: "xtls-rprx-vision",
        network: "tcp",
        headerType: "none",
        security: "reality",
        fp: "chrome",
        sni: "",
        pbk: "",
        sid: "",
        allowInsecure: false,
        rawOriginal: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setPasteUri("");
      setActiveMode("paste");
    }
    setErrors([]);
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleParsePaste = () => {
    if (!pasteUri.trim()) {
      setErrors(["Please enter or paste a valid vless:// URI"]);
      return;
    }
    try {
      const parsed = parseVlessUri(pasteUri.trim(), formData.id);
      setFormData(parsed);
      setActiveMode("form");
      setErrors([]);
    } catch (err) {
      setErrors([(err as Error).message || "Failed to parse VLESS URI"]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateVlessConfig(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    onSave({
      ...formData,
      port: Number(formData.port),
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">
              {isEditing ? "Edit VLESS Configuration" : "Add New VLESS Server"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (when creating new) */}
        {!isEditing && (
          <div className="px-6 pt-4 flex gap-2 border-b border-gray-800/80 pb-2">
            <button
              type="button"
              onClick={() => setActiveMode("paste")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeMode === "paste"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Quick Import (vless:// URI)
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("form")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeMode === "form"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              Manual Form Editor
            </button>
          </div>
        )}

        {/* Errors view */}
        {errors.length > 0 && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Please resolve the following issues:</span>
            </div>
            <ul className="list-disc list-inside pl-1 space-y-0.5 text-rose-200">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeMode === "paste" && !isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Paste Share Link / URI
                </label>
                <textarea
                  rows={4}
                  value={pasteUri}
                  onChange={(e) => setPasteUri(e.target.value)}
                  placeholder="vless://00000000-0000-0000-0000-000000000000@example.com:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=example.com&pbk=...&sid=...#MyServer"
                  className="w-full px-3.5 py-2.5 bg-gray-900/80 border border-gray-700/80 rounded-xl text-xs text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={handleParsePaste}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Parse & Inspect Config
              </button>
            </div>
          ) : (
            <form id="config-form" onSubmit={handleFormSubmit} className="space-y-4">
              {/* Remark / Display Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Server Name / Remark
                </label>
                <input
                  type="text"
                  required
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="e.g. Frankfurt XTLS Reality"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Host and Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Server Address / Host
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="e.g. 198.51.100.1 or vpn.example.com"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 443 })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* UUID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-300">Client UUID</label>
                  <button
                    type="button"
                    onClick={() => setShowUuid(!showUuid)}
                    className="text-[11px] text-gray-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {showUuid ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showUuid ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showUuid ? "text" : "password"}
                  required
                  value={formData.uuid}
                  onChange={(e) => setFormData({ ...formData, uuid: e.target.value })}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Security & Flow */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Security Layer
                  </label>
                  <select
                    value={formData.security}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        security: e.target.value as "tls" | "reality" | "none",
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="reality">XTLS Reality</option>
                    <option value="tls">Standard TLS</option>
                    <option value="none">None (Plain)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Flow</label>
                  <select
                    value={formData.flow || "none"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        flow: e.target.value === "none" ? undefined : e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="xtls-rprx-vision">xtls-rprx-vision (Vision)</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              {/* SNI and Fingerprint */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    SNI / Decoy Domain
                  </label>
                  <input
                    type="text"
                    value={formData.sni || ""}
                    onChange={(e) => setFormData({ ...formData, sni: e.target.value })}
                    placeholder="e.g. www.cloudflare.com"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Fingerprint
                  </label>
                  <select
                    value={formData.fp || "chrome"}
                    onChange={(e) => setFormData({ ...formData, fp: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="chrome">Chrome</option>
                    <option value="firefox">Firefox</option>
                    <option value="safari">Safari</option>
                    <option value="edge">Edge</option>
                    <option value="random">Random</option>
                    <option value="randomized">Randomized</option>
                  </select>
                </div>
              </div>

              {/* Reality Specific fields: pbk & sid */}
              {formData.security === "reality" && (
                <div className="space-y-3 p-3 bg-purple-950/20 border border-purple-900/40 rounded-xl">
                  <div className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Reality Handshake Keys
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-300">
                        Public Key (pbk)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPbk(!showPbk)}
                        className="text-[11px] text-gray-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        {showPbk ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showPbk ? "Hide" : "Show"}
                      </button>
                    </div>
                    <input
                      type={showPbk ? "text" : "password"}
                      required
                      value={formData.pbk || ""}
                      onChange={(e) => setFormData({ ...formData, pbk: e.target.value })}
                      placeholder="Base64 URL-safe Public Key"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Short ID (sid)
                    </label>
                    <input
                      type="text"
                      value={formData.sid || ""}
                      onChange={(e) => setFormData({ ...formData, sid: e.target.value })}
                      placeholder="Hexadecimal short ID (optional)"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Allow Insecure Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowInsecure"
                  checked={formData.allowInsecure || false}
                  onChange={(e) =>
                    setFormData({ ...formData, allowInsecure: e.target.checked })
                  }
                  className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                />
                <label htmlFor="allowInsecure" className="text-xs text-gray-300 cursor-pointer">
                  Allow Insecure Decoy TLS (ignores cert verification for custom SNIs)
                </label>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          {activeMode === "form" && (
            <button
              type="submit"
              form="config-form"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {isEditing ? "Save Changes" : "Save Config"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
