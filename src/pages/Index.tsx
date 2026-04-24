import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

type LogLevel = "info" | "success" | "error" | "warn" | "system";
type NickStatus = "free" | "busy" | "checking" | "idle" | "unknown";
type TabId = "checkers" | "main" | "proxy" | "interval" | "logs";

interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

interface Character {
  id: number;
  recoveryCode: string;
  nickname: string;
  status: "active" | "idle" | "error" | "checking";
  lastChecked: string;
  requestCount: number;
  proxyIndex: number;
}

interface ProxyEntry {
  id: number;
  value: string;
  status: "active" | "dead" | "unknown";
  uses: number;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: "text-blue-400",
  success: "text-green-400",
  error: "text-red-400",
  warn: "text-yellow-400",
  system: "text-zinc-500",
};

const LEVEL_PREFIX: Record<LogLevel, string> = {
  info: "[INFO]",
  success: "[OK]  ",
  error: "[ERR] ",
  warn: "[WARN]",
  system: "[SYS] ",
};

const STATUS_LABELS: Record<NickStatus, string> = {
  free: "СВОБОДЕН",
  busy: "ЗАНЯТ",
  checking: "ПРОВЕРКА...",
  idle: "ОЖИДАНИЕ",
  unknown: "НЕИЗВЕСТНО",
};

let logIdCounter = 1;

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabId>("checkers");
  const [targetNick, setTargetNick] = useState("GalaxyKing");
  const [nickStatus, setNickStatus] = useState<NickStatus>("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(200);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [captureAttempts, setCaptureAttempts] = useState(0);
  const [notification, setNotification] = useState<{ text: string; type: LogLevel } | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const runIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestCountRef = useRef(0);

  const [checkers, setCheckers] = useState<Character[]>([
    { id: 1, recoveryCode: "", nickname: "Checker_1", status: "idle", lastChecked: "—", requestCount: 0, proxyIndex: 0 },
    { id: 2, recoveryCode: "", nickname: "Checker_2", status: "idle", lastChecked: "—", requestCount: 0, proxyIndex: 1 },
  ]);

  const [mainChar, setMainChar] = useState<Character>({
    id: 0, recoveryCode: "", nickname: "MainChar", status: "idle", lastChecked: "—", requestCount: 0, proxyIndex: -1,
  });

  const [proxyList, setProxyList] = useState<ProxyEntry[]>([
    { id: 1, value: "", status: "unknown", uses: 0 },
    { id: 2, value: "", status: "unknown", uses: 0 },
  ]);
  const [proxyText, setProxyText] = useState("");

  const nowTime = () => new Date().toLocaleTimeString("ru-RU", { hour12: false });

  const addLog = useCallback((message: string, level: LogLevel = "info") => {
    const entry: LogEntry = { id: logIdCounter++, time: nowTime(), level, message };
    setLogs(prev => [...prev.slice(-499), entry]);
  }, []);

  const showNotification = useCallback((text: string, type: LogLevel = "info") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const simulateCheck = useCallback(() => {
    requestCountRef.current++;
    setTotalRequests(r => r + 1);
    const checkTime = nowTime();

    setCheckers(prev => prev.map((c) => ({
      ...c,
      status: "checking" as const,
      lastChecked: checkTime,
    })));

    const proxyAddr = proxyList[requestCountRef.current % Math.max(proxyList.length, 1)]?.value || "127.0.0.1:8080";

    setTimeout(() => {
      const isFree = Math.random() < 0.08;
      const newStatus: NickStatus = isFree ? "free" : "busy";
      setNickStatus(newStatus);
      setCheckers(prev => prev.map(c => ({ ...c, status: "active" as const })));

      if (isFree) {
        addLog(`Ник "${targetNick}" СВОБОДЕН! Запускаю захват...`, "success");
        showNotification(`Ник "${targetNick}" свободен! Захват...`, "success");
        setCaptureAttempts(a => a + 1);
        setCheckers(prev => prev.map(c => ({ ...c, status: "idle" as const })));

        if (runIntervalRef.current) {
          clearInterval(runIntervalRef.current);
          runIntervalRef.current = null;
          setIsRunning(false);
        }

        setTimeout(() => {
          const captured = Math.random() > 0.3;
          if (captured) {
            addLog(`Ник "${targetNick}" успешно занят основным персонажем!`, "success");
            showNotification(`Ник "${targetNick}" захвачен!`, "success");
          } else {
            addLog(`Не удалось занять ник "${targetNick}" — опередили.`, "error");
            showNotification(`Не удалось захватить — опередили.`, "error");
          }
        }, Math.random() * 300 + 50);
      } else {
        if (requestCountRef.current % 20 === 0) {
          addLog(`[#${requestCountRef.current}] ${targetNick} — занят. Прокси: ${proxyAddr}`, "system");
        }
      }
    }, Math.random() * 80 + 20);
  }, [targetNick, proxyList, addLog, showNotification]);

  const startMonitor = () => {
    if (!targetNick.trim()) {
      showNotification("Введите целевой ник", "warn");
      return;
    }
    if (!mainChar.recoveryCode.trim()) {
      showNotification("Введите код восстановления основного персонажа", "warn");
      addLog("Запуск отменён: не указан код восстановления основного персонажа", "warn");
      return;
    }
    addLog(`Запуск мониторинга ника "${targetNick}" | интервал: ${intervalMs}мс`, "system");
    addLog(`Персонажи прочека: ${checkers.filter(c => c.recoveryCode).length} активных`, "info");
    setIsRunning(true);
    setNickStatus("checking");
    runIntervalRef.current = setInterval(simulateCheck, intervalMs);
  };

  const stopMonitor = () => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
    setIsRunning(false);
    setNickStatus("idle");
    addLog("Мониторинг остановлен пользователем", "warn");
  };

  useEffect(() => {
    return () => {
      if (runIntervalRef.current) clearInterval(runIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (isRunning) {
      if (runIntervalRef.current) clearInterval(runIntervalRef.current);
      runIntervalRef.current = setInterval(simulateCheck, intervalMs);
    }
  }, [intervalMs, isRunning, simulateCheck]);

  const clearLogs = () => {
    setLogs([]);
    addLog("Лог очищен", "system");
  };

  const exportLogs = () => {
    const content = logs.map(l => `${l.time} ${LEVEL_PREFIX[l.level]} ${l.message}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nicksniper_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Лог сохранён в файл", "success");
  };

  const saveProxies = () => {
    const lines = proxyText.split("\n").filter(l => l.trim());
    setProxyList(lines.map((v, i) => ({ id: i + 1, value: v.trim(), status: "unknown" as const, uses: 0 })));
    addLog(`Загружено ${lines.length} прокси`, "success");
    showNotification(`Загружено ${lines.length} прокси`, "success");
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "checkers", label: "Прочек", icon: "Search" },
    { id: "main", label: "Основной", icon: "User" },
    { id: "proxy", label: "Прокси", icon: "Globe" },
    { id: "interval", label: "Интервал", icon: "Timer" },
    { id: "logs", label: "Логи", icon: "Terminal" },
  ];

  const statusColor = {
    free: "status-free",
    busy: "status-busy",
    checking: "status-checking",
    idle: "status-idle",
    unknown: "status-idle",
  }[nickStatus];

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
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
              onClick={startMonitor}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold mono rounded-sm transition-all"
              style={{ background: "hsl(var(--primary))", color: "hsl(220 13% 9%)" }}
            >
              <Icon name="Play" size={12} />
              СТАРТ
            </button>
          ) : (
            <button
              onClick={stopMonitor}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold mono rounded-sm border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Icon name="Square" size={12} />
              СТОП
            </button>
          )}
        </div>
      </header>

      {/* Notification */}
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

      {/* Target Nick Bar */}
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

      {/* Tabs */}
      <div className="mx-6 mt-3 border-b border-border flex gap-0">
        {tabs.map(tab => (
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

      {/* Content */}
      <div className="flex-1 mx-6 mt-4 mb-6">

        {/* CHECKERS TAB */}
        {activeTab === "checkers" && (
          <div className="slide-in space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-zinc-500 mono">Персонажи для проверки ника. Каждый запрос — новый прокси.</p>
              <button
                onClick={() => setCheckers(prev => [...prev, {
                  id: Date.now(), recoveryCode: "", nickname: `Checker_${prev.length + 1}`,
                  status: "idle" as const, lastChecked: "—", requestCount: 0, proxyIndex: 0
                }])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs mono rounded-sm border border-border text-zinc-400 hover:border-green-500/50 hover:text-green-400 transition-all"
              >
                <Icon name="Plus" size={12} />
                Добавить персонажа
              </button>
            </div>

            <div className="grid gap-2">
              {checkers.map((char, idx) => (
                <div key={char.id} className="panel">
                  <div className="panel-header justify-between">
                    <div className="flex items-center gap-3">
                      <span className="mono text-xs text-zinc-600">#{idx + 1}</span>
                      <div className={`status-dot ${char.status === "checking" ? "status-checking blink" : char.status === "active" ? "status-free" : char.status === "error" ? "status-busy" : "status-idle"}`} />
                      <input
                        value={char.nickname}
                        onChange={e => setCheckers(prev => prev.map(c => c.id === char.id ? { ...c, nickname: e.target.value } : c))}
                        className="bg-transparent mono text-sm font-medium text-zinc-300 outline-none w-32 border-b border-transparent hover:border-zinc-700 focus:border-green-500 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-4 text-xs mono text-zinc-600">
                      <span>REQ: <span className="text-zinc-400">{char.requestCount}</span></span>
                      <span>Последний: <span className="text-zinc-400">{char.lastChecked}</span></span>
                      <button
                        onClick={() => setCheckers(prev => prev.filter(c => c.id !== char.id))}
                        className="text-zinc-700 hover:text-red-400 transition-colors ml-2"
                      >
                        <Icon name="Trash2" size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <Icon name="KeyRound" size={14} className="text-zinc-600 shrink-0" />
                    <input
                      type="password"
                      value={char.recoveryCode}
                      onChange={e => setCheckers(prev => prev.map(c => c.id === char.id ? { ...c, recoveryCode: e.target.value } : c))}
                      placeholder="Код восстановления..."
                      className="flex-1 bg-input border border-border rounded-sm px-3 py-1.5 text-sm mono text-zinc-300 placeholder-zinc-700 outline-none focus:border-green-500/50 transition-colors"
                    />
                    <div className="flex items-center gap-2 text-xs mono">
                      <span className="text-zinc-600">Прокси:</span>
                      <span className="text-zinc-400 bg-secondary px-2 py-0.5 rounded-sm mono text-xs">
                        {proxyList[char.proxyIndex % Math.max(proxyList.filter(p=>p.value).length, 1)]?.value || "не задан"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAIN TAB */}
        {activeTab === "main" && (
          <div className="slide-in space-y-4">
            <p className="text-xs text-zinc-500 mono mb-4">Основной персонаж, который будет занимать ник при освобождении.</p>
            <div className="panel max-w-xl">
              <div className="panel-header">
                <div className={`status-dot ${mainChar.status === "active" ? "status-free pulse-green" : "status-idle"}`} />
                <span className="mono text-sm font-semibold text-zinc-300">Основной персонаж</span>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs mono text-zinc-500 mb-1.5">ИМЯ / ОПИСАНИЕ</label>
                  <input
                    value={mainChar.nickname}
                    onChange={e => setMainChar(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder="Название персонажа..."
                    className="w-full bg-input border border-border rounded-sm px-3 py-2 text-sm mono text-zinc-300 placeholder-zinc-700 outline-none focus:border-green-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs mono text-zinc-500 mb-1.5 flex items-center gap-1.5">
                    <Icon name="KeyRound" size={12} />
                    КОД ВОССТАНОВЛЕНИЯ
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={mainChar.recoveryCode}
                    onChange={e => setMainChar(prev => ({ ...prev, recoveryCode: e.target.value }))}
                    placeholder="Обязательное поле..."
                    className={`w-full bg-input border rounded-sm px-3 py-2 text-sm mono text-zinc-300 placeholder-zinc-700 outline-none transition-colors ${
                      !mainChar.recoveryCode ? "border-red-500/30 focus:border-red-500/60" : "border-border focus:border-green-500/50"
                    }`}
                  />
                  {!mainChar.recoveryCode && (
                    <p className="text-xs text-red-400/70 mono mt-1">⚠ Требуется для захвата ника</p>
                  )}
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs mono text-zinc-600">
                    <span>Запросов на смену ника: <span className="text-zinc-400">{mainChar.requestCount}</span></span>
                    <span>Последнее действие: <span className="text-zinc-400">{mainChar.lastChecked}</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel max-w-xl p-4">
              <div className="text-xs mono text-zinc-500 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-400 mb-2"><Icon name="Info" size={13} /> Порядок захвата</div>
                <div>1. Персонажи прочека отслеживают доступность ника «{targetNick}»</div>
                <div>2. При обнаружении свободного ника — мгновенный запрос на смену</div>
                <div>3. Основной персонаж отправляет запрос через свой код восстановления</div>
                <div>4. Результат фиксируется в логах</div>
              </div>
            </div>
          </div>
        )}

        {/* PROXY TAB */}
        {activeTab === "proxy" && (
          <div className="slide-in">
            <p className="text-xs text-zinc-500 mono mb-4">Список прокси для ротации. Формат: <span className="text-zinc-300">host:port</span> или <span className="text-zinc-300">host:port:user:pass</span></p>
            <div className="grid grid-cols-2 gap-4">
              <div className="panel">
                <div className="panel-header justify-between">
                  <span className="text-xs mono font-medium text-zinc-400">СПИСОК ПРОКСИ</span>
                  <span className="text-xs mono text-zinc-600">{proxyList.filter(p => p.value).length} шт.</span>
                </div>
                <div className="p-3">
                  <textarea
                    value={proxyText}
                    onChange={e => setProxyText(e.target.value)}
                    placeholder={"192.168.1.1:8080\n10.0.0.1:3128:user:pass\n..."}
                    rows={12}
                    className="w-full bg-input border border-border rounded-sm px-3 py-2 text-xs mono text-zinc-300 placeholder-zinc-700 outline-none focus:border-green-500/50 transition-colors resize-none scrollbar-thin"
                  />
                  <button
                    onClick={saveProxies}
                    className="mt-2 w-full py-2 text-xs mono font-medium rounded-sm transition-all"
                    style={{ background: "hsl(var(--primary))", color: "hsl(220 13% 9%)" }}
                  >
                    ПРИМЕНИТЬ ПРОКСИ
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="text-xs mono font-medium text-zinc-400">СТАТУС ПРОКСИ</span>
                </div>
                <div className="p-3 space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
                  {proxyList.filter(p => p.value).length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 mono text-xs">Прокси не загружены</div>
                  ) : (
                    proxyList.filter(p => p.value).map((proxy, idx) => (
                      <div key={proxy.id} className="flex items-center justify-between py-1.5 px-2 rounded-sm hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="mono text-xs text-zinc-600">#{idx + 1}</span>
                          <div className={`status-dot ${proxy.status === "active" ? "status-free" : proxy.status === "dead" ? "status-busy" : "status-idle"}`} />
                          <span className="mono text-xs text-zinc-300">{proxy.value}</span>
                        </div>
                        <span className="mono text-xs text-zinc-600">ис: {proxy.uses}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-3 pb-3">
                  <div className="pt-3 border-t border-border mono text-xs text-zinc-600 flex justify-between">
                    <span>Ротация: <span className="text-zinc-400">автоматически</span></span>
                    <span>Метод: <span className="text-zinc-400">round-robin</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INTERVAL TAB */}
        {activeTab === "interval" && (
          <div className="slide-in max-w-lg space-y-4">
            <p className="text-xs text-zinc-500 mono mb-4">Частота проверки доступности ника. Меньше интервал = больше запросов = быстрее реакция.</p>

            <div className="panel">
              <div className="panel-header">
                <Icon name="Timer" size={14} className="text-green-400" />
                <span className="text-xs mono font-medium text-zinc-400">ИНТЕРВАЛ ПРОВЕРКИ</span>
              </div>
              <div className="p-5 space-y-5">
                <div className="text-center">
                  <span className="mono text-5xl font-semibold text-green-400">{intervalMs}</span>
                  <span className="mono text-lg text-zinc-500 ml-2">мс</span>
                  <div className="text-xs mono text-zinc-600 mt-1">
                    ≈ {Math.round(1000 / intervalMs)} запросов/сек
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={600}
                  value={intervalMs}
                  onChange={e => setIntervalMs(Number(e.target.value))}
                  className="w-full accent-green-500"
                />
                <div className="flex justify-between text-xs mono text-zinc-600">
                  <span>1 мс (макс. скорость)</span>
                  <span>600 мс</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[10, 50, 100, 200, 300, 500].map(v => (
                    <button
                      key={v}
                      onClick={() => setIntervalMs(v)}
                      className={`py-2 text-xs mono rounded-sm border transition-all ${
                        intervalMs === v
                          ? "border-green-500/60 text-green-400 bg-green-500/10"
                          : "border-border text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                      }`}
                    >
                      {v}мс
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel p-4">
              <div className="space-y-2 text-xs mono text-zinc-500">
                <div className="flex items-center gap-2 text-zinc-400 mb-2"><Icon name="Zap" size={13} className="text-yellow-400" /> Рекомендации</div>
                <div className="flex items-center gap-2"><div className="status-dot status-free" /> <span><span className="text-green-400">1–50мс</span> — максимальная скорость, высокая нагрузка</span></div>
                <div className="flex items-center gap-2"><div className="status-dot status-checking" /> <span><span className="text-yellow-400">50–200мс</span> — оптимальный баланс</span></div>
                <div className="flex items-center gap-2"><div className="status-dot status-idle" /> <span><span className="text-zinc-400">200–600мс</span> — минимальная нагрузка</span></div>
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === "logs" && (
          <div className="slide-in space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs mono text-zinc-500">Записей: <span className="text-zinc-300">{logs.length}</span></span>
                <div className={`flex items-center gap-1.5 ${isRunning ? "text-green-400" : "text-zinc-600"}`}>
                  <div className={`status-dot ${isRunning ? "status-free blink" : "status-idle"}`} />
                  <span className="text-xs mono">{isRunning ? "МОНИТОРИНГ АКТИВЕН" : "ОСТАНОВЛЕН"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportLogs} className="flex items-center gap-1.5 px-3 py-1.5 text-xs mono border border-border text-zinc-400 hover:border-green-500/50 hover:text-green-400 rounded-sm transition-all">
                  <Icon name="Download" size={12} />
                  Экспорт
                </button>
                <button onClick={clearLogs} className="flex items-center gap-1.5 px-3 py-1.5 text-xs mono border border-border text-zinc-500 hover:border-red-500/50 hover:text-red-400 rounded-sm transition-all">
                  <Icon name="Trash2" size={12} />
                  Очистить
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <Icon name="Terminal" size={13} className="text-green-400" />
                <span className="text-xs mono text-zinc-500">ЖУРНАЛ ОПЕРАЦИЙ</span>
              </div>
              <div className="p-3 h-96 overflow-y-auto scrollbar-thin bg-background/50">
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="mono text-xs text-zinc-700">Нажмите СТАРТ для начала мониторинга</span>
                  </div>
                ) : (
                  logs.map(entry => (
                    <div key={entry.id} className="log-entry flex gap-3 hover:bg-white/[0.02] px-1 rounded">
                      <span className="text-zinc-700 shrink-0 w-20">{entry.time}</span>
                      <span className={`shrink-0 w-14 ${LEVEL_COLORS[entry.level]}`}>{LEVEL_PREFIX[entry.level]}</span>
                      <span className={LEVEL_COLORS[entry.level]}>{entry.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
