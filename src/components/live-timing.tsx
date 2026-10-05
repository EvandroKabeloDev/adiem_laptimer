"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Rt004Lap, Rt004Session } from "@/types/timing";

function formatLapTime(ms: number | null | undefined) {
  if (ms == null) return "--:---";

  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

function formatClock(date: string | null | undefined) {
  if (!date) return "--:--:--";

  return new Date(date).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "--/--/---- --:--:--";

  return new Date(date).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
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
  const [session, setSession] = useState<Rt004Session | null>(null);
  const [laps, setLaps] = useState<Rt004Lap[]>([]);
  const [now, setNow] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [online, setOnline] = useState(false);

  async function loadData() {
    const { data: sessionData } = await supabase
      .from("rt004_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sessionData) {
      setSession(null);
      setLaps([]);
      setOnline(false);
      return;
    }

    setSession(sessionData as Rt004Session);

    const { data: lapData } = await supabase
      .from("rt004_laps")
      .select("*")
      .eq("session_id", sessionData.id)
      .order("lap_number", { ascending: true });

    setLaps((lapData ?? []) as Rt004Lap[]);
    setOnline(true);
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

          setOnline(true);
          setLastUpdate(new Date());
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setOnline(true);
        }
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

  const currentLapMs = lastLap
    ? Math.max(0, now - new Date(lastLap.end_at).getTime())
    : 0;

  const sessionDuration = session
    ? now - new Date(session.started_at).getTime()
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
              online ? "status-dot online" : "status-dot"
            }
          />

          <span>
            {online ? "Tempo Real" : "Offline"}
          </span>
        </div>
      </header>

      <section className="dashboard-grid">
        <aside className="sidebar">
          <section className="panel connection-panel">
            <div className="panel-title-row">
              <div className="panel-title">
                <Icon>⌁</Icon>
                Conexão RT004
              </div>

              <span
                className={
                  online
                    ? "connected-pill"
                    : "offline-pill"
                }
              >
                {online ? "Conectado" : "Offline"}
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
                online
                  ? "Recebendo dados"
                  : "Aguardando dados"
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
              value={String(laps.length + 1)}
            />

            <InfoRow
              label="Voltas completas"
              value={String(laps.length)}
            />

            <button
              className="stop-button"
              type="button"
            >
              <span>■</span>
              Encerrar Sessão
            </button>
          </section>
        </aside>

        <section className="main-area">
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
                    <th>Contador</th>
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

                            <td
                              data-label="Contador"
                              className="counter-cell"
                            >
                              {lap.counter_delta
                                ? lap.counter_delta.toLocaleString(
                                    "pt-BR",
                                  )
                                : "--"}
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

            {/* =========================================================
                MOBILE
                Cards próprios. Não dependemos mais da transformação
                CSS da tabela.
               ========================================================= */}

            <div className="mobile-laps-view">
              {laps.length === 0 ? (
                <div className="mobile-empty-state">
                  <div className="mobile-empty-icon">
                    ⚑
                  </div>

                  <div className="mobile-empty-title">
                    Aguardando primeira passagem
                  </div>

                  <div className="mobile-empty-text">
                    Assim que o RT004 detectar uma
                    passagem, a volta aparecerá aqui.
                  </div>
                </div>
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
                      <article
                        key={`mobile-${lap.id}`}
                        className={
                          isBest
                            ? "mobile-lap-card mobile-best-card"
                            : "mobile-lap-card"
                        }
                      >
                        <div className="mobile-lap-header">
                          <div>
                            <span className="mobile-lap-label">
                              VOLTA
                            </span>

                            <span className="mobile-lap-number">
                              #{lap.lap_number}
                            </span>
                          </div>

                          {isBest && (
                            <span className="mobile-best-badge">
                              MELHOR
                            </span>
                          )}
                        </div>

                        <div className="mobile-lap-main">
                          <span className="mobile-main-label">
                            Tempo da volta
                          </span>

                          <strong
                            className={
                              isBest
                                ? "mobile-main-time mobile-main-time-best"
                                : "mobile-main-time"
                            }
                          >
                            {formatLapTime(
                              lap.lap_time_ms,
                            )}
                          </strong>
                        </div>

                        <div className="mobile-lap-grid">
                          <div className="mobile-lap-info">
                            <span>
                              Dif. melhor
                            </span>

                            <strong
                              className={
                                diffBest > 0
                                  ? "mobile-negative"
                                  : "mobile-neutral"
                              }
                            >
                              {diffBest === 0
                                ? "-"
                                : `+${(
                                    diffBest /
                                    1000
                                  ).toFixed(3)}`}
                            </strong>
                          </div>

                          <div className="mobile-lap-info">
                            <span>
                              Dif. anterior
                            </span>

                            <strong
                              className={
                                diffPrevious == null
                                  ? "mobile-neutral"
                                  : diffPrevious > 0
                                    ? "mobile-negative"
                                    : "mobile-positive"
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
                            </strong>
                          </div>

                          <div className="mobile-lap-info">
                            <span>
                              Contador
                            </span>

                            <strong>
                              {lap.counter_delta
                                ? lap.counter_delta.toLocaleString(
                                    "pt-BR",
                                  )
                                : "--"}
                            </strong>
                          </div>

                          <div className="mobile-lap-info">
                            <span>
                              Hora da passagem
                            </span>

                            <strong>
                              {formatClock(
                                lap.end_at,
                              )}
                            </strong>
                          </div>
                        </div>
                      </article>
                    );
                  })
              )}
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
