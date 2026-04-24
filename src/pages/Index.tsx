import { useState, useEffect, useRef, useCallback } from "react";
import AppHeader from "@/components/nicksniper/AppHeader";
import TabContent from "@/components/nicksniper/TabContent";
import {
  LogLevel, NickStatus, TabId,
  LogEntry, Character, ProxyEntry,
  LEVEL_PREFIX, GALAXY_PROXY_URL,
} from "@/components/nicksniper/types";

let logIdCounter = 1;

async function galaxyRequest(body: Record<string, string>) {
  const resp = await fetch(GALAXY_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return resp.json();
}

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabId>("checkers");
  const [targetNick, setTargetNick] = useState("");
  const [nickStatus, setNickStatus] = useState<NickStatus>("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(200);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [captureAttempts, setCaptureAttempts] = useState(0);
  const [notification, setNotification] = useState<{ text: string; type: LogLevel } | null>(null);
  const runIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestCountRef = useRef(0);
  const isCapturingRef = useRef(false);

  const [checkers, setCheckers] = useState<Character[]>([
    { id: 1, recoveryCode: "", userID: "", password: "", authStatus: "unknown", nickname: "Checker_1", status: "idle", lastChecked: "—", requestCount: 0, proxyIndex: 0 },
    { id: 2, recoveryCode: "", userID: "", password: "", authStatus: "unknown", nickname: "Checker_2", status: "idle", lastChecked: "—", requestCount: 0, proxyIndex: 1 },
  ]);

  const [mainChar, setMainChar] = useState<Character>({
    id: 0, recoveryCode: "", userID: "", password: "", authStatus: "unknown",
    nickname: "MainChar", status: "idle", lastChecked: "—", requestCount: 0, proxyIndex: -1,
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

  const getCheckerCreds = useCallback((idx: number): { userID: string; password: string } | null => {
    const active = checkers.filter(c => c.authStatus === "ok" && c.userID && c.password);
    if (active.length === 0) return null;
    const c = active[idx % active.length];
    return { userID: c.userID, password: c.password };
  }, [checkers]);

  const getProxy = useCallback((idx: number): string => {
    const active = proxyList.filter(p => p.value.trim());
    if (active.length === 0) return "";
    return active[idx % active.length].value;
  }, [proxyList]);

  const stopMonitor = useCallback(() => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
    isCapturingRef.current = false;
    setIsRunning(false);
    setNickStatus("idle");
    setCheckers(prev => prev.map(c => ({ ...c, status: "idle" as const })));
    addLog("Мониторинг остановлен", "warn");
  }, [addLog]);

  const doCheck = useCallback(async () => {
    if (isCapturingRef.current) return;

    const idx = requestCountRef.current;
    requestCountRef.current++;
    setTotalRequests(r => r + 1);
    const checkTime = nowTime();

    setCheckers(prev => prev.map(c => ({ ...c, status: "checking" as const, lastChecked: checkTime })));

    const creds = getCheckerCreds(idx);
    if (!creds) {
      setCheckers(prev => prev.map(c => ({ ...c, status: "idle" as const })));
      addLog("Нет авторизованных персонажей-прочека. Авторизуйте хотя бы одного.", "warn");
      stopMonitor();
      return;
    }

    const proxy = getProxy(idx);

    try {
      const result = await galaxyRequest({
        action: "check_nick",
        nick: targetNick,
        userID: creds.userID,
        password: creds.password,
        proxy,
      });

      setCheckers(prev => prev.map(c => ({ ...c, status: "active" as const })));

      if (!result.ok) {
        addLog(`Ошибка прочека #${idx + 1}: ${result.error}`, "error");
        setCheckers(prev => prev.map(c => ({ ...c, status: "error" as const })));
        return;
      }

      const isFree: boolean = result.free === true;
      setNickStatus(isFree ? "free" : "busy");

      if (isFree) {
        isCapturingRef.current = true;
        addLog(`Ник "${targetNick}" СВОБОДЕН! Запускаю захват...`, "success");
        showNotification(`Ник "${targetNick}" свободен! Захват...`, "success");
        setCaptureAttempts(a => a + 1);
        setCheckers(prev => prev.map(c => ({ ...c, status: "idle" as const })));

        if (runIntervalRef.current) {
          clearInterval(runIntervalRef.current);
          runIntervalRef.current = null;
          setIsRunning(false);
        }

        if (!mainChar.userID || !mainChar.password) {
          addLog("Не удалось захватить: основной персонаж не авторизован", "error");
          showNotification("Основной персонаж не авторизован!", "error");
          isCapturingRef.current = false;
          return;
        }

        setMainChar(prev => ({ ...prev, status: "checking" as const, lastChecked: nowTime() }));
        addLog(`Отправляю запрос на смену ника для "${mainChar.nickname}"...`, "info");

        const captureResult = await galaxyRequest({
          action: "change_nick",
          new_nick: targetNick,
          userID: mainChar.userID,
          password: mainChar.password,
          proxy: "",
        });

        setMainChar(prev => ({
          ...prev,
          status: captureResult.success ? "active" : "error",
          lastChecked: nowTime(),
          requestCount: prev.requestCount + 1,
        }));

        if (captureResult.ok && captureResult.success) {
          addLog(`Ник "${targetNick}" успешно занят основным персонажем!`, "success");
          showNotification(`Ник "${targetNick}" захвачен!`, "success");
        } else {
          addLog(`Не удалось занять ник "${targetNick}": ${captureResult.error || captureResult.raw || "неизвестная ошибка"}`, "error");
          showNotification(`Не удалось захватить ник.`, "error");
        }

        isCapturingRef.current = false;
      } else {
        if ((idx + 1) % 20 === 0) {
          addLog(`[#${idx + 1}] "${targetNick}" — занят. Прокси: ${proxy || "нет"}`, "system");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Сетевая ошибка #${idx + 1}: ${msg}`, "error");
      setCheckers(prev => prev.map(c => ({ ...c, status: "error" as const })));
      setNickStatus("unknown");
    }
   
  }, [targetNick, getCheckerCreds, getProxy, mainChar, addLog, showNotification, stopMonitor]);

  const startMonitor = async () => {
    if (!targetNick.trim()) {
      showNotification("Введите целевой ник", "warn");
      return;
    }
    if (mainChar.authStatus !== "ok") {
      showNotification("Сначала авторизуйте основного персонажа (вкладка «Основной»)", "warn");
      addLog("Запуск отменён: основной персонаж не авторизован", "warn");
      return;
    }
    const activeCheckers = checkers.filter(c => c.authStatus === "ok");
    if (activeCheckers.length === 0) {
      showNotification("Авторизуйте хотя бы одного персонажа-прочека", "warn");
      addLog("Запуск отменён: нет авторизованных персонажей прочека", "warn");
      return;
    }

    isCapturingRef.current = false;
    requestCountRef.current = 0;
    addLog(`Запуск мониторинга ника "${targetNick}" | интервал: ${intervalMs}мс`, "system");
    addLog(`Персонажей прочека: ${activeCheckers.length} | Прокси: ${proxyList.filter(p => p.value).length}`, "info");
    setIsRunning(true);
    setNickStatus("checking");
    runIntervalRef.current = setInterval(doCheck, intervalMs);
  };

  useEffect(() => {
    return () => {
      if (runIntervalRef.current) clearInterval(runIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (isRunning) {
      if (runIntervalRef.current) clearInterval(runIntervalRef.current);
      runIntervalRef.current = setInterval(doCheck, intervalMs);
    }
  }, [intervalMs, isRunning, doCheck]);

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
