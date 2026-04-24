import Icon from "@/components/ui/icon";
import { LogLevel, NickStatus, TabId, STATUS_LABELS, TABS } from "./types";

interface AppHeaderProps {
  targetNick: string;
  setTargetNick: (v: string) => void;
  nickStatus: NickStatus;
  isRunning: boolean;
  totalRequests: number;
  captureAttempts: number;
  notification: { text: string; type: LogLevel } | null;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onStart: () => void;
  onStop: () => void;
}

export default function AppHeader({
  targetNick,
  setTargetNick,
  nickStatus,
  isRunning,
  totalRequests,
  captureAttempts,
  notification,
  activeTab,
  setActiveTab,
  onStart,
  onStop,
}: AppHeaderProps) {
  const statusColor = {
    free: "status-free",
    busy: "status-busy",
    checking: "status-checking",
    idle: "status-idle",
    unknown: "status-idle",
  }[nickStatus];

  return (
    <>
      <header className="border-b border-border px-6 py-3 flex items-center justify-between" style={{ background: "hsl(220 13% 7%)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="w-px h-5 bg-border mx-2" />
          <span className="mono text-sm font-semibold tracking-widest text-zinc-300">NICKSNIPER</span>
          <span className="mono text-xs text-zinc-600 ml-1">v1.0</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">ЦЕЛ:</span>
            <span className="mono text-sm font-semibold text-zinc-200">{targetNick || "—"}</span>
            <div className={`status-dot ${statusColor} ${nickStatus === "checking" ? "blink" : ""} ${nickStatus === "free" ? "pulse-green" : ""}`} />
            <span className={`mono text-xs font-medium ${nickStatus === "free" ? "text-green-400" : nickStatus === "busy" ? "text-red-400" : nickStatus === "checking" ? "text-yellow-400" : "text-zinc-500"}`}>
              {STATUS_LABELS[nickStatus]}
            </span>
          </div>

          <div className="w-px h-5 bg-border" />

          <div className="flex items-center gap-4 text-xs mono text-zinc-500">
            <span>REQ: <span className="text-zinc-300">{totalRequests}</span></span>
            <span>ЗАХВАТОВ: <span className="text-zinc-300">{captureAttempts}</span></span>
          </div>

          <div className="w-px h-5 bg-border" />

          {!isRunning ? (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold mono rounded-sm transition-all"
              style={{ background: "hsl(var(--primary))", color: "hsl(220 13% 9%)" }}
            >
              <Icon name="Play" size={12} />
              СТАРТ
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold mono rounded-sm border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Icon name="Square" size={12} />
              СТОП
            </button>
          )}
        </div>
      </header>

      {notification && (
        <div className={`slide-in mx-6 mt-3 px-4 py-2 rounded-sm border mono text-xs flex items-center gap-2 ${
          notification.type === "success" ? "border-green-500/40 bg-green-500/10 text-green-400" :
          notification.type === "error" ? "border-red-500/40 bg-red-500/10 text-red-400" :
          notification.type === "warn" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" :
          "border-blue-500/40 bg-blue-500/10 text-blue-400"
        }`}>
          <Icon name={notification.type === "success" ? "CheckCircle" : notification.type === "error" ? "XCircle" : "AlertTriangle"} size={12} />
          {notification.text}
        </div>
      )}

      <div className="mx-6 mt-3 panel flex items-center gap-0">
        <div className="panel-header border-b-0 border-r w-32 shrink-0">
          <span className="text-xs text-zinc-500 mono font-medium">ЦЕЛЬ</span>
        </div>
        <input
          type="text"
          value={targetNick}
          onChange={e => setTargetNick(e.target.value)}
          placeholder="Введите ник для захвата..."
          className="flex-1 bg-transparent px-4 py-2 text-sm mono text-zinc-200 placeholder-zinc-600 outline-none"
        />
        <div className="px-4 border-l border-border">
          <span className="mono text-xs text-zinc-600">целевой никнейм</span>
        </div>
      </div>

      <div className="mx-6 mt-3 border-b border-border flex gap-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium mono transition-all border-b-2 ${
              activeTab === tab.id
                ? "text-green-400 border-green-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon name={tab.icon} size={13} />
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}
