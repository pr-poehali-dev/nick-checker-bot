export type LogLevel = "info" | "success" | "error" | "warn" | "system";
export type NickStatus = "free" | "busy" | "checking" | "idle" | "unknown";
export type TabId = "checkers" | "main" | "proxy" | "interval" | "logs";

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

export interface Character {
  id: number;
  recoveryCode: string;
  nickname: string;
  status: "active" | "idle" | "error" | "checking";
  lastChecked: string;
  requestCount: number;
  proxyIndex: number;
}

export interface ProxyEntry {
  id: number;
  value: string;
  status: "active" | "dead" | "unknown";
  uses: number;
}

export const LEVEL_COLORS: Record<LogLevel, string> = {
  info: "text-blue-400",
  success: "text-green-400",
  error: "text-red-400",
  warn: "text-yellow-400",
  system: "text-zinc-500",
};

export const LEVEL_PREFIX: Record<LogLevel, string> = {
  info: "[INFO]",
  success: "[OK]  ",
  error: "[ERR] ",
  warn: "[WARN]",
  system: "[SYS] ",
};

export const STATUS_LABELS: Record<NickStatus, string> = {
  free: "СВОБОДЕН",
  busy: "ЗАНЯТ",
  checking: "ПРОВЕРКА...",
  idle: "ОЖИДАНИЕ",
  unknown: "НЕИЗВЕСТНО",
};

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "checkers", label: "Прочек", icon: "Search" },
  { id: "main", label: "Основной", icon: "User" },
  { id: "proxy", label: "Прокси", icon: "Globe" },
  { id: "interval", label: "Интервал", icon: "Timer" },
  { id: "logs", label: "Логи", icon: "Terminal" },
];

export const GALAXY_PROXY_URL = "https://functions.poehali.dev/6c6e6654-a6af-419e-bb02-dc05d0258255";

/**
 * Парсит код восстановления Galaxy.
 * Форматы: "userID:password" или "userID password" или просто "password" (без userID).
 */
export function parseRecoveryCode(code: string): { userID: string; password: string } | null {
  const s = code.trim();
  if (!s) return null;
  if (s.includes(":")) {
    const idx = s.indexOf(":");
    return { userID: s.slice(0, idx), password: s.slice(idx + 1) };
  }
  if (s.includes(" ")) {
    const parts = s.split(/\s+/);
    if (parts.length >= 2) return { userID: parts[0], password: parts[1] };
  }
  return null;
}