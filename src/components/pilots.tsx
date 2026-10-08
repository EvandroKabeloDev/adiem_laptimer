"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Flag, Plus, RefreshCw, Trophy, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Pilot, PilotCategory } from "@/types/platform";

type PilotForm = {
  name: string;
  birth_date: string;
  category_id: string;
  status: "active" | "inactive";
};

const EMPTY_FORM: PilotForm = {
  name: "",
  birth_date: "",
  category_id: "",
  status: "active",
};

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function Pilots() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [categories, setCategories] = useState<PilotCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PilotForm>(EMPTY_FORM);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    const [pilotsResult, categoriesResult] = await Promise.all([
      supabase
        .from("pilots")
        .select("id,name,birth_date,category_id,status,created_at,updated_at")
        .order("name", { ascending: true }),
      supabase
        .from("pilot_categories")
        .select("id,name,status")
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

    if (pilotsResult.error) {
      setError(pilotsResult.error.message);
      setPilots([]);
    } else {
      setPilots((pilotsResult.data ?? []) as Pilot[]);
    }

    if (categoriesResult.error) {
      setCategories([]);
      if (!pilotsResult.error) {
        setError(`Pilotos carregados, mas não foi possível carregar categorias: ${categoriesResult.error.message}`);
      }
    } else {
      setCategories((categoriesResult.data ?? []) as PilotCategory[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCount = useMemo(
    () => pilots.filter((pilot) => pilot.status === "active").length,
    [pilots],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (!saving) setModalOpen(false);
  }

  function updateForm<K extends keyof PilotForm>(field: K, value: PilotForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createPilot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setError("Informe o nome do piloto.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("pilots").insert({
      name,
      birth_date: form.birth_date || null,
      category_id: form.category_id || null,
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
        <a className="nav-item" href="/events"><Flag size={17} />Eventos / Treinos</a>
        <a className="nav-item active" href="/pilots"><Trophy size={17} />Pilotos</a>
        <a className="nav-item" href="/events">Karts</a>
        <a className="nav-item" href="/tracks">Pistas</a>
        <a className="nav-item" href="/events">Coletores</a>
      </nav>

      <section className="platform-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">CADASTROS</div>
            <h1>Pilotos</h1>
            <p>Cadastre os pilotos que participarão dos eventos, treinos e sessões.</p>
          </div>

          <button className="primary-action" type="button" onClick={openCreateModal}>
            <Plus size={18} />
            Novo piloto
          </button>
        </div>

        <div className="event-stats">
          <div className="event-stat-card">
            <span>Total</span>
            <strong>{pilots.length}</strong>
          </div>
          <div className="event-stat-card highlight">
            <span>Ativos</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="event-stat-card">
            <span>Inativos</span>
            <strong>{pilots.length - activeCount}</strong>
          </div>
          <div className="event-stat-card">
            <span>Categorias disponíveis</span>
            <strong>{categories.length}</strong>
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
              <h2>Pilotos cadastrados</h2>
            </div>

            <button className="secondary-action" type="button" onClick={() => loadData(true)} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="events-empty">Carregando pilotos...</div>
          ) : pilots.length === 0 ? (
            <div className="events-empty">
              <Trophy size={34} />
              <strong>Nenhum piloto cadastrado</strong>
              <span>Cadastre o primeiro piloto para começar a montar os participantes dos eventos.</span>
              <button className="primary-action compact" type="button" onClick={openCreateModal}>
                <Plus size={16} /> Novo piloto
              </button>
            </div>
          ) : (
            <div className="events-list">
              {pilots.map((pilot) => (
                <article className="event-row" key={pilot.id}>
                  <div className="event-date-box">
                    <Trophy size={18} />
                    <strong>{pilot.status === "active" ? "ATIVO" : "INATIVO"}</strong>
                  </div>

                  <div className="event-main">
                    <div className="event-title-line">
                      <h3>{pilot.name}</h3>
                      <span className="event-type">PILOTO</span>
                    </div>
                    <div className="event-meta">
                      <span>Nascimento: {formatDate(pilot.birth_date)}</span>
                      <span>Categoria: {pilot.category_id ? categoryMap.get(pilot.category_id) ?? "Categoria não encontrada" : "Sem categoria"}</span>
                    </div>
                  </div>

                  <div className="event-side">
                    <span className={`event-status ${pilot.status === "active" ? "running" : "finished"}`}>
                      {pilot.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}>
          <section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="pilot-modal-title">
            <div className="modal-header">
              <div>
                <div className="panel-kicker">CADASTRO</div>
                <h2 id="pilot-modal-title">Novo piloto</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeModal} disabled={saving} aria-label="Fechar">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={createPilot}>
              {error ? (
                <div className="modal-alert">
                  <strong>Não foi possível salvar.</strong>
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="form-grid">
                <label className="field field-full">
                  <span>Nome completo</span>
                  <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Ex.: João da Silva" autoFocus />
                </label>

                <label className="field">
                  <span>Data de nascimento</span>
                  <input type="date" value={form.birth_date} onChange={(event) => updateForm("birth_date", event.target.value)} />
                </label>

                <label className="field">
                  <span>Categoria</span>
                  <select value={form.category_id} onChange={(event) => updateForm("category_id", event.target.value)}>
                    <option value="">Sem categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Status</span>
                  <select value={form.status} onChange={(event) => updateForm("status", event.target.value as PilotForm["status"])}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
                <button className="primary-action" type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar piloto"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
