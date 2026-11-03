"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = { sessionId: string | null; active: boolean };
type Device = { transponder_id: number; active: boolean };
type RtKart = { id: string; code: string };
type Kart = { id: string; number: number | string; name: string };
type Pilot = { id: string; first_name: string; last_name: string };
type Assignment = {
  id: string; transponder_id: number; rt004_kart_id: string | null; portal_kart_id: string;
  pilot_id: string | null; started_at: string; ended_at: string | null;
};

const panel: React.CSSProperties = { marginBottom: 16, padding: 16 };
const field: React.CSSProperties = { display: "grid", gap: 6, minWidth: 150, flex: "1 1 170px" };
const input: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, border: "1px solid #27313a", background: "#0c1015", color: "#f4f6f8" };

export default function SessionAssignments({ sessionId, active }: Props) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [rtKarts, setRtKarts] = useState<RtKart[]>([]);
  const [karts, setKarts] = useState<Kart[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [transponder, setTransponder] = useState("");
  const [rtKart, setRtKart] = useState("");
  const [kart, setKart] = useState("");
  const [pilot, setPilot] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!sessionId) { setRows([]); return; }
    const [d, rk, k, p, a] = await Promise.all([
      supabase.from("rt004_transponders").select("transponder_id,active").eq("active", true).order("transponder_id"),
      supabase.from("rt004_karts").select("id,code").order("code"),
      supabase.from("karts").select("id,number,name").order("number"),
      supabase.from("pilots").select("id,first_name,last_name").order("first_name"),
      supabase.from("rt004_session_transponders").select("id,transponder_id,rt004_kart_id,portal_kart_id,pilot_id,started_at,ended_at").eq("session_id", sessionId).order("started_at", { ascending: false }),
    ]);
    const failure = [d.error, rk.error, k.error, p.error, a.error].find(Boolean);
    if (failure) { setMessage(`Falha ao carregar associações: ${failure.message}`); return; }
    setDevices((d.data ?? []) as Device[]);
    setRtKarts((rk.data ?? []) as RtKart[]);
    setKarts((k.data ?? []) as Kart[]);
    setPilots((p.data ?? []) as Pilot[]);
    setRows((a.data ?? []) as Assignment[]);
    if (!transponder && d.data?.length) setTransponder(String(d.data[0].transponder_id));
    if (!rtKart && rk.data?.length) setRtKart(rk.data[0].id);
    if (!kart && k.data?.length) setKart(k.data[0].id);
  }, [sessionId, transponder, rtKart, kart]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !transponder || !rtKart || !kart) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("set_rt004_session_transponder_v2", {
      p_session_id: sessionId,
      p_transponder_id: Number(transponder),
      p_rt004_kart_id: rtKart,
      p_portal_kart_id: kart,
      p_pilot_id: pilot || null,
      p_effective_at: new Date().toISOString(),
    });
    if (error) setMessage(`Não foi possível registrar a associação: ${error.message}`);
    else {
      setMessage(`Transponder ${transponder} associado. O histórico anterior foi preservado.`);
      await load();
    }
    setBusy(false);
  }

  const kartLabel = (id: string) => {
    const item = karts.find(x => x.id === id);
    return item ? `${item.number} - ${item.name}` : "Kart não encontrado";
  };
  const rtKartLabel = (id: string | null) => rtKarts.find(x => x.id === id)?.code ?? "Não informado";
  const pilotLabel = (id: string | null) => {
    const item = pilots.find(x => x.id === id);
    return item ? `${item.first_name} ${item.last_name}` : "Não informado";
  };

  return <section className="panel" style={panel}>
    <div className="panel-title" style={{ marginBottom: 8 }}>Distribuição de transponders nesta sessão</div>
    <p style={{ color: "#8e9aa7", fontSize: 12, marginTop: 0 }}>
      A associação começa no instante do registro. Para trocar o transponder de kart, registre uma nova associação; a anterior será encerrada sem apagar o histórico.
    </p>
    {!sessionId ? <p>Inicie uma sessão para distribuir os transponders.</p> : <>
      <form onSubmit={save} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        <label style={field}>Transponder<select style={input} value={transponder} onChange={e => setTransponder(e.target.value)} disabled={!active || busy}><option value="">Selecione</option>{devices.map(d => <option key={d.transponder_id} value={d.transponder_id}>ID {d.transponder_id}</option>)}</select></label>
        <label style={field}>Kart RT004<select style={input} value={rtKart} onChange={e => setRtKart(e.target.value)} disabled={!active || busy}><option value="">Selecione</option>{rtKarts.map(k => <option key={k.id} value={k.id}>{k.code}</option>)}</select></label>
        <label style={field}>Kart do portal<select style={input} value={kart} onChange={e => setKart(e.target.value)} disabled={!active || busy}><option value="">Selecione</option>{karts.map(k => <option key={k.id} value={k.id}>{k.number} - {k.name}</option>)}</select></label>
        <label style={field}>Piloto<select style={input} value={pilot} onChange={e => setPilot(e.target.value)} disabled={!active || busy}><option value="">Não informado</option>{pilots.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>
        <button className="primary-action" type="submit" disabled={!active || busy || !transponder || !rtKart || !kart}>{busy ? "Salvando..." : "Registrar / trocar associação"}</button>
      </form>
      {message && <p role="status" style={{ color: message.startsWith("Não") || message.startsWith("Falha") ? "#ff7373" : "#40df93" }}>{message}</p>}
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Transponder", "Kart RT004", "Kart portal", "Piloto", "Início", "Fim", "Status"].map(x => <th key={x} style={{ textAlign: "left", padding: 8 }}>{x}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}>
            <td style={{ padding: 8 }}>{r.transponder_id}</td><td style={{ padding: 8 }}>{rtKartLabel(r.rt004_kart_id)}</td><td style={{ padding: 8 }}>{kartLabel(r.portal_kart_id)}</td><td style={{ padding: 8 }}>{pilotLabel(r.pilot_id)}</td>
            <td style={{ padding: 8 }}>{new Date(r.started_at).toLocaleTimeString("pt-BR")}</td><td style={{ padding: 8 }}>{r.ended_at ? new Date(r.ended_at).toLocaleTimeString("pt-BR") : "—"}</td><td style={{ padding: 8 }}>{r.ended_at ? "Histórico" : "Em uso"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
