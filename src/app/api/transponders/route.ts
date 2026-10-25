
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Variáveis do Supabase ausentes no servidor.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function authorized(req: NextRequest) {
  const expected = process.env.ADIEM_ADMIN_PASSWORD;
  const supplied = req.headers.get("x-admin-password");

  return Boolean(expected && supplied && supplied === expected);
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "Senha administrativa inválida ou não configurada." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const id = Number(body.transponder_id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const supabase = getClient();

    const { data, error } = await supabase
      .from("rt004_transponders")
      .update({
        kart_id: body.kart_id || null,
        pilot_id: body.pilot_id || null,
        active: body.active === true,
      })
      .eq("transponder_id", id)
      .select("transponder_id,kart_id,pilot_id,active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json(
        { error: `Transponder ${id} não encontrado ou não atualizado.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}
