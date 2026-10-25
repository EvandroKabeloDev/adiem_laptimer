"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Cpu, Gauge, RefreshCw, Save, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Kart = { id: string; number: string; name: string | null; status: string };
type Pilot = { id: string; first_name: string; last_name: string; status: string };
type Assignment = { transponder_id: number; kart_id: string | null; pilot_id: string | null; active: boolean };

export default function Transponders() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [karts, setKarts] = useState<Kart[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [newId, setNewId] = useState("");
  const [newKart, setNewKart] = useState("");
  const [newPilot, setNewPilot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [tr, kr, pr] = await Promise.all([
      supabase.from("rt004_transponders").select("transponder_id,kart_id,pilot_id,active").order("transponder_id"),
      supabase.from("karts").select("id,number,name,status").order("number"),
      supabase.from("pilots").select("id,first_name,last_name,status").order("first_name"),
    ]);
    if (tr.error) setError(`Não foi possível carregar transponders: ${tr.error.message}`);
    else setRows((tr.data ?? []) as Assignment[]);
    if (kr.error) setError((current) => current || `Não foi possível carregar karts: ${kr.error.message}`);
    else setKarts((kr.data ?? []) as Kart[]);
    if (pr.error) setError((current) => current || `Não foi possível carregar pilotos: ${pr.error.message}`);
    else setPilots((pr.data ?? []) as Pilot[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const kartMap = useMemo(() => new Map(karts.map(k => [k.id, k])), [karts]);
  const pilotMap = useMemo(() => new Map(pilots.map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()])), [pilots]);

  async function saveAssignment(row: Assignment) {
    setSaving(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("rt004_transponders").update({ kart_id: row.kart_id || null, pilot_id: row.pilot_id || null, active: row.active }).eq("transponder_id", row.transponder_id);
    if (updateError) setError(`Falha ao salvar o transponder ${row.transponder_id}: ${updateError.message}`);
    else setNotice(`Transponder ${row.transponder_id} atualizado.`);
    setSaving(false); await load();
  }

  async function addAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number(newId);
    if (!Number.isInteger(id) || id <= 0) { setError("Informe um ID de transponder inteiro e maior que zero."); return; }
    if (rows.some(r => r.transponder_id === id)) { setError("Esse transponder já está cadastrado."); return; }
    setSaving(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("rt004_transponders").insert({ transponder_id: id, kart_id: newKart || null, pilot_id: newPilot || null, active: true });
    if (insertError) setError(`Não foi possível cadastrar: ${insertError.message}`);
    else { setNotice(`Transponder ${id} cadastrado.`); setNewId(""); setNewKart(""); setNewPilot(""); }
    setSaving(false); await load();
  }

  function patch(id: number, patchValue: Partial<Assignment>) {
    setRows(current => current.map(r => r.transponder_id === id ? { ...r, ...patchValue } : r));
  }

  return <main className="timing-page">
    <header className="top-header"><div className="brand-area"><img src="/adiem-icon.png" alt="ADIEM" className="adiem-logo"/><div className="brand-text"><div className="brand-name">ADIEM</div><div className="brand-subtitle">Associação de Desenvolvimento e Incentivo de Esporte a Motor</div></div><div className="brand-divider"/><div className="product-name"><span>Racing</span> Gestão de Transponders</div></div><Link className="secondary-action" href="/">Voltar ao Live Timing</Link></header>
    <section className="page-content" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px", width: "100%" }}>
      <div className="page-heading" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}><div><h1>Transponder × Kart × Piloto</h1><p>Associe cada identificador RT004 ao kart e ao piloto responsável.</p></div><button className="secondary-action" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Atualizar</button></div>
      <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", margin: "20px 0" }}>
        <div className="panel"><Cpu/><div>Transponders cadastrados</div><strong style={{fontSize:28}}>{rows.length}</strong></div>
        <div className="panel"><Gauge/><div>Vínculos ativos</div><strong style={{fontSize:28}}>{rows.filter(r=>r.active).length}</strong></div>
        <div className="panel"><Trophy/><div>Cadastros de pilotos</div><strong style={{fontSize:28}}>{pilots.length}</strong></div>
        <div className="panel"><Activity/><div>Karts cadastrados</div><strong style={{fontSize:28}}>{karts.length}</strong></div>
      </div>
      {error && <div className="panel" role="alert" style={{borderColor:"#ef4444", color:"#fecaca", marginBottom:16}}>{error}</div>}
      {notice && <div className="panel" role="status" style={{borderColor:"#22c55e", color:"#bbf7d0", marginBottom:16}}>{notice}</div>}
      <section className="panel" style={{marginBottom:20}}><h2>Novo transponder</h2><form onSubmit={addAssignment} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,alignItems:"end"}}>
        <label>ID do transponder<input type="number" min="1" step="1" required value={newId} onChange={e=>setNewId(e.target.value)} placeholder="Ex.: 3" /></label>
        <label>Kart<select value={newKart} onChange={e=>setNewKart(e.target.value)}><option value="">Sem kart associado</option>{karts.filter(k=>k.status==="active").map(k=><option key={k.id} value={k.id}>Kart {k.number}{k.name?` — ${k.name}`:""}</option>)}</select></label>
        <label>Piloto<select value={newPilot} onChange={e=>setNewPilot(e.target.value)}><option value="">Sem piloto associado</option>{pilots.filter(p=>p.status==="active").map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>
        <button className="primary-action" type="submit" disabled={saving}><Save size={16}/> {saving?"Salvando…":"Cadastrar"}</button>
      </form></section>
      <section className="panel"><h2>Mapeamento atual</h2>{loading?<p>Carregando registros…</p>:rows.length===0?<p>Nenhum transponder cadastrado. Use o formulário acima para adicionar o primeiro.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:720}}><thead><tr>{["Transponder","Kart","Piloto","Status","Ação"].map(x=><th key={x} style={{textAlign:"left",padding:12,borderBottom:"1px solid #30343b"}}>{x}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.transponder_id}><td style={{padding:12,borderBottom:"1px solid #252a31"}}><strong>#{row.transponder_id}</strong></td><td style={{padding:12,borderBottom:"1px solid #252a31"}}><select aria-label={`Kart transponder ${row.transponder_id}`} value={row.kart_id??""} onChange={e=>patch(row.transponder_id,{kart_id:e.target.value||null})}><option value="">Não associado</option>{karts.map(k=><option key={k.id} value={k.id}>Kart {k.number}{k.name?` — ${k.name}`:""}</option>)}</select><small style={{display:"block",opacity:.65}}>{row.kart_id?kartMap.get(row.kart_id)?.name??"":""}</small></td><td style={{padding:12,borderBottom:"1px solid #252a31"}}><select aria-label={`Piloto transponder ${row.transponder_id}`} value={row.pilot_id??""} onChange={e=>patch(row.transponder_id,{pilot_id:e.target.value||null})}><option value="">Não associado</option>{pilots.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select><small style={{display:"block",opacity:.65}}>{row.pilot_id?pilotMap.get(row.pilot_id):""}</small></td><td style={{padding:12,borderBottom:"1px solid #252a31"}}><label style={{display:"inline-flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={row.active} onChange={e=>patch(row.transponder_id,{active:e.target.checked})}/> {row.active?"Ativo":"Inativo"}</label></td><td style={{padding:12,borderBottom:"1px solid #252a31"}}><button className="primary-action compact" disabled={saving} onClick={()=>void saveAssignment(row)}><Save size={15}/> Salvar</button></td></tr>)}</tbody></table></div>}</section>
      <p style={{opacity:.7,fontSize:13,marginTop:16}}>Dica: cadastre pilotos e karts primeiro. Desativar um transponder não apaga voltas antigas.</p>
    </section>
  </main>;
}
