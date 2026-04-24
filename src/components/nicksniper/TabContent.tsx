import { useRef } from "react";
import Icon from "@/components/ui/icon";
import {
  TabId, Character, ProxyEntry, LogEntry,
  LEVEL_COLORS, LEVEL_PREFIX, GALAXY_PROXY_URL,
} from "./types";

interface TabContentProps {
  activeTab: TabId;
  targetNick: string;
  checkers: Character[];
  setCheckers: React.Dispatch<React.SetStateAction<Character[]>>;
  mainChar: Character;
  setMainChar: React.Dispatch<React.SetStateAction<Character>>;
  proxyList: ProxyEntry[];
  proxyText: string;
  setProxyText: (v: string) => void;
  saveProxies: () => void;
  intervalMs: number;
  setIntervalMs: (v: number) => void;
  logs: LogEntry[];
  isRunning: boolean;
  exportLogs: () => void;
  clearLogs: () => void;
}

async function galaxyRequest(body: Record<string, string>) {
  const resp = await fetch(GALAXY_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return resp.json();
}

const AUTH_BADGE: Record<Character["authStatus"], { label: string; cls: string }> = {
  unknown: { label: "не проверен", cls: "text-zinc-600" },
  checking: { label: "проверка...", cls: "text-yellow-400" },
  ok: { label: "авторизован", cls: "text-green-400" },
  fail: { label: "ошибка входа", cls: "text-red-400" },
};

function CharacterCard({
  char,
  idx,
  proxyList,
  onUpdate,
  onDelete,
  onVerify,
}: {
  char: Character;
  idx: number;
  proxyList: ProxyEntry[];
  onUpdate: (id: number, patch: Partial<Character>) => void;
  onDelete: (id: number) => void;
  onVerify: (char: Character) => void;
}) {
  const badge = AUTH_BADGE[char.authStatus];

  return (
    <div className="panel">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-3">
          <span className="mono text-xs text-zinc-600">#{idx + 1}</span>
          <div className={`status-dot ${
            char.status === "checking" ? "status-checking blink" :
            char.status === "active" ? "status-free" :
            char.status === "error" ? "status-busy" : "status-idle"
          }`} />
          <input
            value={char.nickname}
            onChange={e => onUpdate(char.id, { nickname: e.target.value })}
            className="bg-transparent mono text-sm font-medium text-zinc-300 outline-none w-32 border-b border-transparent hover:border-zinc-700 focus:border-green-500 transition-colors"
          />
          {char.userID && (
            <span className="mono text-xs text-zinc-600 hidden sm:inline">
              ID: <span className="text-zinc-400">{char.userID}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs mono text-zinc-600">
          <span className={`${badge.cls} text-xs mono`}>{badge.label}</span>
          <span>REQ: <span className="text-zinc-400">{char.requestCount}</span></span>
          <button
            onClick={() => onDelete(char.id)}
            className="text-zinc-700 hover:text-red-400 transition-colors"
          >
            <Icon name="Trash2" size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <Icon name="KeyRound" size={14} className="text-zinc-600 shrink-0" />
          <input
            type="text"
            value={char.recoveryCode}
            onChange={e => onUpdate(char.id, { recoveryCode: e.target.value, authStatus: "unknown", userID: "", password: "" })}
            placeholder="Код восстановления (из настроек Galaxy)..."
            className={`flex-1 bg-input border rounded-sm px-3 py-1.5 text-sm mono placeholder-zinc-700 outline-none transition-colors ${
              char.authStatus === "ok" ? "border-green-500/40 text-green-300" :
              char.authStatus === "fail" ? "border-red-500/40 text-red-300" :
              "border-border text-zinc-300 focus:border-green-500/50"
            }`}
          />
          <button
            onClick={() => onVerify(char)}
            disabled={!char.recoveryCode.trim() || char.authStatus === "checking"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs mono rounded-sm border transition-all shrink-0 ${
              char.authStatus === "checking"
                ? "border-zinc-700 text-zinc-600 cursor-wait"
                : "border-border text-zinc-400 hover:border-green-500/50 hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {char.authStatus === "checking"
              ? <><Icon name="Loader" size={11} className="animate-spin" />Проверка</>
              : <><Icon name="ShieldCheck" size={11} />Проверить</>
            }
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs mono text-zinc-600">
          <span>Прокси:&nbsp;
            <span className="text-zinc-400 bg-secondary px-1.5 py-0.5 rounded-sm">
              {proxyList[char.proxyIndex % Math.max(proxyList.filter(p => p.value).length, 1)]?.value || "не задан"}
            </span>
          </span>
          <span>Последний:&nbsp;<span className="text-zinc-400">{char.lastChecked}</span></span>
        </div>
      </div>
    </div>
  );
}

export default function TabContent({
  activeTab,
  targetNick,
  checkers,
  setCheckers,
  mainChar,
  setMainChar,
  proxyList,
  proxyText,
  setProxyText,
  saveProxies,
  intervalMs,
  setIntervalMs,
  logs,
  isRunning,
  exportLogs,
  clearLogs,
}: TabContentProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  const verifyChar = async (
    char: Character,
    setFn: (id: number, patch: Partial<Character>) => void
  ) => {
    setFn(char.id, { authStatus: "checking" });
    try {
      const result = await galaxyRequest({
        action: "login_by_code",
        recovery_code: char.recoveryCode.trim(),
      });
      if (result.ok && result.userID && result.password) {
        setFn(char.id, {
          authStatus: "ok",
          userID: result.userID,
          password: result.password,
        });
      } else {
        setFn(char.id, { authStatus: "fail", userID: "", password: "" });
      }
    } catch {
      setFn(char.id, { authStatus: "fail", userID: "", password: "" });
    }
  };

  const updateChecker = (id: number, patch: Partial<Character>) => {
    setCheckers(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const updateMain = (id: number, patch: Partial<Character>) => {
    setMainChar(prev => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex-1 mx-6 mt-4 mb-6">

      {/* CHECKERS TAB */}
      {activeTab === "checkers" && (
        <div className="slide-in space-y-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500 mono">Персонажи для проверки ника. Каждый запрос — новый прокси.</p>
            <button
              onClick={() => setCheckers(prev => [...prev, {
                id: Date.now(), recoveryCode: "", userID: "", password: "",
                authStatus: "unknown" as const, nickname: `Checker_${prev.length + 1}`,
                status: "idle" as const, lastChecked: "—", requestCount: 0, proxyIndex: 0,
              }])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs mono rounded-sm border border-border text-zinc-400 hover:border-green-500/50 hover:text-green-400 transition-all"
            >
              <Icon name="Plus" size={12} />
              Добавить персонажа
            </button>
          </div>

          <div className="grid gap-2">
            {checkers.map((char, idx) => (
              <CharacterCard
                key={char.id}
                char={char}
                idx={idx}
                proxyList={proxyList}
                onUpdate={updateChecker}
                onDelete={id => setCheckers(prev => prev.filter(c => c.id !== id))}
                onVerify={c => verifyChar(c, updateChecker)}
              />
            ))}
          </div>
        </div>
      )}

      {/* MAIN TAB */}
      {activeTab === "main" && (
        <div className="slide-in space-y-4">
          <p className="text-xs text-zinc-500 mono mb-4">Основной персонаж, который будет занимать ник при освобождении.</p>
          <div className="panel max-w-xl">
            <div className="panel-header justify-between">
              <div className="flex items-center gap-2">
                <div className={`status-dot ${mainChar.status === "active" ? "status-free pulse-green" : "status-idle"}`} />
                <span className="mono text-sm font-semibold text-zinc-300">Основной персонаж</span>
                {mainChar.userID && (
                  <span className="mono text-xs text-zinc-600">ID: <span className="text-zinc-400">{mainChar.userID}</span></span>
                )}
              </div>
              <span className={`text-xs mono ${AUTH_BADGE[mainChar.authStatus].cls}`}>
                {AUTH_BADGE[mainChar.authStatus].label}
              </span>
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mainChar.recoveryCode}
                    onChange={e => setMainChar(prev => ({
                      ...prev,
                      recoveryCode: e.target.value,
                      authStatus: "unknown",
                      userID: "",
                      password: "",
                    }))}
                    placeholder="Код из настроек Galaxy (Настройки → Код восстановления)..."
                    className={`flex-1 bg-input border rounded-sm px-3 py-2 text-sm mono placeholder-zinc-700 outline-none transition-colors ${
                      mainChar.authStatus === "ok" ? "border-green-500/40 text-green-300" :
                      mainChar.authStatus === "fail" ? "border-red-500/30 text-red-300" :
                      !mainChar.recoveryCode ? "border-red-500/20 text-zinc-300 focus:border-red-500/50" :
                      "border-border text-zinc-300 focus:border-green-500/50"
                    }`}
                  />
                  <button
                    onClick={() => verifyChar(mainChar, updateMain)}
                    disabled={!mainChar.recoveryCode.trim() || mainChar.authStatus === "checking"}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs mono rounded-sm border transition-all shrink-0 ${
                      mainChar.authStatus === "checking"
                        ? "border-zinc-700 text-zinc-600 cursor-wait"
                        : mainChar.authStatus === "ok"
                        ? "border-green-500/40 text-green-400 bg-green-500/10"
                        : "border-border text-zinc-400 hover:border-green-500/50 hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {mainChar.authStatus === "checking"
                      ? <><Icon name="Loader" size={11} className="animate-spin" />Проверка...</>
                      : mainChar.authStatus === "ok"
                      ? <><Icon name="ShieldCheck" size={11} />Авторизован</>
                      : <><Icon name="ShieldCheck" size={11} />Проверить</>
                    }
                  </button>
                </div>
                {!mainChar.recoveryCode && (
                  <p className="text-xs text-red-400/70 mono mt-1">⚠ Требуется для захвата ника</p>
                )}
                {mainChar.authStatus === "fail" && (
                  <p className="text-xs text-red-400/70 mono mt-1">✕ Неверный код восстановления</p>
                )}
                {mainChar.authStatus === "ok" && (
                  <p className="text-xs text-green-400/70 mono mt-1">✓ Вход выполнен успешно</p>
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
              <div>1. Персонажи прочека отслеживают доступность ника «{targetNick || "..."}»</div>
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
  );
}
