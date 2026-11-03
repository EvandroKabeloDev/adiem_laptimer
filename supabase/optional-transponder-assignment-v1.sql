-- ADIEM LapTimer V1 — kart e piloto opcionais por associação temporal.
-- Não apaga nem reescreve associações ou voltas históricas.
ALTER TABLE public.rt004_session_transponders
  ALTER COLUMN portal_kart_id DROP NOT NULL;

-- As voltas também precisam aceitar uma passagem sem associação.
ALTER TABLE public.rt004_laps
  ALTER COLUMN session_transponder_id DROP NOT NULL,
  ALTER COLUMN portal_kart_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.set_rt004_session_transponder_optional_v1(
  p_session_id uuid,
  p_transponder_id integer,
  p_rt004_kart_id uuid DEFAULT NULL,
  p_portal_kart_id uuid DEFAULT NULL,
  p_pilot_id uuid DEFAULT NULL,
  p_effective_at timestamptz DEFAULT now()
)
RETURNS public.rt004_session_transponders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_session public.rt004_sessions%ROWTYPE;
  v_transponder public.rt004_transponders%ROWTYPE;
  v_previous public.rt004_session_transponders%ROWTYPE;
  v_result public.rt004_session_transponders%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR p_transponder_id IS NULL OR p_transponder_id <= 0 THEN
    RAISE EXCEPTION 'Sessão e transponder são obrigatórios.';
  END IF;

  IF p_effective_at IS NULL THEN
    RAISE EXCEPTION 'Horário efetivo inválido.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_session_id::text || ':' || p_transponder_id::text, 0)
  );

  SELECT *
    INTO v_session
    FROM public.rt004_sessions
   WHERE id = p_session_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada.';
  END IF;

  IF v_session.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'Não é possível associar transponder em sessão encerrada.';
  END IF;

  IF p_effective_at < v_session.started_at THEN
    RAISE EXCEPTION 'O horário da associação não pode ser anterior ao início da sessão.';
  END IF;

  SELECT *
    INTO v_transponder
    FROM public.rt004_transponders
   WHERE transponder_id = p_transponder_id
   FOR UPDATE;

  IF NOT FOUND OR v_transponder.active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Transponder não encontrado ou inativo.';
  END IF;

  IF p_rt004_kart_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rt004_karts WHERE id = p_rt004_kart_id
  ) THEN
    RAISE EXCEPTION 'Kart RT004 não encontrado.';
  END IF;

  IF p_portal_kart_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.karts WHERE id = p_portal_kart_id
  ) THEN
    RAISE EXCEPTION 'Kart do portal não encontrado.';
  END IF;

  IF p_pilot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pilots WHERE id = p_pilot_id
  ) THEN
    RAISE EXCEPTION 'Piloto não encontrado.';
  END IF;

  SELECT *
    INTO v_previous
    FROM public.rt004_session_transponders
   WHERE session_id = p_session_id
     AND transponder_id = p_transponder_id
     AND ended_at IS NULL
   ORDER BY started_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF p_effective_at < v_previous.started_at THEN
      RAISE EXCEPTION 'O horário informado é anterior à associação atual.';
    END IF;

    UPDATE public.rt004_session_transponders
       SET ended_at = p_effective_at
     WHERE id = v_previous.id;
  END IF;

  -- Um kart não pode estar atribuído simultaneamente a dois transponders.
  -- Quando p_portal_kart_id é NULL, não há conflito de kart a validar.
  IF p_portal_kart_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.rt004_session_transponders a
     WHERE a.session_id = p_session_id
       AND a.transponder_id <> p_transponder_id
       AND a.portal_kart_id = p_portal_kart_id
       AND a.started_at <= p_effective_at
       AND (a.ended_at IS NULL OR a.ended_at > p_effective_at)
  ) THEN
    RAISE EXCEPTION 'Este kart já está associado a outro transponder neste horário.';
  END IF;

  INSERT INTO public.rt004_session_transponders (
    session_id,
    transponder_id,
    rt004_kart_id,
    portal_kart_id,
    pilot_id,
    started_at,
    ended_at
  )
  VALUES (
    p_session_id,
    p_transponder_id,
    p_rt004_kart_id,
    p_portal_kart_id,
    p_pilot_id,
    p_effective_at,
    NULL
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_rt004_session_transponder_optional_v1(
  uuid, integer, uuid, uuid, uuid, timestamptz
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
