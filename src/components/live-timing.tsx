 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Gauge, Radio, Timer, Trophy, Wifi, WifiOff, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Lap, Session } from "@/types/timing";

const POLL_MS = 2000;
const CLOCK_MS = 50;

function formatLap(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "--.---";
  return `${(ms / 1000).toFixed(3)} s`;
}

function formatClock(ms: number) {
  const safe = Math.max(0, ms);
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function formatRelative(iso: string, sessionStart: string | null) {
  if (!sessionStart) return "--";
  const value = new Date(iso).getTime() - new Date(sessionStart).getTime();
  return `${(value / 1000).toFixed(3)} s`;
}

function consecutiveBest(laps: Lap[], count: number) {
  if (laps.length < count) return null;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= laps.length - count; i++) {
    let total = 0;
    for (let j = 0; j < count; j++) total += laps[i + j].lap_time_ms;
    best = Math.min(best, total);
  }
  return Number.isFinite(best) ? best : null;
}

export default function LiveTiming() {
  const [session, setSession] = useState<Session | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadLatest = useCallback(async () => {
    const { data: latest, error: sessionError } = await supabase
      .from("rt004_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError || !latest) {
      setConnected(false);
      return;
    }

    setSession(latest as Session);

    const { data: lapRows, error: lapError } = await supabase
      .from("rt004_laps")
      .select("*")
      .eq("session_id", latest.id)
      .order("lap_number", { ascending: true });

    if (lapError) {
      setConnected(false);
      return;
    }

    setLaps((lapRows ?? []) as Lap[]);
    setConnected(true);
    setLastSync(new Date());
  }, []);

  useEffect(() => {
    void loadLatest();
    const interval = window.setInterval(() => void loadLatest(), POLL_MS);
    return () => window.clearInterval(interval);
  }, [loadLatest]);

  useEffect(() => {
    const channel = supabase
      .channel("rt004-live-laps")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "rt004_laps",
      }, (payload) => {
        const lap = payload.new as Lap;
        setLaps((current) => {
          if (current.some((item) => item.id === lap.id)) return current;
          return [...current, lap].sort((a, b) => a.lap_number - b.lap_number);
        });
        setLastSync(new Date());
        setConnected(true);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
      });

    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const lastLap = laps[laps.length - 1] ?? null;
  const currentLapNumber = lastLap ? lastLap.lap_number + 1 : 1;
  const currentLapMs = lastLap ? Math.max(0, now - new Date(lastLap.end_at).getTime()) : 0;

  const bestLap = useMemo(() => laps.length ? Math.min(...laps.map(l => l.lap_time_ms)) : null, [laps]);
  const average = useMemo(() => laps.length ? laps.reduce((s, l) => s + l.lap_time_ms, 0) / laps.length : null, [laps]);
  const best2 = useMemo(() => consecutiveBest(laps, 2), [laps]);
  const best3 = useMemo(() => consecutiveBest(laps, 3), [laps]);

  return (
    <main className="racer-grid min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#26313d] bg-[#080b0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#26313d] bg-[#111821] text-[var(--green)]"><Zap size={19} /></div>
            <div>
              <h1 className="text-lg font-black tracking-tight sm:text-xl">LAPWIZ <span className="text-[var(--green)]">RT004</span></h1>
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#687582]">Racing Live Timing</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#26313d] bg-[#0d1117] px-3 py-2 text-xs font-bold">
            {connected ? <Wifi size={14} className="text-[var(--green)]" /> : <WifiOff size={14} className="text-[var(--red)]" />}
            <span className={connected ? "text-[var(--green)]" : "text-[var(--red)]"}>{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-5 rounded-xl border border-[#5b4b17] bg-[#1b170b] px-4 py-3 text-xs text-[#e8c85c]">
          <div className="font-black uppercase tracking-[.12em]">Modo experimental</div>
          <div className="mt-1 text-[#b9a451]">Type 02 está sendo utilizado como referência de passagem e sua interpretação continua em validação.</div>
        </div>

        <section className="scanline glow-green relative overflow-hidden rounded-2xl border border-[#26313d] bg-[#0d1117] p-5 sm:p-7">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[rgba(53,242,138,.05)] blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#71808d]"><Radio size={14} />Live timing</div>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <div>
                  <div className="text-4xl font-black tracking-tight">KART 01</div>
                  <div className="mt-1 text-sm text-[#7d8996]">Piloto não cadastrado</div>
                </div>
                <div className="rounded-lg border border-[#26313d] bg-[#080b0f] px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#687582]">RT004</div>
                  <div className="mono mt-1 text-xs text-[#b8c2cc]">{session?.device_name ?? "Aguardando..."}</div>
                </div>
              </div>
            </div>

            <div className="min-w-[270px] text-left lg:text-right">
              <div className="text-[11px] font-black uppercase tracking-[.18em] text-[#71808d]">Volta atual</div>
              <div className="mt-1 text-3xl font-black text-[var(--green)]">#{currentLapNumber}</div>
              <div className="live-clock mt-1 text-5xl font-black text-white sm:text-6xl">{formatClock(currentLapMs)}</div>
              <div className="mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[var(--green)] lg:justify-end"><Activity size={13} />Em pista</div>
            </div>
          </div>

          <div className="relative mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Última volta" value={formatLap(lastLap?.lap_time_ms)} accent="green" />
            <Metric label="Melhor volta" value={formatLap(bestLap)} accent="cyan" />
            <Metric label="Média" value={formatLap(average)} />
            <Metric label="Voltas" value={String(laps.length)} />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#26313d] bg-[#0d1117]">
          <SectionHeader icon={<Timer size={16} />} title="Histórico de voltas" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="border-b border-[#26313d] bg-[#0a0e13] text-[10px] uppercase tracking-[.14em] text-[#687582]">
                <tr><th className="px-4 py-3">Volta</th><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Lap time</th><th className="px-4 py-3">Δ contador</th><th className="px-4 py-3">Contador inicial</th><th className="px-4 py-3">Contador final</th></tr>
              </thead>
              <tbody>
                {[...laps].reverse().map((lap) => {
                  const best = lap.lap_time_ms === bestLap;
                  return (
                    <tr key={lap.id} className="border-b border-[#1b232c] last:border-0">
                      <td className="px-4 py-3 font-black">{lap.lap_number}</td>
                      <td className="mono px-4 py-3 text-xs text-[#9ba7b2]">{formatRelative(lap.end_at, session?.started_at ?? null)}</td>
                      <td className={`px-4 py-3 font-black ${best ? "text-[var(--green)]" : ""}`}>{formatLap(lap.lap_time_ms)} {best ? "★" : ""}</td>
                      <td className="mono px-4 py-3 text-xs">{lap.counter_delta?.toLocaleString("pt-BR") ?? "--"}</td>
                      <td className="mono px-4 py-3 text-xs text-[#71808d]">{lap.counter_start?.toLocaleString("pt-BR") ?? "--"}</td>
                      <td className="mono px-4 py-3 text-xs text-[#71808d]">{lap.counter_end?.toLocaleString("pt-BR") ?? "--"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!laps.length && <div className="px-6 py-12 text-center text-sm text-[#71808d]">Aguardando a primeira volta...</div>}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-[#26313d] bg-[#0d1117]">
            <SectionHeader icon={<Trophy size={16} />} title="Performance" />
            <div className="grid grid-cols-3 divide-x divide-[#26313d]"><Stat label="Melhor volta" value={formatLap(bestLap)} /><Stat label="2 consecutivas" value={formatLap(best2)} /><Stat label="3 consecutivas" value={formatLap(best3)} /></div>
          </section>
          <section className="overflow-hidden rounded-2xl border border-[#26313d] bg-[#0d1117]">
            <SectionHeader icon={<Gauge size={16} />} title="Sistema" />
            <div className="grid grid-cols-2 divide-x divide-[#26313d]"><Stat label="Sessão" value={session?.id?.slice(0, 8) ?? "--"} mono /><Stat label="Última sincronização" value={lastSync ? lastSync.toLocaleTimeString("pt-BR") : "--"} mono /></div>
          </section>
        </div>

        <footer className="py-7 text-center text-[10px] font-bold uppercase tracking-[.18em] text-[#4e5a66]">LapWiz RT004 • Experimental timing platform • MVP</footer>
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "green" | "cyan" }) {
  const color = accent === "green" ? "text-[var(--green)]" : accent === "cyan" ? "text-[var(--cyan)]" : "text-white";
  return <div className="rounded-xl border border-[#26313d] bg-[#080b0f] p-4"><div className="text-[10px] font-black uppercase tracking-[.15em] text-[#687582]">{label}</div><div className={`mono mt-2 text-2xl font-black ${color}`}>{value}</div></div>;
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2 border-b border-[#26313d] px-5 py-4 text-sm font-black"><span className="text-[var(--green)]">{icon}</span>{title}</div>;
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="p-5"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#687582]">{label}</div><div className={`mt-2 text-sm font-black ${mono ? "mono" : ""}`}>{value}</div></div>;
}