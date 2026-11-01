"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type EventRow = { id: string; name: string | null; track_id: string | null };
type TrackRow = { id: string; name: string | null; length_m: number | string | null };
type KartRow = { id: string; number: string | number | null; name: string | null };
type SessionRow = {
  id: string;
  event_id: string | null;
  test_name: string | null;
  started_at: string | null;
  finished_at: string | null;
};
type TransponderRow = {
  transponder_id: number;
  kart_id: string | null;
  pilot_id: string | null;
  portal_kart_id: string | null;
};
type PilotRow = { id: string; name: string | null };
type LapRow = {
  id: number | string;
  session_id: string;
  transponder_id: number | null;
  kart_id: string | null;
  lap_number: number | null;
  lap_time_ms: number | null;
  start_at: string | null;
  end_at: string | null;
};

function makeSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function formatLap(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return `${(ms / 1000).toFixed(3).replace(".", ",")} s`;
}

export default function HistoricoPage() {
  const supabase = useMemo(() => makeSupabase(), []);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [karts, setKarts] = useState<KartRow[]>([]);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [transponders, setTransponders] = useState<TransponderRow[]>([]);
  const [pilots, setPilots] = useState<PilotRow[]>([]);
  const [laps, setLaps] = useState<LapRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [transponderId, setTransponderId] = useState("");
  const [kartId, setKartId] = useState("");
  const [pilotId, setPilotId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingLaps, setLoadingLaps] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      if (!supabase) {
        setError(
          "Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY) no ambiente do portal."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const [eventResult, sessionResult, kartResult, trackResult, transponderResult, pilotResult] =
        await Promise.all([
          supabase.from("events").select("id,name,track_id").order("name"),
          supabase
            .from("rt004_sessions")
            .select("id,event_id,test_name,started_at,finished_at")
            .order("started_at", { ascending: false }),
          supabase.from("karts").select("id,number,name").order("number"),
          supabase.from("tracks").select("id,name,length_m").order("name"),
          supabase
            .from("rt004_transponders")
            .select("transponder_id,kart_id,pilot_id,portal_kart_id")
            .order("transponder_id"),
          supabase.from("pilots").select("id,name").order("name"),
        ]);

      if (cancelled) return;

      if (eventResult.error) {
        setError(`Não foi possível carregar os eventos: ${eventResult.error.message}`);
      } else {
        setEvents((eventResult.data || []) as EventRow[]);
      }

      if (sessionResult.error) {
        setError((current) =>
          current
            ? `${current} | Erro ao carregar sessões: ${sessionResult.error!.message}`
            : `Não foi possível carregar as sessões: ${sessionResult.error!.message}`
        );
      } else {
        const rows = (sessionResult.data || []) as SessionRow[];
        setSessions(rows);
        if (rows.length) setSessionId(rows[0].id);
      }

      if (!kartResult.error) setKarts((kartResult.data || []) as KartRow[]);
      if (!trackResult.error) setTracks((trackResult.data || []) as TrackRow[]);
      if (!transponderResult.error)
        setTransponders((transponderResult.data || []) as TransponderRow[]);
      if (!pilotResult.error) setPilots((pilotResult.data || []) as PilotRow[]);

      setLoading(false);
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const filteredSessions = useMemo(
    () => (eventId ? sessions.filter((s) => s.event_id === eventId) : sessions),
    [sessions, eventId]
  );

  useEffect(() => {
    if (sessionId && !filteredSessions.some((s) => s.id === sessionId)) {
      setSessionId(filteredSessions[0]?.id || "");
    } else if (!sessionId && filteredSessions.length) {
      setSessionId(filteredSessions[0].id);
    }
  }, [filteredSessions, sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLaps() {
      if (!supabase || !sessionId) {
        setLaps([]);
        return;
      }
      setLoadingLaps(true);
      setError("");

      // Pagina os resultados para não depender do limite padrão de linhas da API.
      const pageSize = 1000;
      let allRows: LapRow[] = [];
      let offset = 0;

      while (true) {
        const result = await supabase
          .from("rt004_laps")
          .select(
            "id,session_id,transponder_id,kart_id,lap_number,lap_time_ms,start_at,end_at"
          )
          .eq("session_id", sessionId)
          .order("start_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (result.error) {
          if (!cancelled) {
            setError(`Não foi possível carregar as voltas: ${result.error.message}`);
            setLaps([]);
          }
          break;
        }

        const batch = (result.data || []) as LapRow[];
        allRows = allRows.concat(batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      if (!cancelled) {
        setLaps(allRows);
        setLoadingLaps(false);
      }
    }

    void loadLaps();
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionId]);

  const pilotTransponders = useMemo(() => {
    if (!pilotId) return null;
    return new Set(
      transponders
        .filter((t) => t.pilot_id === pilotId)
        .map((t) => String(t.transponder_id))
    );
  }, [transponders, pilotId]);

  const visibleLaps = useMemo(() => {
    return laps.filter((lap) => {
      if (transponderId && String(lap.transponder_id) !== transponderId) return false;
      if (kartId) {
        const transponder = transponders.find((item) => item.transponder_id === lap.transponder_id);
        if (transponder?.portal_kart_id !== kartId) return false;
      }
      if (pilotTransponders && !pilotTransponders.has(String(lap.transponder_id))) return false;
      return true;
    });
  }, [laps, transponders, transponderId, kartId, pilotTransponders]);

  const bestLap = visibleLaps.reduce<number | null>((best, lap) => {
    if (lap.lap_time_ms == null) return best;
    return best == null || lap.lap_time_ms < best ? lap.lap_time_ms : best;
  }, null);

  const averageLap = visibleLaps.reduce(
    (acc, lap) => {
      if (lap.lap_time_ms != null) {
        acc.total += lap.lap_time_ms;
        acc.count += 1;
      }
      return acc;
    },
    { total: 0, count: 0 }
  );

  const selectedSession = sessions.find((session) => session.id === sessionId);
  const eventName = (id: string | null) =>
    events.find((event) => event.id === id)?.name || "Evento sem nome";
  const kartLabel = (lap: LapRow) => {
    const transponder = transponders.find((item) => item.transponder_id === lap.transponder_id);
    const kart = transponder?.portal_kart_id
      ? karts.find((item) => item.id === transponder.portal_kart_id)
      : undefined;
    if (kart) {
      const number = kart.number == null ? "" : String(kart.number).trim();
      const name = (kart.name || "").trim();
      return number && name ? `${number} — ${name}` : name || (number ? `Kart ${number}` : "Kart cadastrado");
    }
    // Não exibe os códigos técnicos KART-X/KART-Y como se fossem nomes reais.
    return "Kart sem associação";
  };
  const selectedEvent = events.find((event) => event.id === selectedSession?.event_id);
  const selectedTrack = tracks.find((track) => track.id === selectedEvent?.track_id);
  const trackLengthM = selectedTrack?.length_m == null ? null : Number(selectedTrack.length_m);
  const formatSpeed = (lapTimeMs: number | null, lengthM: number | null) => {
    if (lapTimeMs == null || lapTimeMs <= 0 || lengthM == null || !Number.isFinite(lengthM) || lengthM <= 0) return "—";
    return ((lengthM / (lapTimeMs / 1000)) * 3.6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };
  const transponderLabel = (id: number | null) => (id == null ? "—" : `Transponder ${id}`);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>ADIEM · LAP TIMER V1</div>
          <h1 style={styles.title}>Histórico de sessões e voltas</h1>
          <p style={styles.subtitle}>
            Consulte os registros salvos no Supabase sem alterar a cronometragem ao vivo.
          </p>
        </div>
        <a href="/" style={styles.backLink}>← Voltar ao tempo real</a>
      </header>

      {error && <div role="alert" style={styles.error}>{error}</div>}

      {!supabase && (
        <div style={styles.panel}>
          Configure as variáveis de ambiente do Supabase no EasyPanel e publique novamente.
        </div>
      )}

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Filtros</h2>
        <div style={styles.filters}>
          <label style={styles.label}>
            Evento
            <select
              style={styles.select}
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">Todos os eventos</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.name || "Evento sem nome"}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Sessão
            <select
              style={styles.select}
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">Selecione uma sessão</option>
              {filteredSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.test_name || eventName(session.event_id)} · {formatDate(session.started_at)}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Transponder
            <select style={styles.select} value={transponderId} onChange={(e) => setTransponderId(e.target.value)}>
              <option value="">Todos os transponders</option>
              {Array.from(new Set(laps.map((lap) => lap.transponder_id).filter((id): id is number => id != null)))
                .sort((a, b) => a - b)
                .map((id) => <option key={id} value={String(id)}>Transponder {id}</option>)}
            </select>
          </label>

          <label style={styles.label}>
            Kart
            <select style={styles.select} value={kartId} onChange={(e) => setKartId(e.target.value)}>
              <option value="">Todos os karts</option>
              {karts.map((kart) => (
                <option key={kart.id} value={kart.id}>{kart.number != null ? `Kart ${kart.number}` : "Kart"}{kart.name ? ` — ${kart.name}` : ""}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Piloto
            <select style={styles.select} value={pilotId} onChange={(e) => setPilotId(e.target.value)}>
              <option value="">Todos os pilotos</option>
              {pilots.map((pilot) => (
                <option key={pilot.id} value={pilot.id}>{pilot.name || pilot.id}</option>
              ))}
            </select>
          </label>
        </div>
        {selectedSession && (
          <p style={styles.note}>
            Pista: {selectedTrack?.name || "não informada"} · Extensão usada no cálculo: {trackLengthM != null && Number.isFinite(trackLengthM) && trackLengthM > 0 ? `${trackLengthM.toLocaleString("pt-BR")} m` : "metragem não cadastrada"}.
            A velocidade média da volta é calculada por extensão da pista ÷ tempo da volta.
          </p>
        )}
        {pilotId && !transponders.some((t) => t.pilot_id === pilotId) && (
          <p style={styles.note}>
            Este piloto não está associado a um transponder em rt004_transponders. Não é possível atribuir voltas a ele com segurança até cadastrar esse vínculo.
          </p>
        )}
      </section>

      <section style={styles.stats}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Voltas exibidas</span>
          <strong style={styles.statValue}>{visibleLaps.length}</strong>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Melhor volta</span>
          <strong style={styles.statValue}>{formatLap(bestLap)}</strong>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Média das voltas</span>
          <strong style={styles.statValue}>
            {averageLap.count ? formatLap(Math.round(averageLap.total / averageLap.count)) : "—"}
          </strong>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Status da sessão</span>
          <strong style={styles.statValueSmall}>
            {selectedSession?.finished_at ? "Encerrada" : selectedSession ? "Em andamento / sem encerramento" : "—"}
          </strong>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Voltas registradas</h2>
            <p style={styles.subtitle}>
              {selectedSession
                ? `${selectedSession.test_name || eventName(selectedSession.event_id)} · ${formatDate(selectedSession.started_at)}`
                : "Selecione uma sessão para visualizar as voltas."}
            </p>
          </div>
          {(loading || loadingLaps) && <span style={styles.loading}>Carregando…</span>}
        </div>

        {loading ? (
          <p>Carregando eventos e sessões…</p>
        ) : !sessionId ? (
          <p>Nenhuma sessão encontrada para os filtros selecionados.</p>
        ) : visibleLaps.length === 0 ? (
          <p>Nenhuma volta encontrada para os filtros selecionados.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Volta</th>
                  <th style={styles.th}>Tempo</th>
                  <th style={styles.th}>Transponder</th>
                  <th style={styles.th}>Kart</th>
                  <th style={styles.th}>Velocidade média (km/h)</th>
                  <th style={styles.th}>Início</th>
                  <th style={styles.th}>Fim</th>
                </tr>
              </thead>
              <tbody>
                {visibleLaps.map((lap) => (
                  <tr key={String(lap.id)}>
                    <td style={styles.td}>{lap.lap_number ?? "—"}</td>
                    <td style={{ ...styles.td, ...styles.timeCell }}>
                      {formatLap(lap.lap_time_ms)}
                      {lap.lap_time_ms != null && lap.lap_time_ms === bestLap && <span style={styles.bestBadge}>MELHOR</span>}
                    </td>
                    <td style={styles.td}>{transponderLabel(lap.transponder_id)}</td>
                    <td style={styles.td}>{kartLabel(lap)}</td>
                    <td style={styles.td}>{formatSpeed(lap.lap_time_ms, trackLengthM)}</td>
                    <td style={styles.td}>{formatDate(lap.start_at)}</td>
                    <td style={styles.td}>{formatDate(lap.end_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p style={styles.footer}>
        ADIEM V1 · Somente leitura. Esta página não grava nem altera dados no Supabase.
      </p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", padding: "32px clamp(16px, 4vw, 48px)", background: "#0b1220", color: "#e5edf8", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap", marginBottom: 28 },
  eyebrow: { color: "#67e8f9", fontSize: 12, fontWeight: 800, letterSpacing: 2 },
  title: { margin: "8px 0", fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 },
  subtitle: { color: "#94a3b8", margin: "6px 0 0", fontSize: 14 },
  backLink: { color: "#a5f3fc", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", textDecoration: "none", fontSize: 14, whiteSpace: "nowrap" },
  panel: { background: "#111c2e", border: "1px solid #243247", borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: "0 10px 28px rgba(0,0,0,.12)" },
  sectionTitle: { margin: "0 0 14px", fontSize: 18, fontWeight: 750 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 7, color: "#cbd5e1", fontSize: 13, fontWeight: 650 },
  select: { width: "100%", background: "#0b1220", color: "#e5edf8", border: "1px solid #334155", borderRadius: 9, padding: "11px 10px", minHeight: 42 },
  note: { color: "#fcd34d", background: "#422006", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.5 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 },
  statCard: { background: "#111c2e", border: "1px solid #243247", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 8 },
  statLabel: { color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .7 },
  statValue: { fontSize: 27, fontWeight: 800, color: "#f8fafc" },
  statValueSmall: { fontSize: 15, fontWeight: 750, color: "#f8fafc", lineHeight: 1.4 },
  tableHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  loading: { color: "#67e8f9", fontSize: 13 },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 980, fontSize: 13 },
  th: { textAlign: "left", padding: "12px 10px", color: "#94a3b8", borderBottom: "1px solid #334155", fontSize: 11, textTransform: "uppercase", letterSpacing: .6, whiteSpace: "nowrap" },
  td: { padding: "12px 10px", borderBottom: "1px solid #243247", whiteSpace: "nowrap", color: "#dbeafe" },
  timeCell: { fontWeight: 800, color: "#f8fafc" },
  bestBadge: { marginLeft: 8, display: "inline-block", borderRadius: 5, background: "#064e3b", color: "#a7f3d0", fontSize: 9, padding: "3px 5px", letterSpacing: .5 },
  error: { background: "#450a0a", border: "1px solid #7f1d1d", color: "#fecaca", borderRadius: 10, padding: 14, marginBottom: 18, lineHeight: 1.5 },
  footer: { color: "#64748b", fontSize: 12, textAlign: "center", margin: "26px 0 8px" },
};
