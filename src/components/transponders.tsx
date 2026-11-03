"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Save, Cpu } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Device = { transponder_id: number; active: boolean };
export default function Transponders() {
  const [rows, setRows] = useState<Device[]>([]);
  const [newId, setNewId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("rt004_transponders").select("transponder_id,active").order("transponder_id");
    if (error) setError(error.message); else setRows((data ?? []) as Device[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(newId);
    if (!Number.isInteger(id) || id <= 0 || rows.some(r => r.transponder_id === id)) {
      setError("Informe um ID inteiro positivo ainda não cadastrado."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const { error } = await supabase.from("rt004_transponders").insert({ transponder_id: id, kart_id: null, portal_kart_id: null, pilot_id: null, active: true });
    if (error) setError(`Não foi possível cadastrar: ${error.message}`);
    else { setNotice(`Transponder ${id} cadastrado no inventário.`); setNewId(""); await load(); }
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
      <h1>Transponders</h1><p>Cadastre dispositivos independentemente de kart ou piloto. A distribuição acontece dentro de cada sessão.</p>
      <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><Cpu /><strong>{rows.length} dispositivos cadastrados</strong><button className="secondary-action" onClick={() => void load()}><RefreshCw size={16}/> Atualizar</button></div>
      {error && <div className="panel" style={{ color: "#ff7373" }}>{error}</div>}
      {notice && <div className="panel" style={{ color: "#40df93" }}>{notice}</div>}
      <section className="panel"><h2>Novo transponder</h2><form onSubmit={add} style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}><label style={{ display: "grid", gap: 6 }}>ID físico<input type="number" min="1" step="1" required value={newId} onChange={e => setNewId(e.target.value)} /></label><button className="primary-action" disabled={busy}><Save size={16}/> Cadastrar</button></form></section>
      <section className="panel"><h2>Dispositivos cadastrados</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={{ textAlign: "left", padding: 12 }}>Transponder</th><th style={{ textAlign: "left", padding: 12 }}>Status</th><th style={{ textAlign: "left", padding: 12 }}>Ação</th></tr></thead><tbody>{rows.map(r => <tr key={r.transponder_id}><td style={{ padding: 12 }}>ID {r.transponder_id}</td><td style={{ padding: 12 }}>{r.active ? "Ativo" : "Inativo"}</td><td style={{ padding: 12 }}><button className="secondary-action" disabled={busy} onClick={() => void toggle(r)}>{r.active ? "Desativar" : "Ativar"}</button></td></tr>)}</tbody></table></div></section>
    </section>
  </main>;
}
