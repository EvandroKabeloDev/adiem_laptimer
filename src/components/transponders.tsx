
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Cpu,
  Gauge,
  RefreshCw,
  Save,
  Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Kart = {
  id: string;
  number: string | number;
  name: string;
};

type Pilot = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
};

type Assignment = {
  transponder_id: number;
  kart_id: string | null;
  portal_kart_id: string | null;
  pilot_id: string | null;
  active: boolean;
};


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
    setLoading(true);
    setError("");

    try {
      const [tr, kr, pr] = await Promise.all([
        supabase
          .from("rt004_transponders")
          .select("transponder_id,kart_id,portal_kart_id,pilot_id,active")
          .order("transponder_id"),

        supabase
          .from("karts")
          .select("id,number,name")
          .order("number"),

        supabase
          .from("pilots")
          .select("id,first_name,last_name,status")
          .order("first_name"),
      ]);

      if (tr.error) {
        throw new Error(
          `Não foi possível carregar transponders: ${tr.error.message}`
        );
      }

      if (kr.error) {
        throw new Error(
          `Não foi possível carregar karts do portal: ${kr.error.message}`
        );
      }

      if (pr.error) {
        throw new Error(
          `Não foi possível carregar pilotos: ${pr.error.message}`
        );
      }

      setRows((tr.data ?? []) as Assignment[]);
      setKarts((kr.data ?? []) as Kart[]);
      setPilots((pr.data ?? []) as Pilot[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar os dados."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kartMap = useMemo(
    () => new Map(karts.map((kart) => [kart.id, kart])),
    [karts]
  );

  const pilotMap = useMemo(
    () =>
      new Map(
        pilots.map((pilot) => [
          pilot.id,
          `${pilot.first_name} ${pilot.last_name}`.trim(),
        ])
      ),
    [pilots]
  );

  async function saveAssignment(row: Assignment) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { data, error: updateError } = await supabase
        .from("rt004_transponders")
        .update({
          portal_kart_id: row.portal_kart_id || null,
          pilot_id: row.pilot_id || null,
          active: row.active,
        })
        .eq("transponder_id", row.transponder_id)
        .select("transponder_id")
        .maybeSingle();

      if (updateError) {
        throw new Error(`Não foi possível salvar: ${updateError.message}`);
      }

      if (!data) {
        throw new Error(
          "Nenhuma alteração foi gravada. Verifique a política de acesso UPDATE no Supabase."
        );
      }

      setNotice(`Transponder ${row.transponder_id} atualizado.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado ao salvar."
      );
    } finally {
      setSaving(false);
    }
  }

  async function addAssignment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const id = Number(newId);

    if (!Number.isInteger(id) || id <= 0) {
      setError("Informe um ID de transponder inteiro e maior que zero.");
      return;
    }

    if (rows.some((row) => row.transponder_id === id)) {
      setError("Esse transponder já está cadastrado.");
      return;
    }

    if (newKart && !karts.some((kart) => kart.id === newKart)) {
      setError("Selecione um kart válido do portal.");
      return;
    }

    if (
      newPilot &&
      !pilots.some((pilot) => pilot.id === newPilot)
    ) {
      setError("Selecione um piloto válido.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { error: insertError } = await supabase
        .from("rt004_transponders")
        .insert({
          transponder_id: id,
          portal_kart_id: newKart || null,
          pilot_id: newPilot || null,
          active: true,
        });

      if (insertError) {
        throw new Error(
          `Não foi possível cadastrar: ${insertError.message}`
        );
      }

      setNotice(`Transponder ${id} cadastrado.`);
      setNewId("");
      setNewKart("");
      setNewPilot("");

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar transponder."
      );
    } finally {
      setSaving(false);
    }
  }

  function patch(id: number, patchValue: Partial<Assignment>) {
    setRows((current) =>
      current.map((row) =>
        row.transponder_id === id ? { ...row, ...patchValue } : row
      )
    );
  }

  return (
    <main className="timing-page">
      <header className="top-header">
        <div className="brand-area">
          <img src="/adiem-icon.png" alt="ADIEM" />
          <div>
            <strong>ADIEM LapTimer</strong>
            <span>Gestão de transponders</span>
          </div>
        </div>

        <nav>
          <Link href="/">Painel</Link>
          <Link href="/karts">Karts</Link>
          <Link href="/pilots">Pilotos</Link>
        </nav>
      </header>

      <section
        className="page-content"
        style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}
      >
        <div
          className="page-heading"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1>Transponders</h1>
            <p>Associe cada transponder ao kart cadastrado no portal e ao piloto.</p>
          </div>

          <button
            type="button"
            className="secondary-action"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>

        <div
          className="dashboard-grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          }}
        >
          <div className="panel">
            <Cpu />
            <div>Transponders cadastrados</div>
            <strong style={{ fontSize: 28 }}>{rows.length}</strong>
          </div>

          <div className="panel">
            <Gauge />
            <div>Vínculos ativos</div>
            <strong style={{ fontSize: 28 }}>
              {rows.filter((row) => row.active).length}
            </strong>
          </div>

          <div className="panel">
            <Trophy />
            <div>Cadastros de pilotos</div>
            <strong style={{ fontSize: 28 }}>{pilots.length}</strong>
          </div>

          <div className="panel">
            <Activity />
            <div>Karts cadastrados no portal</div>
            <strong style={{ fontSize: 28 }}>{karts.length}</strong>
          </div>
        </div>

        {error && (
          <div
            className="panel"
            role="alert"
            style={{ borderColor: "#ef4444", color: "#ef4444" }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            className="panel"
            role="status"
            style={{ borderColor: "#22c55e", color: "#22c55e" }}
          >
            {notice}
          </div>
        )}

        <section className="panel" style={{ marginBottom: 20 }}>
          <h2>Novo transponder</h2>

          <form
            onSubmit={addAssignment}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 16,
              alignItems: "end",
            }}
          >
            <label>
              ID do transponder
              <input
                type="number"
                min="1"
                step="1"
                required
                value={newId}
                onChange={(event) => setNewId(event.target.value)}
              />
            </label>

            <label>
              Kart do portal
              <select
                value={newKart}
                onChange={(event) => setNewKart(event.target.value)}
              >
                <option value="">Não associado</option>
                {karts.map((kart) => (
                  <option key={kart.id} value={kart.id}>
                    {kart.number} - {kart.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Piloto
              <select
                value={newPilot}
                onChange={(event) => setNewPilot(event.target.value)}
              >
                <option value="">Não associado</option>
                {pilots.map((pilot) => (
                  <option key={pilot.id} value={pilot.id}>
                    {pilot.first_name} {pilot.last_name}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="primary-action"
              type="submit"
              disabled={saving}
            >
              <Save size={16} />
              Cadastrar
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Mapeamento atual</h2>

          {loading ? (
            <p>Carregando registros...</p>
          ) : rows.length === 0 ? (
            <p>Nenhum transponder cadastrado.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 12 }}>ID</th>
                    <th style={{ textAlign: "left", padding: 12 }}>
                      Kart do portal
                    </th>
                    <th style={{ textAlign: "left", padding: 12 }}>Piloto</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Status</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const kart = row.portal_kart_id
                      ? kartMap.get(row.portal_kart_id)
                      : undefined;

                    return (
                      <tr key={row.transponder_id}>
                        <td style={{ padding: 12 }}>
                          <strong>{row.transponder_id}</strong>
                        </td>

                        <td style={{ padding: 12, minWidth: 180 }}>
                          <select
                            aria-label={`Kart do transponder ${row.transponder_id}`}
                            value={row.portal_kart_id ?? ""}
                            onChange={(event) =>
                              patch(row.transponder_id, {
                                portal_kart_id: event.target.value || null,
                              })
                            }
                          >
                            <option value="">Não associado</option>
                            {karts.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.number} - {item.name}
                              </option>
                            ))}
                          </select>

                          {row.portal_kart_id && !kart && (
                            <small>
                              O kart vinculado não foi encontrado no cadastro do portal.
                            </small>
                          )}
                        </td>

                        <td style={{ padding: 12, minWidth: 200 }}>
                          <select
                            aria-label={`Piloto do transponder ${row.transponder_id}`}
                            value={row.pilot_id ?? ""}
                            onChange={(event) =>
                              patch(row.transponder_id, {
                                pilot_id: event.target.value || null,
                              })
                            }
                          >
                            <option value="">Não associado</option>
                            {pilots.map((pilot) => (
                              <option key={pilot.id} value={pilot.id}>
                                {pilot.first_name} {pilot.last_name}
                              </option>
                            ))}
                          </select>

                          {row.pilot_id && !pilotMap.has(row.pilot_id) && (
                            <small>Piloto não encontrado na lista.</small>
                          )}
                        </td>

                        <td style={{ padding: 12 }}>
                          <label>
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(event) =>
                                patch(row.transponder_id, {
                                  active: event.target.checked,
                                })
                              }
                            />
                            {row.active ? " Ativo" : " Inativo"}
                          </label>
                        </td>

                        <td style={{ padding: 12 }}>
                          <button
                            className="primary-action"
                            type="button"
                            disabled={saving}
                            onClick={() => void saveAssignment(row)}
                          >
                            <Save size={16} />
                            Salvar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ opacity: 0.7, fontSize: 13, marginTop: 16 }}>
            O vínculo com o kart do portal é salvo ao clicar em Salvar. A tela não solicita
            senha; o acesso de gravação depende das políticas RLS do Supabase.
          </p>
        </section>
      </section>
    </main>
  );
}
