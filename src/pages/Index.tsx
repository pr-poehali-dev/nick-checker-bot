import { useState, useEffect, useRef, useCallback } from "react";
import AppHeader from "@/components/nicksniper/AppHeader";
import TabContent from "@/components/nicksniper/TabContent";
import {
  LogLevel, NickStatus, TabId,
  LogEntry, Character, ProxyEntry,
  LEVEL_PREFIX,
  GALAXY_PROXY_URL,
  parseRecoveryCode,
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

  // Выбрать персонажа-прочека по очереди (round-robin)
  const getCheckerCreds = useCallback((idx: number) => {
    const activeCheckers = checkers.filter(c => c.recoveryCode.trim());
    if (activeCheckers.length === 0) return null;
    const checker = activeCheckers[idx % activeCheckers.length];
    return parseRecoveryCode(checker.recoveryCode);
  }, [checkers]);

  // Выбрать прокси по очереди
  const getProxy = useCallback((idx: number): string => {
    const active = proxyList.filter(p => p.value.trim());
    if (active.length === 0) return "";
    return active[idx % active.length].value;
  }, [proxyList]);

  const doCheck = useCallback(async () => {
    if (isCapturingRef.current) return;

    const idx = requestCountRef.current;
    requestCountRef.current++;
    setTotalRequests(r => r + 1);
    const checkTime = nowTime();

    // Обновляем статус чекеров визуально
    setCheckers(prev => prev.map((c) => ({ ...c, status: "checking" as const, lastChecked: checkTime })));

    const creds = getCheckerCreds(idx);
    if (!creds) {
      setCheckers(prev => prev.map(c => ({ ...c, status: "idle" as const })));
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

        // Останавливаем мониторинг
        if (runIntervalRef.current) {
          clearInterval(runIntervalRef.current);
          runIntervalRef.current = null;
          setIsRunning(false);
        }

        // Захватываем ник основным персонажем
        const mainCreds = parseRecoveryCode(mainChar.recoveryCode);
        if (!mainCreds) {
          addLog("Не удалось захватить: нет кредов основного персонажа", "error");
          isCapturingRef.current = false;
          return;
        }

        setMainChar(prev => ({ ...prev, status: "checking" as const, lastChecked: nowTime() }));
        addLog(`Отправляю запрос на смену ника для "${mainChar.nickname}"...`, "info");

        const captureResult = await galaxyRequest({
          action: "change_nick",
          new_nick: targetNick,
          userID: mainCreds.userID,
          password: mainCreds.password,
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
        // Логируем каждые 20 запросов, чтобы не спамить
        if ((idx + 1) % 20 === 0) {
          addLog(`[#${idx + 1}] "${targetNick}" — занят. Прокси: ${proxy || "нет"}`, "system");
        }
        setCheckers(prev => prev.map(c => ({ ...c, status: "active" as const })));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Сетевая ошибка #${idx + 1}: ${msg}`, "error");
      setCheckers(prev => prev.map(c => ({ ...c, status: "error" as const })));
      setNickStatus("unknown");
    }
  }, [targetNick, getCheckerCreds, getProxy, mainChar, addLog, showNotification]);

  const startMonitor = async () => {
    if (!targetNick.trim()) {
      showNotification("Введите целевой ник", "warn");
      return;
    }
    if (!mainChar.recoveryCode.trim()) {
      showNotification("Введите код восстановления основного персонажа", "warn");
      addLog("Запуск отменён: не указан код восстановления основного персонажа", "warn");
      return;
    }

    const mainCreds = parseRecoveryCode(mainChar.recoveryCode);
    if (!mainCreds) {
      showNotification("Неверный формат кода восстановления (нужен userID:password)", "warn");
      addLog("Неверный формат кода восстановления основного персонажа. Используй формат: userID:password", "warn");
      return;
    }

    const activeCheckers = checkers.filter(c => c.recoveryCode.trim());
    if (activeCheckers.length === 0) {
      showNotification("Добавьте хотя бы одного персонажа-прочека с кодом восстановления", "warn");
      addLog("Запуск отменён: нет персонажей прочека с кодами восстановления", "warn");
      return;
    }

    // Проверяем форматы кодов чекеров
    for (const checker of activeCheckers) {
      if (!parseRecoveryCode(checker.recoveryCode)) {
        showNotification(`Неверный формат кода у ${checker.nickname}`, "warn");
        addLog(`Неверный формат кода восстановления у "${checker.nickname}". Используй: userID:password`, "warn");
        return;
      }
    }

    // Проверяем авторизацию основного персонажа
    addLog(`Проверка авторизации "${mainChar.nickname}"...`, "info");
    try {
      const authResult = await galaxyRequest({
        action: "auth_check",
        userID: mainCreds.userID,
        password: mainCreds.password,
      });
      if (!authResult.ok || !authResult.valid) {
        addLog(`Авторизация "${mainChar.nickname}" не прошла: ${authResult.error || authResult.raw || "неверные данные"}`, "error");
        showNotification(`Авторизация основного персонажа не прошла`, "error");
        return;
      }
      addLog(`Авторизация "${mainChar.nickname}" успешна`, "success");
    } catch (err) {
      addLog(`Ошибка проверки авторизации: ${err instanceof Error ? err.message : String(err)}`, "error");
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

  const stopMonitor = () => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
    isCapturingRef.current = false;
    setIsRunning(false);
    setNickStatus("idle");
    setCheckers(prev => prev.map(c => ({ ...c, status: "idle" as const })));
    addLog("Мониторинг остановлен пользователем", "warn");
  };

  useEffect(() => {
    return () => {
      if (runIntervalRef.current) clearInterval(runIntervalRef.current);
    };
  }, []);

  // Перезапускаем интервал при изменении intervalMs без потери состояния
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
