# ADIEM LapTimer V1 — kart e piloto opcionais

## O que muda
- O transponder ativo é o único vínculo obrigatório para registrar voltas.
- Kart e piloto podem ficar vazios no inventário e na distribuição de uma sessão.
- A distribuição da sessão pode ser criada com kart, piloto, ambos ou nenhum.
- O backend grava a passagem mesmo quando não existe uma associação temporal.
- Voltas sem associação ficam com `session_transponder_id`, `kart_id` e `portal_kart_id` nulos; `transponder_id` e `session_id` continuam preenchidos.
- A numeração de voltas passa a seguir o transponder dentro da sessão, inclusive antes/depois de associações.

## Ordem de implantação
1. No Supabase SQL Editor, execute `supabase/optional-transponder-assignment-v1.sql`.
2. Confirme que o SQL terminou sem erro.
3. Faça deploy do portal.
4. Faça deploy do backend MQTT.
5. Inicie uma nova sessão, selecione um transponder ativo e deixe Kart e Piloto como "Não informado".
6. Passe o transponder pelo sensor e confirme que uma linha foi inserida em `public.rt004_laps`.

## Consulta de validação
```sql
SELECT
  id,
  session_id,
  transponder_id,
  session_transponder_id,
  portal_kart_id,
  lap_number,
  lap_time_ms,
  start_at,
  end_at
FROM public.rt004_laps
WHERE session_id = '<UUID_DA_SESSAO>'
ORDER BY end_at DESC
LIMIT 20;
```

Para voltas sem associação, `transponder_id` deve estar preenchido e `session_transponder_id`/`portal_kart_id` podem ser `NULL`.

## Compatibilidade
- Não remove tabelas, colunas, associações nem voltas antigas.
- Mantém `rt004_kart_id` como coluna legada, gravando `NULL` para novas voltas sem kart RT004.
- A função anterior `set_rt004_session_transponder_v2` não é removida.
- O novo portal usa `set_rt004_session_transponder_optional_v1`.
