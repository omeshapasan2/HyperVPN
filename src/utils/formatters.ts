/**
 * Formats a byte number into human-readable string (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "0.00 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, clampedIndex)).toFixed(dm))} ${sizes[clampedIndex]}`;
}

/**
 * Formats speed in bytes/second to human-readable string
 */
export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || isNaN(bytesPerSec) || bytesPerSec <= 0) return "0.0 KB/s";
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

/**
 * Formats seconds into HH:MM:SS format
 */
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats a timestamp into a localized readable date string
 */
export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats a timestamp into time string HH:MM:SS
 */
export function formatTime(timestamp: number | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Formats ping latency
 */
export function formatLatency(ms?: number | null): { text: string; color: string } {
  if (ms === undefined || ms === null) {
    return { text: "--", color: "text-gray-400" };
  }
  if (ms < 0) {
    return { text: "Timeout", color: "text-red-400" };
  }
  if (ms < 100) {
    return { text: `${ms} ms`, color: "text-emerald-400" };
  }
  if (ms < 250) {
    return { text: `${ms} ms`, color: "text-amber-400" };
  }
  return { text: `${ms} ms`, color: "text-rose-400" };
}
