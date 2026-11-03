"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Save, Cpu } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Device = { transponder_id: number; active: boolean; portal_kart_id: string | null; pilot_id: string | null };
type Kart = { id: string; number: number | string; name: string };
type Pilot = { id: string; first_name: string; last_name: string };

export default function Transponders() {
  const [rows, setRows] = useState<Device[]>([]);
  const [karts, setKarts] = useState<Kart[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [newId, setNewId] = useState("");
  const [drafts, setDrafts] = useState<Record<number, { portal_kart_id: string; pilot_id: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [d, k, p] = await Promise.all([
      supabase.from("rt004_transponders").select("transponder_id,active,portal_kart_id,pilot_id").order("transponder_id"),
      supabase.from("karts").select("id,number,name").order("number"),
      supabase.from("pilots").select("id,first_name,last_name").order("first_name"),
    ]);
    const failure = [d.error, k.error, p.error].find(Boolean);
    if (failure) { setError(failure.message); return; }
    const devices = (d.data ?? []) as Device[];
    setRows(devices);
    setKarts((k.data ?? []) as Kart[]);
    setPilots((p.data ?? []) as Pilot[]);
    setDrafts(Object.fromEntries(devices.map(row => [row.transponder_id, {
      portal_kart_id: row.portal_kart_id ?? "", pilot_id: row.pilot_id ?? "",
    }])));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(newId);
    if (!Number.isInteger(id) || id <= 0 || rows.some(r => r.transponder_id === id)) {
      setError("Informe um ID inteiro positivo ainda não cadastrado."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const { error } = await supabase.from("rt004_transponders").insert({ transponder_id: id, portal_kart_id: null, pilot_id: null, active: true });
    if (error) setError(`Não foi possível cadastrar: ${error.message}`);
    else { setNotice(`Transponder ${id} cadastrado no inventário.`); setNewId(""); await load(); }
    setBusy(false);
  }

  async function saveDefaults(row: Device) {
    const draft = drafts[row.transponder_id];
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    const { error } = await supabase.from("rt004_transponders").update({
      portal_kart_id: draft.portal_kart_id || null,
      pilot_id: draft.pilot_id || null,
    }).eq("transponder_id", row.transponder_id);
    if (error) setError(`Falha ao salvar transponder ${row.transponder_id}: ${error.message}`);
    else { setNotice(`Vínculos padrão do transponder ${row.transponder_id} atualizados.`); await load(); }
    setBusy(false);
  }

  async function toggle(row: Device) {
    setBusy(true); setError(""); setNotice("");
    const { error } = await supabase.from("rt004_transponders").update({ active: !row.active }).eq("transponder_id", row.transponder_id);
    if (error) setError(error.message); else { setNotice(`Transponder ${row.transponder_id} atualizado.`); await load(); }
    setBusy(false);
  }

  return <main className="timing-page">
    <header className="top-header"><div className="brand-area"><img src="/adiem-icon.png" alt="ADIEM" /><div><strong>ADIEM LapTimer</strong><span>Inventário de transponders</span></div></div><nav><Link href="/">Painel</Link><Link href="/karts">Karts</Link><Link href="/pilots">Pilotos</Link></nav></header>
    <section className="page-content" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1>Transponders</h1>
      <p>Cadastre os dispositivos e mantenha vínculos padrão. A associação efetiva de cada volta é definida na distribuição da sessão e preservada no histórico temporal.</p>
      <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><Cpu /><strong>{rows.length} dispositivos cadastrados</strong><button className="secondary-action" onClick={() => void load()}><RefreshCw size={16}/> Atualizar</button></div>
      {error && <div className="panel" style={{ color: "#ff7373" }}>{error}</div>}
      {notice && <div className="panel" style={{ color: "#40df93" }}>{notice}</div>}
      <section className="panel"><h2>Novo transponder</h2><form onSubmit={add} style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}><label style={{ display: "grid", gap: 6 }}>ID físico<input type="number" min="1" step="1" required value={newId} onChange={e => setNewId(e.target.value)} /></label><button className="primary-action" disabled={busy}><Save size={16}/> Cadastrar</button></form></section>
      <section className="panel"><h2>Dispositivos cadastrados</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse" }}><thead><tr>{["Transponder", "Kart padrão", "Piloto padrão", "Status", "Ações"].map(x => <th key={x} style={{ textAlign: "left", padding: 12 }}>{x}</th>)}</tr></thead><tbody>{rows.map(r => {
        const draft = drafts[r.transponder_id] ?? { portal_kart_id: "", pilot_id: "" };
        const selectStyle: React.CSSProperties = { minWidth: 150, padding: "9px 10px", borderRadius: 8, border: "1px solid #27313a", background: "#0c1015", color: "#f4f6f8" };
        return <tr key={r.transponder_id}>
          <td style={{ padding: 12 }}>ID {r.transponder_id}</td>
          <td style={{ padding: 12 }}><select style={selectStyle} value={draft.portal_kart_id} disabled={busy} onChange={e => setDrafts(old => ({ ...old, [r.transponder_id]: { ...draft, portal_kart_id: e.target.value } }))}><option value="">Não definido</option>{karts.map(k => <option key={k.id} value={k.id}>{k.number} - {k.name}</option>)}</select></td>
          <td style={{ padding: 12 }}><select style={selectStyle} value={draft.pilot_id} disabled={busy} onChange={e => setDrafts(old => ({ ...old, [r.transponder_id]: { ...draft, pilot_id: e.target.value } }))}><option value="">Não definido</option>{pilots.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></td>
          <td style={{ padding: 12 }}>{r.active ? "Ativo" : "Inativo"}</td>
          <td style={{ padding: 12, display: "flex", gap: 8 }}><button className="primary-action" disabled={busy} onClick={() => void saveDefaults(r)}>Salvar vínculos</button><button className="secondary-action" disabled={busy} onClick={() => void toggle(r)}>{r.active ? "Desativar" : "Ativar"}</button></td>
        </tr>;
      })}</tbody></table></div></section>
    </section>
  </main>;
}
