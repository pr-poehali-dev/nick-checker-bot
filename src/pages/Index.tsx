import { useState, useEffect, useRef, useCallback } from "react";
import AppHeader from "@/components/nicksniper/AppHeader";
import TabContent from "@/components/nicksniper/TabContent";
import {
  LogLevel, NickStatus, TabId,
  LogEntry, Character, ProxyEntry,
  LEVEL_PREFIX,
} from "@/components/nicksniper/types";

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

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <AppHeader
        targetNick={targetNick}
        setTargetNick={setTargetNick}
        nickStatus={nickStatus}
        isRunning={isRunning}
        totalRequests={totalRequests}
        captureAttempts={captureAttempts}
        notification={notification}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onStart={startMonitor}
        onStop={stopMonitor}
      />
      <TabContent
        activeTab={activeTab}
        targetNick={targetNick}
        checkers={checkers}
        setCheckers={setCheckers}
        mainChar={mainChar}
        setMainChar={setMainChar}
        proxyList={proxyList}
        proxyText={proxyText}
        setProxyText={setProxyText}
        saveProxies={saveProxies}
        intervalMs={intervalMs}
        setIntervalMs={setIntervalMs}
        logs={logs}
        isRunning={isRunning}
        exportLogs={exportLogs}
        clearLogs={clearLogs}
      />
    </div>
  );
}
