"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Flag, MapPin, Plus, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Track } from "@/types/platform";

type TrackForm = {
  name: string;
  kartodrome: string;
  length_m: string;
  configuration: string;
  status: "active" | "inactive";
};

const EMPTY_FORM: TrackForm = {
  name: "",
  kartodrome: "",
  length_m: "",
  configuration: "",
  status: "active",
};

export default function Tracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TrackForm>(EMPTY_FORM);

  const loadTracks = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    const { data, error: queryError } = await supabase
      .from("tracks")
      .select("id,name,kartodrome,length_m,configuration,status")
      .order("name", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setTracks([]);
    } else {
      setTracks((data ?? []) as Track[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const activeCount = useMemo(
    () => tracks.filter((track) => track.status === "active").length,
    [tracks],
  );

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (!saving) setModalOpen(false);
  }

  function updateForm<K extends keyof TrackForm>(field: K, value: TrackForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createTrack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const kartodrome = form.kartodrome.trim();
    const configuration = form.configuration.trim();

    if (!name) {
      setError("Informe o nome da pista.");
      return;
    }

    let length: number | null = null;
    if (form.length_m.trim()) {
      const normalized = form.length_m.trim().replace(",", ".");
      length = Number(normalized);
      if (!Number.isFinite(length) || length <= 0) {
        setError("Informe o comprimento da pista em metros.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("tracks").insert({
      name,
      kartodrome: kartodrome || null,
      length_m: length,
      configuration: configuration || null,
      status: form.status,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setForm(EMPTY_FORM);
    await loadTracks(true);
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
        <a className="nav-item" href="/events">
          <Flag size={17} />
          Eventos / Treinos
        </a>
        <a className="nav-item" href="/pilots">
          Pilotos
        </a>
        <a className="nav-item" href="/events">
          Karts
        </a>
        <a className="nav-item active" href="/tracks">
          <MapPin size={17} />
          Pistas
        </a>
        <a className="nav-item" href="/events">
          Coletores
        </a>
      </nav>

      <section className="platform-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">CADASTROS</div>
            <h1>Pistas</h1>
            <p>Cadastre os kartódromos e configurações que poderão ser usados nos eventos.</p>
          </div>

          <button className="primary-action" type="button" onClick={openCreateModal}>
            <Plus size={18} />
            Nova pista
          </button>
        </div>

        <div className="event-stats">
          <div className="event-stat-card">
            <span>Total</span>
            <strong>{tracks.length}</strong>
          </div>
          <div className="event-stat-card highlight">
            <span>Ativas</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="event-stat-card">
            <span>Inativas</span>
            <strong>{tracks.length - activeCount}</strong>
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
              <div className="panel-kicker">CADASTRO</div>
              <h2>Pistas cadastradas</h2>
            </div>

            <button
              className="secondary-action"
              type="button"
              onClick={() => loadTracks(true)}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="events-empty">Carregando pistas...</div>
          ) : tracks.length === 0 ? (
            <div className="events-empty">
              <div className="empty-racing-icon">
                <MapPin size={25} />
              </div>
              <strong>Nenhuma pista cadastrada</strong>
              <span>Cadastre a primeira pista para que ela apareça na criação de eventos.</span>
              <button className="primary-action compact" type="button" onClick={openCreateModal}>
                <Plus size={16} />
                Cadastrar primeira pista
              </button>
            </div>
          ) : (
            <div className="events-list">
              {tracks.map((track) => (
                <article className="event-row" key={track.id}>
                  <div className="event-date-box">
                    <MapPin size={18} />
                    <strong>{track.length_m ? `${track.length_m.toLocaleString("pt-BR")} m` : "--"}</strong>
                  </div>

                  <div className="event-main">
                    <div className="event-title-line">
                      <h3>{track.name}</h3>
                      <span className="event-type">
                        {track.status === "active" ? "Ativa" : "Inativa"}
                      </span>
                    </div>

                    <div className="event-meta">
                      <span>
                        <MapPin size={14} />
                        {track.kartodrome || "Kartódromo não informado"}
                      </span>
                      {track.configuration ? <span>{track.configuration}</span> : null}
                    </div>
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
            aria-labelledby="new-track-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="panel-kicker">NOVO CADASTRO</div>
                <h2 id="new-track-title">Nova pista</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeModal} disabled={saving}>
                <X size={19} />
              </button>
            </div>

            {error ? <div className="modal-alert">{error}</div> : null}

            <form onSubmit={createTrack}>
              <div className="form-grid">
                <label className="field field-full">
                  <span>Nome da pista *</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Ex.: Kartódromo de Interlagos"
                    autoFocus
                  />
                </label>

                <label className="field">
                  <span>Kartódromo / local</span>
                  <input
                    value={form.kartodrome}
                    onChange={(event) => updateForm("kartodrome", event.target.value)}
                    placeholder="Ex.: São Paulo - SP"
                  />
                </label>

                <label className="field">
                  <span>Comprimento (m)</span>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={form.length_m}
                    onChange={(event) => updateForm("length_m", event.target.value)}
                    placeholder="Ex.: 800"
                  />
                </label>

                <label className="field">
                  <span>Configuração</span>
                  <input
                    value={form.configuration}
                    onChange={(event) => updateForm("configuration", event.target.value)}
                    placeholder="Ex.: Sentido horário"
                  />
                </label>

                <label className="field">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value as TrackForm["status"])}
                  >
                    <option value="active">Ativa</option>
                    <option value="inactive">Inativa</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={closeModal} disabled={saving}>
                  Cancelar
                </button>
                <button className="primary-action" type="submit" disabled={saving}>
                  <Plus size={17} />
                  {saving ? "Salvando..." : "Cadastrar pista"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
