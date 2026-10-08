"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Rt004Lap, Rt004Session } from "@/types/timing";

function formatLapTime(ms: number | null | undefined) {
  if (ms == null) return "--:---";

  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

function formatSpeed(lapTimeMs: number | null | undefined, trackLengthM: number | null) {
  if (lapTimeMs == null || lapTimeMs <= 0 || trackLengthM == null || trackLengthM <= 0) return "--";
  const speedKmh = (trackLengthM / (lapTimeMs / 1000)) * 3.6;
  return speedKmh.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

type SessionWithEvent = Rt004Session & { event_id?: string | null };

type EventOption = {
  id: string;
  name: string;
  event_date: string;
  track_id: string | null;
  track_name: string;
  length_m: number | null;
};

function formatClock(date: string | null | undefined) {
  if (!date) return "--:--:--";

  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "--/--/---- --:--:--";

  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function Icon({
  children,
}: {
  children: React.ReactNode;
}) {
  return <span className="dashboard-icon">{children}</span>;
}

export default function LiveTiming() {
  const [session, setSession] = useState<SessionWithEvent | null>(null);
  const [laps, setLaps] = useState<Rt004Lap[]>([]);
  const [now, setNow] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTING" | "ONLINE" | "OFFLINE">("CONNECTING");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [sessionAction, setSessionAction] = useState<"starting" | "ending" | null>(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const sessionIdRef = useRef<string | null>(null);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const sessionEvent = session?.event_id
    ? events.find((event) => event.id === session.event_id) ?? null
    : null;
  // Voltas já registradas usam a pista vinculada à sessão; a seleção é usada para o próximo treino.
  const trackLengthM = sessionEvent?.length_m ?? selectedEvent?.length_m ?? null;
  const isSessionActive = Boolean(session && !session.finished_at);

  async function callSessionRpc(functionName: string, args: Record<string, string>) {
    const rpcClient = supabase as unknown as {
      rpc: (
        name: string,
        parameters: Record<string, string>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    return rpcClient.rpc(functionName, args);
  }

  async function startTraining() {
    if (isSessionActive) {
      setSessionMessage("Encerre a sessão atual antes de iniciar outro treino.");
      return;
    }
    if (!selectedEvent) {
      setSessionMessage("Cadastre ou selecione um evento antes de iniciar o treino.");
      return;
    }
    if (!selectedEvent.track_id || !selectedEvent.length_m || selectedEvent.length_m <= 0) {
      setSessionMessage("O evento precisa ter uma pista associada com metragem válida.");
      return;
    }

    setSessionAction("starting");
    setSessionMessage("");
    const { data, error } = await callSessionRpc("start_rt004_session", {
      p_event_id: selectedEvent.id,
      p_device_name: session?.device_name || "LapWiz-7DBE",
      p_device_address: session?.device_address || "A4:C1:38:3C:BE:7D",
    });

    if (error) {
      setSessionMessage(`Não foi possível iniciar o treino: ${error.message}`);
      setSessionAction(null);
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as SessionWithEvent | undefined;
    if (!row?.id) {
      setSessionMessage("O banco não retornou a sessão criada. Confira as funções SQL.");
      setSessionAction(null);
      return;
    }

    sessionIdRef.current = row.id;
    setSession(row);
    setSelectedEventId(selectedEvent.id);
    setLaps([]);
    const startNow = Date.now();
    setNow(startNow);
    setLastUpdate(new Date(startNow));
    setSessionMessage(`Treino iniciado: ${selectedEvent.name}. Aguardando passagens do RT004.`);
    setSessionAction(null);
  }

  async function finishTraining() {
    if (!session || session.finished_at) return;
    if (!window.confirm("Encerrar este treino? As voltas registradas serão mantidas.")) return;

    setSessionAction("ending");
    setSessionMessage("");
    const { data, error } = await callSessionRpc("finish_rt004_session", {
      p_session_id: session.id,
    });

    if (error) {
      setSessionMessage(`Não foi possível encerrar o treino: ${error.message}`);
      setSessionAction(null);
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as SessionWithEvent | undefined;
    if (row?.id) setSession(row);
    setLastUpdate(new Date());
    setSessionMessage("Treino encerrado. As voltas estão salvas; você já pode selecionar outro evento e iniciar novamente.");
    setSessionAction(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      const [{ data: eventRows, error: eventError }, { data: trackRows, error: trackError }] = await Promise.all([
        supabase.from("events").select("id,name,event_date,track_id,status").order("event_date", { ascending: false }),
        supabase.from("tracks").select("id,name,length_m"),
      ]);

      if (cancelled || eventError || trackError) return;

      const tracks = (trackRows ?? []) as Array<{ id: string; name: string; length_m: number | string | null }>;
      const trackById = new Map<string, (typeof tracks)[number]>(tracks.map((track) => [track.id, track]));
      const options: EventOption[] = (eventRows ?? []).map((event) => {
        const track = event.track_id ? trackById.get(event.track_id) : undefined;
        return {
          id: event.id,
          name: event.name,
          event_date: event.event_date,
          track_id: event.track_id,
          track_name: track?.name ?? "Pista não informada",
          length_m: track?.length_m == null ? null : Number(track.length_m),
        };
      });

      setEvents(options);
      setSelectedEventId((current) => current || options[0]?.id || "");
    }

    loadEvents();
    return () => { cancelled = true; };
  }, []);

  async function loadData() {
    const { data: sessionData, error: sessionError } = await supabase
      .from("rt004_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      setRealtimeStatus("OFFLINE");
      
      return;
    }

    if (!sessionData) {
      sessionIdRef.current = null;
      setSession(null);
      setLaps([]);
      return;
    }

    const nextSession = sessionData as SessionWithEvent;
    if (sessionIdRef.current !== nextSession.id) {
      sessionIdRef.current = nextSession.id;
      if (nextSession.event_id) setSelectedEventId(nextSession.event_id);
    }
    setSession(nextSession);

    const { data: lapData, error: lapError } = await supabase
      .from("rt004_laps")
      .select("*")
      .eq("session_id", sessionData.id)
      .order("lap_number", { ascending: true });

    if (lapError) {
      setRealtimeStatus("OFFLINE");
      
      return;
    }

    setLaps((lapData ?? []) as Rt004Lap[]);
    setLastUpdate(new Date());
  }

  useEffect(() => {
    loadData();

    const polling = window.setInterval(() => {
      loadData();
    }, 2000);

    const channel = supabase
      .channel("adiem-live-timing")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rt004_laps",
        },
        (payload) => {
          const newLap = payload.new as Rt004Lap;

          setLaps((current) => {
            if (current.some((lap) => lap.id === newLap.id)) {
              return current;
            }

            return [...current, newLap].sort(
              (a, b) => a.lap_number - b.lap_number,
            );
          });

          setLastUpdate(new Date());
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("ONLINE");
          
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeStatus("OFFLINE");
          
          return;
        }

        setRealtimeStatus("CONNECTING");
      });

    return () => {
      window.clearInterval(polling);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 50);

    return () => window.clearInterval(timer);
  }, []);

  const bestLap = useMemo(() => {
    if (!laps.length) return null;

    return laps.reduce((best, lap) =>
      lap.lap_time_ms < best.lap_time_ms ? lap : best,
    );
  }, [laps]);

  const lastLap = laps.length ? laps[laps.length - 1] : null;

  const averageLap = useMemo(() => {
    if (!laps.length) return null;

    return (
      laps.reduce((sum, lap) => sum + lap.lap_time_ms, 0) / laps.length
    );
  }, [laps]);

  const currentLapNumber = lastLap ? lastLap.lap_number + 1 : 1;

  const currentLapBase = lastLap?.end_at ?? session?.started_at;
  const currentLapMs = session && !session.finished_at && currentLapBase
    ? Math.max(0, now - new Date(currentLapBase).getTime())
    : 0;

  const sessionEndTime = session?.finished_at
    ? new Date(session.finished_at).getTime()
    : now;
  const sessionDuration = session
    ? Math.max(0, sessionEndTime - new Date(session.started_at).getTime())
    : 0;

  const previousLap = (lapNumber: number) =>
    laps.find((lap) => lap.lap_number === lapNumber - 1);

  return (
    <main className="timing-page">
      <header className="top-header">
        <div className="brand-area">
          <img
            src="/adiem-icon.png"
            alt="ADIEM"
            className="adiem-logo"
          />

          <div className="brand-text">
            <div className="brand-name">ADIEM</div>

            <div className="brand-subtitle">
              Associação de Desenvolvimento e Incentivo de Esporte a Motor
            </div>
          </div>

          <div className="brand-divider" />

          <div className="product-name">
            <span>Racing</span> Live Timing
          </div>
        </div>

        <div className="realtime-badge">
          <span
            className={
              realtimeStatus === "ONLINE" ? "status-dot online" : "status-dot"
            }
          />

          <span>
            {realtimeStatus === "ONLINE" ? "Tempo Real" : realtimeStatus === "CONNECTING" ? "Conectando" : "Offline"}
          </span>
        </div>
      </header>

      <section className="dashboard-grid">
        <aside className="sidebar">
          <section className="panel connection-panel">
            <div className="panel-title-row">
              <div className="panel-title">
                <Icon>⌁</Icon>
                Conexão do Sistema
              </div>

              <span
                className={
                  realtimeStatus === "ONLINE"
                    ? "connected-pill"
                    : realtimeStatus === "CONNECTING"
                      ? "connected-pill"
                      : "offline-pill"
                }
              >
                {realtimeStatus === "ONLINE" ? "Conectado" : realtimeStatus === "CONNECTING" ? "Conectando" : "Offline"}
              </span>
            </div>

            <div className="connection-icon">◉</div>

            <InfoRow
              label="Dispositivo"
              value={
                session?.device_name || "LapWiz-7DBE"
              }
            />

            <InfoRow
              label="Endereço BLE"
              value={
                session?.device_address || "--"
              }
            />

            <InfoRow
              label="Status"
              value={
                realtimeStatus === "ONLINE"
                  ? "Realtime conectado"
                  : realtimeStatus === "CONNECTING"
                    ? "Conectando ao Realtime"
                    : "Sem comunicação com o Realtime"
              }
            />

            <InfoRow
              label="Última atualização"
              value={
                lastUpdate
                  ? `${Math.max(
                      0,
                      (Date.now() -
                        lastUpdate.getTime()) /
                        1000,
                    ).toFixed(1)} s`
                  : "--"
              }
            />

            <InfoRow
              label="Voltas recebidas"
              value={String(laps.length)}
            />
          </section>

          <section className="panel session-panel">
            <div className="panel-title">
              <Icon>◷</Icon>
              Sessão Atual
            </div>

            <InfoRow
              label="Início"
              value={formatDateTime(
                session?.started_at,
              )}
            />

            <InfoRow
              label="Duração"
              value={
                session
                  ? formatDuration(sessionDuration)
                  : "--:--"
              }
            />

            <InfoRow
              label="Passagens"
              value={String(laps.length + (isSessionActive ? 1 : 0))}
            />

            <InfoRow
              label="Voltas completas"
              value={String(laps.length)}
            />

            <button
              className="stop-button"
              type="button"
              onClick={finishTraining}
              disabled={!isSessionActive || sessionAction !== null}
              style={{ opacity: !isSessionActive || sessionAction !== null ? 0.55 : 1, cursor: !isSessionActive || sessionAction !== null ? "not-allowed" : "pointer" }}
            >
              <span>■</span>
              {sessionAction === "ending" ? "Encerrando..." : session?.finished_at ? "Treino encerrado" : "Encerrar treino"}
            </button>
          </section>
        </aside>

        <section className="main-area">
          <section className="panel" style={{ marginBottom: 16, padding: 16 }}>
            <div className="panel-title" style={{ marginBottom: 12 }}>
              Evento e pista
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
              <label htmlFor="live-timing-event" style={{ color: "#8e9aa7", fontSize: 13 }}>
                Evento selecionado
              </label>
              <select
                id="live-timing-event"
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                disabled={isSessionActive || sessionAction !== null}
                style={{ minWidth: 240, maxWidth: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #27313a", background: isSessionActive ? "#171c22" : "#0c1015", color: "#f4f6f8", opacity: isSessionActive ? 0.7 : 1 }}
              >
                {events.length === 0 ? <option value="">Nenhum evento encontrado</option> : null}
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} — {new Date(`${event.event_date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
              <span style={{ color: "#d3d7dc", fontSize: 13 }}>
                Pista: <strong>{selectedEvent?.track_name ?? "--"}</strong>
              </span>
              <span style={{ color: "#d3d7dc", fontSize: 13 }}>
                Extensão: <strong>{(selectedEvent?.length_m ?? null) != null ? `${selectedEvent!.length_m!.toLocaleString("pt-BR")} m` : "metragem não cadastrada"}</strong>
              </span>
              <button
                type="button"
                onClick={startTraining}
                disabled={isSessionActive || sessionAction !== null || !selectedEvent || !selectedEvent.length_m}
                style={{ padding: "10px 15px", borderRadius: 8, border: "1px solid #16a765", background: isSessionActive || sessionAction !== null || !selectedEvent || !selectedEvent.length_m ? "#27313a" : "#13a765", color: "#fff", fontWeight: 800, cursor: isSessionActive || sessionAction !== null || !selectedEvent || !selectedEvent.length_m ? "not-allowed" : "pointer", opacity: isSessionActive ? 0.65 : 1 }}
              >
                {sessionAction === "starting" ? "Iniciando..." : isSessionActive ? "Treino em andamento" : "Iniciar novo treino"}
              </button>
            </div>
            {sessionMessage ? (
              <div role="status" style={{ marginTop: 12, color: sessionMessage.startsWith("Não foi possível") || sessionMessage.startsWith("O evento") || sessionMessage.startsWith("Encerre") ? "#ff7373" : "#40df93", fontSize: 13 }}>
                {sessionMessage}
              </div>
            ) : null}
          </section>

          <div className="stats-grid">
            <StatCard
              icon="◷"
              label="Melhor Volta"
              value={formatLapTime(
                bestLap?.lap_time_ms,
              )}
              detail={
                bestLap
                  ? `#${bestLap.lap_number}`
                  : "--"
              }
              highlight
            />

            <StatCard
              icon="⚑"
              label="Última Volta"
              value={formatLapTime(
                lastLap?.lap_time_ms,
              )}
              detail={
                lastLap
                  ? `#${lastLap.lap_number}`
                  : "--"
              }
            />

            <StatCard
              icon="♧"
              label="Volta Atual"
              value={formatLapTime(currentLapMs)}
              detail={`#${currentLapNumber}`}
            />

            <StatCard
              icon="◉"
              label="Média"
              value={formatLapTime(averageLap)}
              detail={`${laps.length} voltas`}
            />
          </div>

          <section className="panel laps-panel">
            <div className="laps-header">
              <div className="laps-title">
                <span className="flag-icon">⚑</span>

                <span>
                  Voltas em Tempo Real
                </span>
              </div>

              <div className="live-indicator">
                <span className="status-dot online" />

                Atualizando automaticamente
              </div>
            </div>

            {/* =========================================================
                DESKTOP / TABLET
                A tabela original permanece preservada.
               ========================================================= */}

            <div className="table-wrapper desktop-laps-view">
              <table className="lap-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tempo da Volta</th>
                    <th>Dif. Melhor</th>
                    <th>Dif. Anterior</th>
                    <th>Velocidade Média</th>
                    <th>Hora da Passagem</th>
                  </tr>
                </thead>

                <tbody>
                  {laps.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="empty-state"
                      >
                        Aguardando primeira passagem...
                      </td>
                    </tr>
                  ) : (
                    [...laps]
                      .reverse()
                      .map((lap) => {
                        const previous =
                          previousLap(
                            lap.lap_number,
                          );

                        const diffBest = bestLap
                          ? lap.lap_time_ms -
                            bestLap.lap_time_ms
                          : 0;

                        const diffPrevious =
                          previous
                            ? lap.lap_time_ms -
                              previous.lap_time_ms
                            : null;

                        const isBest =
                          lap.id === bestLap?.id;

                        return (
                          <tr
                            key={lap.id}
                            className={
                              isBest
                                ? "best-row"
                                : ""
                            }
                          >
                            <td
                              className="lap-number"
                              data-label="Volta"
                            >
                              {lap.lap_number}
                            </td>

                            <td
                              data-label="Tempo da volta"
                              className={
                                isBest
                                  ? "lap-time best-time"
                                  : "lap-time"
                              }
                            >
                              {formatLapTime(
                                lap.lap_time_ms,
                              )}
                            </td>

                            <td
                              data-label="Dif. melhor"
                              className={
                                diffBest > 0
                                  ? "delta negative"
                                  : "delta neutral"
                              }
                            >
                              {diffBest === 0
                                ? "-"
                                : `+${(
                                    diffBest /
                                    1000
                                  ).toFixed(3)}`}
                            </td>

                            <td
                              data-label="Dif. anterior"
                              className={
                                diffPrevious == null
                                  ? "delta neutral"
                                  : diffPrevious > 0
                                    ? "delta negative"
                                    : "delta positive"
                              }
                            >
                              {diffPrevious == null
                                ? "-"
                                : diffPrevious === 0
                                  ? "0.000"
                                  : `${
                                      diffPrevious >
                                      0
                                        ? "+"
                                        : ""
                                    }${(
                                      diffPrevious /
                                      1000
                                    ).toFixed(3)}`}
                            </td>

                            <td data-label="Velocidade média" className="delta neutral">
                              {formatSpeed(lap.lap_time_ms, trackLengthM)}{trackLengthM != null ? " km/h" : ""}
                            </td>

                            <td data-label="Hora da passagem">
                              {formatClock(
                                lap.end_at,
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>


          </section>
        </section>
      </section>
    </main>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="info-row">
      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div className="stat-content">
        <div className="stat-label">
          {label}
        </div>

        <div
          className={
            highlight
              ? "stat-value highlight"
              : "stat-value"
          }
        >
          {value}
        </div>

        <div className="stat-detail">
          {detail}
        </div>
      </div>
    </article>
  );
}
