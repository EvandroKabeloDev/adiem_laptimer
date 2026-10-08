"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Flag, Gauge, Plus, RefreshCw, Settings, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Kart, KartSetup, PilotCategory } from "@/types/platform";

type KartForm = {
  number: string;
  name: string;
  category_id: string;
  chassis: string;
  chassis_year: string;
  engine: string;
  status: "active" | "inactive";
  notes: string;
};

type SetupForm = {
  kart_id: string;
  name: string;
  setup_date: string;
  tire_brand: string;
  tire_model: string;
  tire_pressure_psi: string;
  front_sprocket: string;
  rear_sprocket: string;
  caster: string;
  camber: string;
  geometry: string;
  brake_pad_status: string;
  notes: string;
};

const EMPTY_KART_FORM: KartForm = {
  number: "",
  name: "",
  category_id: "",
  chassis: "",
  chassis_year: "",
  engine: "",
  status: "active",
  notes: "",
};

const EMPTY_SETUP_FORM: SetupForm = {
  kart_id: "",
  name: "",
  setup_date: "",
  tire_brand: "",
  tire_model: "",
  tire_pressure_psi: "",
  front_sprocket: "",
  rear_sprocket: "",
  caster: "",
  camber: "",
  geometry: "",
  brake_pad_status: "",
  notes: "",
};

function toNumber(value: string, label: string, allowDecimal = true) {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Informe ${label} corretamente.`);
  if (!allowDecimal && !Number.isInteger(parsed)) throw new Error(`Informe ${label} como número inteiro.`);
  return parsed;
}

function formatNumber(value: number | string | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") return "--";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return `${parsed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Data não informada";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function Karts() {
  const [karts, setKarts] = useState<Kart[]>([]);
  const [setups, setSetups] = useState<KartSetup[]>([]);
  const [categories, setCategories] = useState<PilotCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kartModalOpen, setKartModalOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [kartForm, setKartForm] = useState<KartForm>(EMPTY_KART_FORM);
  const [setupForm, setSetupForm] = useState<SetupForm>(EMPTY_SETUP_FORM);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    const [kartsResult, setupsResult, categoriesResult] = await Promise.all([
      supabase
        .from("karts")
        .select("id,number,name,category_id,chassis,chassis_year,engine,status,notes,created_at,updated_at")
        .order("number", { ascending: true }),
      supabase
        .from("kart_setups")
        .select("id,kart_id,name,setup_date,tire_brand,tire_model,tire_pressure_psi,front_sprocket,rear_sprocket,caster,camber,geometry,brake_pad_status,notes,created_at,updated_at")
        .order("setup_date", { ascending: false }),
      supabase
        .from("pilot_categories")
        .select("id,name,status")
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

    if (kartsResult.error) {
      setKarts([]);
      setError(kartsResult.error.message);
    } else {
      setKarts((kartsResult.data ?? []) as Kart[]);
    }

    if (setupsResult.error) {
      setSetups([]);
      if (!kartsResult.error) setError(`Karts carregados, mas não foi possível carregar setups: ${setupsResult.error.message}`);
    } else {
      setSetups((setupsResult.data ?? []) as KartSetup[]);
    }

    if (categoriesResult.error) {
      setCategories([]);
      if (!kartsResult.error && !setupsResult.error) setError(`Karts carregados, mas não foi possível carregar categorias: ${categoriesResult.error.message}`);
    } else {
      setCategories((categoriesResult.data ?? []) as PilotCategory[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCount = useMemo(() => karts.filter((kart) => kart.status === "active").length, [karts]);
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const setupCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const setup of setups) map.set(setup.kart_id, (map.get(setup.kart_id) ?? 0) + 1);
    return map;
  }, [setups]);

  function openKartModal() {
    setKartForm(EMPTY_KART_FORM);
    setError(null);
    setKartModalOpen(true);
  }

  function openSetupModal(kartId?: string) {
    setSetupForm({ ...EMPTY_SETUP_FORM, kart_id: kartId ?? "", setup_date: new Date().toISOString().slice(0, 10) });
    setError(null);
    setSetupModalOpen(true);
  }

  function closeModals() {
    if (!saving) {
      setKartModalOpen(false);
      setSetupModalOpen(false);
    }
  }

  function updateKartForm<K extends keyof KartForm>(field: K, value: KartForm[K]) {
    setKartForm((current) => ({ ...current, [field]: value }));
  }

  function updateSetupForm<K extends keyof SetupForm>(field: K, value: SetupForm[K]) {
    setSetupForm((current) => ({ ...current, [field]: value }));
  }

  async function createKart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = kartForm.number.trim();
    const name = kartForm.name.trim();
    if (!number) {
      setError("Informe o número do kart.");
      return;
    }

    let chassisYear: number | null = null;
    try {
      chassisYear = toNumber(kartForm.chassis_year, "o ano do chassi", false);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Dados inválidos.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("karts").insert({
      number,
      name: name || null,
      category_id: kartForm.category_id || null,
      chassis: kartForm.chassis.trim() || null,
      chassis_year: chassisYear,
      engine: kartForm.engine.trim() || null,
      status: kartForm.status,
      notes: kartForm.notes.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setKartModalOpen(false);
    setKartForm(EMPTY_KART_FORM);
    await loadData(true);
  }

  async function createSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setupForm.kart_id) {
      setError("Selecione o kart do setup.");
      return;
    }
    if (!setupForm.name.trim()) {
      setError("Informe o nome do setup.");
      return;
    }

    let tirePressure = null;
    let frontSprocket = null;
    let rearSprocket = null;
    let caster = null;
    let camber = null;

    try {
      tirePressure = toNumber(setupForm.tire_pressure_psi, "a pressão dos pneus");
      frontSprocket = toNumber(setupForm.front_sprocket, "o pinhão dianteiro", false);
      rearSprocket = toNumber(setupForm.rear_sprocket, "a coroa traseira", false);
      caster = toNumber(setupForm.caster, "o caster");
      camber = toNumber(setupForm.camber, "o cambêr");
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Dados inválidos.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("kart_setups").insert({
      kart_id: setupForm.kart_id,
      name: setupForm.name.trim(),
      setup_date: setupForm.setup_date || null,
      tire_brand: setupForm.tire_brand.trim() || null,
      tire_model: setupForm.tire_model.trim() || null,
      tire_pressure_psi: tirePressure,
      front_sprocket: frontSprocket,
      rear_sprocket: rearSprocket,
      caster,
      camber,
      geometry: setupForm.geometry.trim() || null,
      brake_pad_status: setupForm.brake_pad_status.trim() || null,
      notes: setupForm.notes.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSetupModalOpen(false);
    setSetupForm(EMPTY_SETUP_FORM);
    await loadData(true);
  }

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div className="platform-brand">
          <img src="/adiem-icon.png" alt="ADIEM" className="platform-logo" />
          <div>
            <div className="platform-brand-name">ADIEM</div>
            <div className="platform-brand-subtitle">Associação de Desenvolvimento e Incentivo de Esporte a Motor</div>
          </div>
        </div>
        <div className="platform-product"><span>Racing</span> Platform</div>
        <a href="/" className="timing-link">Live Timing <ChevronRight size={16} /></a>
      </header>

      <nav className="platform-nav" aria-label="Navegação principal">
        <a className="nav-item" href="/events"><Flag size={17} />Eventos / Treinos</a>
        <a className="nav-item" href="/pilots">Pilotos</a>
        <a className="nav-item active" href="/karts"><Gauge size={17} />Karts</a>
        <a className="nav-item" href="/tracks">Pistas</a>
        <a className="nav-item" href="/events">Coletores</a>
      </nav>

      <section className="platform-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">CADASTROS</div>
            <h1>Karts</h1>
            <p>Cadastre os karts e mantenha o histórico de configurações utilizadas.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="secondary-action" type="button" onClick={() => openSetupModal()} disabled={!karts.length}><Settings size={17} /> Novo setup</button>
            <button className="primary-action" type="button" onClick={openKartModal}><Plus size={18} /> Novo kart</button>
          </div>
        </div>

        <div className="event-stats">
          <div className="event-stat-card"><span>Total</span><strong>{karts.length}</strong></div>
          <div className="event-stat-card highlight"><span>Ativos</span><strong>{activeCount}</strong></div>
          <div className="event-stat-card"><span>Inativos</span><strong>{karts.length - activeCount}</strong></div>
          <div className="event-stat-card"><span>Setups cadastrados</span><strong>{setups.length}</strong></div>
        </div>

        {error && !kartModalOpen && !setupModalOpen ? (
          <div className="platform-alert"><strong>Não foi possível concluir a operação.</strong><span>{error}</span></div>
        ) : null}

        <section className="events-panel">
          <div className="events-panel-header">
            <div><div className="panel-kicker">CADASTRO</div><h2>Karts cadastrados</h2></div>
            <button className="secondary-action" type="button" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "spin" : ""} />Atualizar</button>
          </div>

          {loading ? <div className="events-empty">Carregando karts...</div> : karts.length === 0 ? (
            <div className="events-empty"><Gauge size={34} /><strong>Nenhum kart cadastrado</strong><span>Cadastre o primeiro kart para começar a associá-lo aos pilotos e eventos.</span><button className="primary-action compact" type="button" onClick={openKartModal}><Plus size={16} /> Novo kart</button></div>
          ) : (
            <div className="events-list">
              {karts.map((kart) => (
                <article className="event-row" key={kart.id}>
                  <div className="event-date-box"><Gauge size={18} /><strong>{kart.number}</strong></div>
                  <div className="event-main">
                    <div className="event-title-line"><h3>{kart.name || `Kart ${kart.number}`}</h3><span className="event-type">{kart.status === "active" ? "ATIVO" : "INATIVO"}</span></div>
                    <div className="event-meta">
                      <span>Categoria: {kart.category_id ? categoryMap.get(kart.category_id) ?? "Categoria não encontrada" : "Sem categoria"}</span>
                      <span>Chassi: {kart.chassis || "--"}{kart.chassis_year ? ` (${kart.chassis_year})` : ""}</span>
                      <span>Motor: {kart.engine || "--"}</span>
                      <span>Setups: {setupCountMap.get(kart.id) ?? 0}</span>
                    </div>
                  </div>
                  <div className="event-side"><button className="secondary-action" type="button" onClick={() => openSetupModal(kart.id)}><Settings size={15} /> Setup</button></div>
                </article>
              ))}
            </div>
          )}
        </section>

        {setups.length > 0 ? (
          <section className="events-panel" style={{ marginTop: 16 }}>
            <div className="events-panel-header"><div><div className="panel-kicker">CONFIGURAÇÃO</div><h2>Últimos setups</h2></div></div>
            <div className="events-list">
              {setups.slice(0, 12).map((setup) => {
                const kart = karts.find((item) => item.id === setup.kart_id);
                return <article className="event-row" key={setup.id}>
                  <div className="event-date-box"><Settings size={18} /><strong>{kart?.number ?? "--"}</strong></div>
                  <div className="event-main">
                    <div className="event-title-line"><h3>{setup.name}</h3><span className="event-type">SETUP</span></div>
                    <div className="event-meta"><span>Data: {formatDate(setup.setup_date)}</span><span>Pneus: {setup.tire_brand || "--"} {setup.tire_model || ""}</span><span>Pressão: {formatNumber(setup.tire_pressure_psi, " psi")}</span><span>Relação: {formatNumber(setup.front_sprocket)} / {formatNumber(setup.rear_sprocket)}</span></div>
                  </div>
                </article>;
              })}
            </div>
          </section>
        ) : null}
      </section>

      {kartModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModals(); }}>
          <section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="new-kart-title">
            <div className="modal-header"><div><div className="panel-kicker">NOVO CADASTRO</div><h2 id="new-kart-title">Novo kart</h2></div><button className="icon-button" type="button" onClick={closeModals} disabled={saving}><X size={19} /></button></div>
            <form onSubmit={createKart}>
              {error ? <div className="modal-alert">{error}</div> : null}
              <div className="form-grid">
                <label className="field"><span>Número *</span><input value={kartForm.number} onChange={(e) => updateKartForm("number", e.target.value)} placeholder="Ex.: 12" autoFocus /></label>
                <label className="field"><span>Nome / identificação</span><input value={kartForm.name} onChange={(e) => updateKartForm("name", e.target.value)} placeholder="Ex.: Kart principal" /></label>
                <label className="field"><span>Categoria</span><select value={kartForm.category_id} onChange={(e) => updateKartForm("category_id", e.target.value)}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="field"><span>Chassi</span><input value={kartForm.chassis} onChange={(e) => updateKartForm("chassis", e.target.value)} placeholder="Ex.: CRG Road Rebel" /></label>
                <label className="field"><span>Ano do chassi</span><input type="number" min="1950" max="2100" step="1" value={kartForm.chassis_year} onChange={(e) => updateKartForm("chassis_year", e.target.value)} /></label>
                <label className="field"><span>Motor</span><input value={kartForm.engine} onChange={(e) => updateKartForm("engine", e.target.value)} placeholder="Ex.: IAME X30" /></label>
                <label className="field"><span>Status</span><select value={kartForm.status} onChange={(e) => updateKartForm("status", e.target.value as KartForm["status"])}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
                <label className="field field-full"><span>Observações</span><textarea rows={3} value={kartForm.notes} onChange={(e) => updateKartForm("notes", e.target.value)} /></label>
              </div>
              <div className="modal-actions"><button className="secondary-action" type="button" onClick={closeModals} disabled={saving}>Cancelar</button><button className="primary-action" type="submit" disabled={saving}><Plus size={17} />{saving ? "Salvando..." : "Cadastrar kart"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {setupModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModals(); }}>
          <section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="new-setup-title">
            <div className="modal-header"><div><div className="panel-kicker">CONFIGURAÇÃO</div><h2 id="new-setup-title">Novo setup</h2></div><button className="icon-button" type="button" onClick={closeModals} disabled={saving}><X size={19} /></button></div>
            <form onSubmit={createSetup}>
              {error ? <div className="modal-alert">{error}</div> : null}
              <div className="form-grid">
                <label className="field"><span>Kart *</span><select value={setupForm.kart_id} onChange={(e) => updateSetupForm("kart_id", e.target.value)}><option value="">Selecione</option>{karts.map((kart) => <option key={kart.id} value={kart.id}>#{kart.number}{kart.name ? ` — ${kart.name}` : ""}</option>)}</select></label>
                <label className="field"><span>Nome do setup *</span><input value={setupForm.name} onChange={(e) => updateSetupForm("name", e.target.value)} placeholder="Ex.: Treino seco" autoFocus /></label>
                <label className="field"><span>Data</span><input type="date" value={setupForm.setup_date} onChange={(e) => updateSetupForm("setup_date", e.target.value)} /></label>
                <label className="field"><span>Marca do pneu</span><input value={setupForm.tire_brand} onChange={(e) => updateSetupForm("tire_brand", e.target.value)} /></label>
                <label className="field"><span>Modelo do pneu</span><input value={setupForm.tire_model} onChange={(e) => updateSetupForm("tire_model", e.target.value)} /></label>
                <label className="field"><span>Pressão (psi)</span><input type="number" step="0.1" value={setupForm.tire_pressure_psi} onChange={(e) => updateSetupForm("tire_pressure_psi", e.target.value)} /></label>
                <label className="field"><span>Pinhão dianteiro</span><input type="number" step="1" value={setupForm.front_sprocket} onChange={(e) => updateSetupForm("front_sprocket", e.target.value)} /></label>
                <label className="field"><span>Coroa traseira</span><input type="number" step="1" value={setupForm.rear_sprocket} onChange={(e) => updateSetupForm("rear_sprocket", e.target.value)} /></label>
                <label className="field"><span>Caster</span><input type="number" step="0.1" value={setupForm.caster} onChange={(e) => updateSetupForm("caster", e.target.value)} /></label>
                <label className="field"><span>Camber</span><input type="number" step="0.1" value={setupForm.camber} onChange={(e) => updateSetupForm("camber", e.target.value)} /></label>
                <label className="field"><span>Geometria</span><input value={setupForm.geometry} onChange={(e) => updateSetupForm("geometry", e.target.value)} placeholder="Ex.: alinhamento base" /></label>
                <label className="field"><span>Pastilha de freio</span><input value={setupForm.brake_pad_status} onChange={(e) => updateSetupForm("brake_pad_status", e.target.value)} placeholder="Ex.: nova / 70%" /></label>
                <label className="field field-full"><span>Observações</span><textarea rows={3} value={setupForm.notes} onChange={(e) => updateSetupForm("notes", e.target.value)} /></label>
              </div>
              <div className="modal-actions"><button className="secondary-action" type="button" onClick={closeModals} disabled={saving}>Cancelar</button><button className="primary-action" type="submit" disabled={saving}><Settings size={17} />{saving ? "Salvando..." : "Salvar setup"}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
