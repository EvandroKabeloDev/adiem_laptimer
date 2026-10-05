# ADIEM Lap Timer — Live Timing MVP

MVP do portal de cronometragem para o LapWiz RT004.

## Stack

- Next.js 16 / App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- Supabase Realtime
- Docker / EasyPanel

## Fluxo

RT004 → BLE → Python (`021_live_timing.py`) → Supabase → Realtime → Portal

O MVP trabalha com uma única sessão/um transponder e usa `rt004_laps` como fonte das voltas.

## Variáveis

Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Nunca coloque uma service-role key no frontend.

## Supabase Realtime

No SQL Editor:

```sql
alter publication supabase_realtime add table public.rt004_laps;
```

Se a tabela já estiver na publication, ignore o erro de duplicidade.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Segurança

O laboratório atual usa RLS desabilitado. Isso é aceitável somente para o laboratório. Antes de expor o MVP publicamente, habilite RLS e crie policies adequadas.
