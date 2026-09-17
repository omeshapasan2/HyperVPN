export type SecurityType = "tls" | "reality" | "none";
export type NetworkType = "tcp" | "ws" | "grpc" | "http";

export interface VlessConfig {
  id: string;
  remark: string;
  uuid: string;
  host: string;
  port: number;
  encryption: string;
  flow?: string;
  network: NetworkType;
  headerType: string;
  security: SecurityType;
  fp: string;
  sni: string;
  pbk?: string;
  sid?: string;
  allowInsecure: boolean;
  rawOriginal: string;
  latency?: number | null;
  lastTested?: number;
  createdAt: number;
  updatedAt: number;
}

export interface VpnStatus {
  connected: boolean;
  activeConfigId: string | null;
  connecting: boolean;
  uptimeSeconds: number;
  sessionBytesUplink: number;
  sessionBytesDownlink: number;
  currentUploadSpeed: number; // bytes/sec
  currentDownloadSpeed: number; // bytes/sec
  error?: string | null;
}

export interface UsageHistory {
  daily: Record<string, number>; // "YYYY-MM-DD" -> bytes
  monthly: Record<string, number>; // "YYYY-MM" -> bytes
}

export interface AppSettings {
  autoStart: boolean;
  autoConnectOnLaunch: boolean;
  minimizeToTrayOnClose: boolean;
  socksPort: number;
  statsPort: number;
  customLanExclusions: string[];
  defaultIsp: "slt" | "dialog";
  slt: {
    subscriberId: string;
    token: string;
    clientId: string;
  };
  dialog: {
    msisdn: string;
    uuid: string;
    cookie: string;
    selectedUsageTypeIndex: number;
  };
}

export interface IspVerifyResult {
  provider: "slt" | "dialog";
  timestamp: number;
  remainingText: string;
  remainingBytes?: number;
  packageName?: string;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface SltVasBundleItem {
  name: string;
  packageId?: string;
  totalData: string;
  usedData: string;
  remainingData: string;
  percentage: number;
  isEntertainment: boolean;
  validTill?: string;
}

export interface SltPackageUsageDetail {
  name: string;
  limit: string;
  used: string;
  remaining: string;
  volumeUnit: string;
  percentage: number;
  expiryDate?: string;
}

export interface SltPrimaryPackageData {
  packageName: string;
  status?: string;
  reportedTime?: string;
  usageDetails: SltPackageUsageDetail[];
  totalLimit: string;
  totalUsed: string;
  totalRemaining: string;
  volumeUnit: string;
}

export interface SltVasBundleData {
  name: string;
  used: string;
  limit?: string;
  remaining?: string;
  volumeUnit: string;
  percentage: number;
  expiryDate?: string;
  subscriptionId?: string;
  isEntertainment: boolean;
}

export interface SltUsageResponse {
  primaryPackage?: SltPrimaryPackageData;
  vasBundles: SltVasBundleData[];
  reportedTime?: string;
  status?: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
}

export interface BinaryItemStatus {
  name: string;
  description: string;
  currentVersion: string | null;
  latestVersion: string;
  exists: boolean;
  path: string | null;
  hasUpdate: boolean;
  sizeBytes: number | null;
  sha256: string | null;
  url: string;
}

export interface BinariesUpdateCheckResult {
  hasUpdate: boolean;
  manifestVersion: string;
  binaries: BinaryItemStatus[];
  checkTime: string;
}

export interface BinaryUpdateProgress {
  stage: "checking" | "downloading" | "extracting" | "verifying" | "installing" | "reconnecting" | "complete" | "error";
  currentItem: string;
  currentPercent: number;
  message: string;
  totalItems: number;
  completedItems: number;
}

export interface LogEntry {
  id: string;
  source: "xray" | "tun2socks" | "system";
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: number;
}
