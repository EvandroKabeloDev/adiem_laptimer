"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Flag,
  Gauge,
  MapPin,
  Plus,
  RefreshCw,
  Trophy,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  EventStatus,
  EventType,
  EventVisibility,
  RacingEvent,
  Track,
} from "@/types/platform";

const EVENT_TYPES: Array<{ value: EventType; label: string }> = [
  { value: "training", label: "Treino Livre" },
  { value: "qualification", label: "Classificação" },
  { value: "race", label: "Corrida" },
  { value: "test", label: "Teste" },
  { value: "setup", label: "Acerto / Setup" },
  { value: "other", label: "Outro" },
];

const VISIBILITIES: Array<{ value: EventVisibility; label: string }> = [
  { value: "private", label: "Privado" },
  { value: "team", label: "Equipe" },
  { value: "public", label: "Público" },
];

const STATUS_LABELS: Record<EventStatus, string> = {
  scheduled: "Agendado",
  running: "Em andamento",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

const STATUS_CLASS: Record<EventStatus, string> = {
  scheduled: "event-status scheduled",
  running: "event-status running",
  finished: "event-status finished",
  cancelled: "event-status cancelled",
};

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(time: string | null) {
  if (!time) return "--:--";
  return time.slice(0, 5);
}

function eventTypeLabel(type: EventType) {
  return EVENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

type FormState = {
  name: string;
  event_type: EventType;
  track_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  visibility: EventVisibility;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  event_type: "training",
  track_id: "",
  event_date: todayIso(),
  start_time: "",
  end_time: "",
  visibility: "team",
  notes: "",
};

export default function EventsTraining() {
  const [events, setEvents] = useState<RacingEvent[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    const [eventsResult, tracksResult] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id,name,event_type,track_id,event_date,start_time,end_time,visibility,status,notes,created_at,updated_at,track:tracks(id,name,kartodrome,length_m,configuration,status)",
        )
        .order("event_date", { ascending: false })
        .order("start_time", { ascending: false }),
      supabase
        .from("tracks")
        .select("id,name,kartodrome,length_m,configuration,status")
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

    if (eventsResult.error || tracksResult.error) {
      setError(
        eventsResult.error?.message ??
          tracksResult.error?.message ??
          "Não foi possível carregar os dados.",
      );
    } else {
      const eventRows = eventsResult.data ?? [];

      setEvents(
        eventRows.map((event) => {
          const trackData = event.track;
          const track = Array.isArray(trackData)
            ? trackData[0] ?? null
            : trackData ?? null;

          return {
            ...event,
            track,
          } as RacingEvent;
        }),
      );

      setTracks((tracksResult.data ?? []) as Track[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const scheduled = events.filter((event) => event.status === "scheduled").length;
    const running = events.filter((event) => event.status === "running").length;
    const finished = events.filter((event) => event.status === "finished").length;

    return { total: events.length, scheduled, running, finished };
  }, [events]);

  function openCreateModal() {
    setForm({ ...EMPTY_FORM, event_date: todayIso() });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Informe o nome do evento.");
      return;
    }

    if (!form.event_date) {
      setError("Informe a data do evento.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("events").insert({
      name: form.name.trim(),
      event_type: form.event_type,
      track_id: form.track_id || null,
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      visibility: form.visibility,
      status: "scheduled",
      notes: form.notes.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setForm({ ...EMPTY_FORM, event_date: todayIso() });
    await loadData(true);
  }

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div className="platform-brand">
          <img src="/adiem-icon.png" alt="ADIEM" className="platform-logo" />
          <div>
            <div className="platform-brand-name">ADIEM</div>
            <div className="platform-brand-subtitle">
              Associação de Desenvolvimento e Incentivo de Esporte a Motor
            </div>
          </div>
        </div>

        <div className="platform-product">
          <span>Racing</span> Platform
        </div>

        <a href="/" className="timing-link">
          Live Timing <ChevronRight size={16} />
        </a>
      </header>

      <nav className="platform-nav" aria-label="Navegação principal">
        <a className="nav-item active" href="/events">
          <Flag size={17} />
          Eventos / Treinos
        </a>
        <a className="nav-item" href="/events">
          <Trophy size={17} />
          Pilotos
        </a>
        <a className="nav-item" href="/events">
          <Gauge size={17} />
          Karts
        </a>
        <a className="nav-item" href="/events">
          <RefreshCw size={17} />
          Coletores
        </a>
      </nav>

      <section className="platform-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">OPERAÇÃO</div>
            <h1>Eventos / Treinos</h1>
            <p>Organize treinos, classificações e corridas antes de iniciar o Live Timing.</p>
          </div>

          <button className="primary-action" type="button" onClick={openCreateModal}>
            <Plus size={18} />
            Novo evento
          </button>
        </div>

        <div className="event-stats">
          <div className="event-stat-card">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="event-stat-card">
            <span>Agendados</span>
            <strong>{stats.scheduled}</strong>
          </div>
          <div className="event-stat-card highlight">
            <span>Em andamento</span>
            <strong>{stats.running}</strong>
          </div>
          <div className="event-stat-card">
            <span>Finalizados</span>
            <strong>{stats.finished}</strong>
          </div>
        </div>

        {error && !modalOpen ? (
          <div className="platform-alert">
            <strong>Não foi possível concluir a operação.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <section className="events-panel">
          <div className="events-panel-header">
            <div>
              <div className="panel-kicker">AGENDA</div>
              <h2>Próximos eventos</h2>
            </div>

            <button
              className="secondary-action"
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="events-empty">Carregando eventos...</div>
          ) : events.length === 0 ? (
            <div className="events-empty">
              <div className="empty-racing-icon">
                <Flag size={25} />
              </div>
              <strong>Nenhum evento cadastrado</strong>
              <span>Crie o primeiro treino para começar a organizar a operação.</span>
              <button className="primary-action compact" type="button" onClick={openCreateModal}>
                <Plus size={16} />
                Criar primeiro evento
              </button>
            </div>
          ) : (
            <div className="events-list">
              {events.map((event) => (
                <article className="event-row" key={event.id}>
                  <div className="event-date-box">
                    <CalendarDays size={18} />
                    <strong>{formatDate(event.event_date)}</strong>
                  </div>

                  <div className="event-main">
                    <div className="event-title-line">
                      <h3>{event.name}</h3>
                      <span className="event-type">{eventTypeLabel(event.event_type)}</span>
                    </div>

                    <div className="event-meta">
                      <span>
                        <MapPin size={14} />
                        {event.track?.name ?? "Pista não definida"}
                      </span>
                      <span>
                        <Clock3 size={14} />
                        {formatTime(event.start_time)} — {formatTime(event.end_time)}
                      </span>
                      {event.track?.length_m ? (
                        <span>{event.track.length_m.toLocaleString("pt-BR")} m</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="event-side">
                    <span className={STATUS_CLASS[event.status]}>
                      {STATUS_LABELS[event.status]}
                    </span>
                    <button className="event-open-button" type="button" disabled>
                      Abrir
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            className="event-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-event-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="panel-kicker">NOVO REGISTRO</div>
                <h2 id="new-event-title">Novo evento</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeModal} disabled={saving}>
                <X size={19} />
              </button>
            </div>

            {error ? (
              <div className="modal-alert">{error}</div>
            ) : null}

            <form onSubmit={createEvent}>
              <div className="form-grid">
                <label className="field field-full">
                  <span>Nome do evento *</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Ex.: Treino Livre — Sábado"
                    autoFocus
                  />
                </label>

                <label className="field">
                  <span>Tipo</span>
                  <select
                    value={form.event_type}
                    onChange={(event) => updateForm("event_type", event.target.value as EventType)}
                  >
                    {EVENT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Pista</span>
                  <select
                    value={form.track_id}
                    onChange={(event) => updateForm("track_id", event.target.value)}
                  >
                    <option value="">Selecionar pista</option>
                    {tracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Data *</span>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(event) => updateForm("event_date", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Visibilidade</span>
                  <select
                    value={form.visibility}
                    onChange={(event) => updateForm("visibility", event.target.value as EventVisibility)}
                  >
                    {VISIBILITIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Horário inicial</span>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(event) => updateForm("start_time", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Horário final</span>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(event) => updateForm("end_time", event.target.value)}
                  />
                </label>

                <label className="field field-full">
                  <span>Observações</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    placeholder="Informações adicionais sobre o treino ou evento..."
                    rows={4}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={closeModal} disabled={saving}>
                  Cancelar
                </button>
                <button className="primary-action" type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Criar evento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
