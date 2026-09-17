import React, { useState, useEffect } from "react";
import { VlessConfig } from "../types/config";
import { parseVlessUri, validateVlessConfig, generateConfigId } from "../utils/vless";
import { X, Sparkles, Check, AlertCircle, Eye, EyeOff } from "lucide-react";

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
    if (!isOpen) return;

    // Check if an existing draft exists in localStorage
    const savedDraftJson = localStorage.getItem("hypervpn_draft_modal_form");
    const savedMode = localStorage.getItem("hypervpn_draft_modal_mode") as "form" | "paste" | null;
    const savedPasteUri = localStorage.getItem("hypervpn_draft_modal_paste_uri");

    let loadedFromDraft = false;

    if (savedDraftJson) {
      try {
        const draft = JSON.parse(savedDraftJson) as VlessConfig;
        if (initialConfig && draft.id === initialConfig.id) {
          setFormData(draft);
          loadedFromDraft = true;
        } else if (!initialConfig && (!draft.rawOriginal || draft.id)) {
          setFormData(draft);
          loadedFromDraft = true;
        }
      } catch {}
    }

    if (savedPasteUri) {
      setPasteUri(savedPasteUri);
    } else {
      setPasteUri("");
    }

    if (savedMode) {
      setActiveMode(savedMode);
    } else {
      setActiveMode(initialConfig ? "form" : "paste");
    }

    if (!loadedFromDraft) {
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
      }
    }
    setErrors([]);
  }, [initialConfig, isOpen]);

  // Persist in-progress drafts while modal is open
  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem("hypervpn_draft_modal_form", JSON.stringify(formData));
        localStorage.setItem("hypervpn_draft_modal_mode", activeMode);
        localStorage.setItem("hypervpn_draft_modal_paste_uri", pasteUri);
      } catch {}
    }
  }, [isOpen, formData, activeMode, pasteUri]);

  const clearModalDrafts = () => {
    try {
      localStorage.removeItem("hypervpn_draft_modal_form");
      localStorage.removeItem("hypervpn_draft_modal_mode");
      localStorage.removeItem("hypervpn_draft_modal_paste_uri");
    } catch {}
  };

  const handleClose = () => {
    clearModalDrafts();
    onClose();
  };

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

    clearModalDrafts();
    onSave({
      ...formData,
      port: Number(formData.port),
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-[350px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <h2 className="text-xs font-bold text-white">
            {isEditing ? "Edit Server" : "Add Server"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Selector Tabs (when creating new) */}
        {!isEditing && (
          <div className="px-3.5 pt-2 flex gap-1.5 border-b border-zinc-800/80 pb-2">
            <button
              type="button"
              onClick={() => setActiveMode("paste")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                activeMode === "paste"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Import URI
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("form")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                activeMode === "form"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Manual Form
            </button>
          </div>
        )}

        {/* Errors view */}
        {errors.length > 0 && (
          <div className="mx-3.5 mt-2.5 p-2 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-300 text-[11px] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Issues:</span>
            </div>
            <ul className="list-disc list-inside pl-1 space-y-0.5 text-zinc-400">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Body Content */}
        <div className="p-3.5 overflow-y-auto space-y-2.5 flex-1">
          {activeMode === "paste" && !isEditing ? (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  VLESS Share Link
                </label>
                <textarea
                  rows={4}
                  value={pasteUri}
                  onChange={(e) => setPasteUri(e.target.value)}
                  placeholder="vless://..."
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>
              <button
                type="button"
                onClick={handleParsePaste}
                className="w-full py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Parse URI
              </button>
            </div>
          ) : (
            <form id="config-form" onSubmit={handleFormSubmit} className="space-y-2.5">
              {/* Remark */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                  Name / Remark
                </label>
                <input
                  type="text"
                  required
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="Server Name"
                  className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Host and Port */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                    Host
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="198.51.100.1"
                    className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 443 })}
                    className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              {/* UUID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-zinc-400">Client UUID</label>
                  <button
                    type="button"
                    onClick={() => setShowUuid(!showUuid)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5"
                  >
                    {showUuid ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    {showUuid ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showUuid ? "text" : "password"}
                  required
                  value={formData.uuid}
                  onChange={(e) => setFormData({ ...formData, uuid: e.target.value })}
                  placeholder="UUID"
                  className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Security & Flow */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                    Security
                  </label>
                  <select
                    value={formData.security}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        security: e.target.value as "tls" | "reality" | "none",
                      })
                    }
                    className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-500"
                  >
                    <option value="reality">Reality</option>
                    <option value="tls">TLS</option>
                    <option value="none">None</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1">Flow</label>
                  <select
                    value={formData.flow || "none"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        flow: e.target.value === "none" ? undefined : e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-500"
                  >
                    <option value="xtls-rprx-vision">Vision</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              {/* SNI and Fingerprint */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                    SNI / Decoy
                  </label>
                  <input
                    type="text"
                    value={formData.sni || ""}
                    onChange={(e) => setFormData({ ...formData, sni: e.target.value })}
                    placeholder="www.cloudflare.com"
                    className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1">
                    Fingerprint
                  </label>
                  <select
                    value={formData.fp || "chrome"}
                    onChange={(e) => setFormData({ ...formData, fp: e.target.value })}
                    className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-500"
                  >
                    <option value="chrome">Chrome</option>
                    <option value="firefox">Firefox</option>
                    <option value="safari">Safari</option>
                    <option value="randomized">Random</option>
                  </select>
                </div>
              </div>

              {/* Reality Specific fields: pbk & sid */}
              {formData.security === "reality" && (
                <div className="space-y-2 p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] font-medium text-zinc-400">
                        Public Key (pbk)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPbk(!showPbk)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5"
                      >
                        {showPbk ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                        {showPbk ? "Hide" : "Show"}
                      </button>
                    </div>
                    <input
                      type={showPbk ? "text" : "password"}
                      required
                      value={formData.pbk || ""}
                      onChange={(e) => setFormData({ ...formData, pbk: e.target.value })}
                      placeholder="Public Key"
                      className="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-0.5">
                      Short ID (sid)
                    </label>
                    <input
                      type="text"
                      value={formData.sid || ""}
                      onChange={(e) => setFormData({ ...formData, sid: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Allow Insecure Checkbox */}
              <label className="flex items-center gap-2 pt-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="allowInsecure"
                  checked={formData.allowInsecure || false}
                  onChange={(e) =>
                    setFormData({ ...formData, allowInsecure: e.target.checked })
                  }
                  className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-white focus:ring-0 accent-white"
                />
                <span className="text-[11px] text-zinc-400">
                  Allow Insecure Decoy TLS
                </span>
              </label>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2.5 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          {activeMode === "form" && (
            <button
              type="submit"
              form="config-form"
              className="px-3 py-1 rounded-lg text-xs font-bold bg-white hover:bg-zinc-200 text-black transition-colors flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
