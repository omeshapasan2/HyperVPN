import { VlessConfig, SecurityType, NetworkType } from "../types/config";

/**
 * Generate a unique ID for a saved config
 */
export function generateConfigId(): string {
  return "cfg_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
}

/**
 * Parses a standard vless:// URI string into a structured VlessConfig object.
 */
export function parseVlessUri(rawUri: string, existingId?: string): VlessConfig {
  const trimmed = rawUri.trim();
  if (!trimmed.toLowerCase().startsWith("vless://")) {
    throw new Error("Invalid URI: Must start with 'vless://'");
  }

  // Split out the remark fragment after '#'
  const hashIndex = trimmed.indexOf("#");
  let uriWithoutHash = trimmed;
  let remark = "";

  if (hashIndex !== -1) {
    uriWithoutHash = trimmed.substring(0, hashIndex);
    const rawRemark = trimmed.substring(hashIndex + 1);
    try {
      remark = decodeURIComponent(rawRemark).trim();
    } catch {
      remark = rawRemark.trim();
    }
  }

  // Standard URL parsing: replace vless:// with http:// to leverage URL parser
  const parseableUrl = uriWithoutHash.replace(/^vless:\/\//i, "http://");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(parseableUrl);
  } catch (err) {
    throw new Error(`Failed to parse VLESS URI: ${(err as Error).message}`);
  }

  const uuid = parsedUrl.username;
  if (!uuid) {
    throw new Error("Invalid VLESS URI: Missing UUID (userinfo before @)");
  }

  const host = parsedUrl.hostname;
  if (!host) {
    throw new Error("Invalid VLESS URI: Missing host");
  }

  const port = parseInt(parsedUrl.port, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid VLESS URI: Invalid port '${parsedUrl.port}'`);
  }

  const params = parsedUrl.searchParams;

  const encryption = params.get("encryption") || "none";
  const rawFlow = params.get("flow");
  const flow = rawFlow && rawFlow.toLowerCase() !== "none" && rawFlow.trim() !== "" ? rawFlow.trim() : undefined;
  const network = (params.get("type") || "tcp") as NetworkType;
  const headerType = params.get("headerType") || "none";

  let securityRaw = (params.get("security") || "").toLowerCase();
  const pbk = params.get("pbk") || undefined;
  const sid = params.get("sid") || undefined;

  let security: SecurityType = "none";
  if (securityRaw === "reality" || pbk) {
    security = "reality";
  } else if (securityRaw === "tls") {
    security = "tls";
  }

  const fp = params.get("fp") || "chrome";
  const sni = params.get("sni") || host;
  const path = params.get("path") || undefined;

  if (!remark) {
    remark = `${host}:${port}`;
  }

  const now = Date.now();

  return {
    id: existingId || generateConfigId(),
    remark,
    uuid,
    host,
    port,
    encryption,
    flow,
    network,
    headerType,
    security,
    fp,
    sni,
    pbk,
    sid,
    path,
    allowInsecure: false, // Default to false, can be toggled by user
    rawOriginal: trimmed,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Serializes a VlessConfig object back into a standard vless:// URI string.
 */
export function serializeVlessUri(config: VlessConfig): string {
  const {
    uuid,
    host,
    port,
    encryption,
    flow,
    network,
    headerType,
    security,
    fp,
    sni,
    pbk,
    sid,
    path,
    remark,
  } = config;

  const searchParams = new URLSearchParams();

  searchParams.set("encryption", encryption || "none");
  if (flow && flow !== "none" && flow.trim() !== "") {
    searchParams.set("flow", flow.trim());
  }
  searchParams.set("type", network || "tcp");
  searchParams.set("headerType", headerType || "none");
  searchParams.set("security", security || "none");
  searchParams.set("fp", fp || "chrome");
  if (sni) {
    searchParams.set("sni", sni);
  }
  if (path) {
    searchParams.set("path", path);
  }
  if (security === "reality") {
    if (pbk) searchParams.set("pbk", pbk);
    if (sid) searchParams.set("sid", sid);
  }

  const queryString = searchParams.toString();
  const encodedRemark = encodeURIComponent(remark);

  return `vless://${uuid}@${host}:${port}?${queryString}#${encodedRemark}`;
}

/**
 * Validates a config object
 */
export function validateVlessConfig(config: Partial<VlessConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.remark || !config.remark.trim()) {
    errors.push("Remark / Display Name is required");
  }
  if (!config.uuid || !config.uuid.trim()) {
    errors.push("UUID is required");
  }
  if (!config.host || !config.host.trim()) {
    errors.push("Host is required");
  }
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push("Valid port (1-65535) is required");
  }
  if (config.security === "reality") {
    if (!config.pbk || !config.pbk.trim()) {
      errors.push("Public Key (pbk) is required for Reality security");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
