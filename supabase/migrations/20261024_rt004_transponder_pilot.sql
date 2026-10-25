-- ADIEM RT004: permite associar um transponder ao piloto atual.
-- Seguro para executar mais de uma vez; preserva os vínculos e voltas existentes.
alter table public.rt004_transponders
  add column if not exists pilot_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rt004_transponders_pilot_id_fkey'
      and conrelid = 'public.rt004_transponders'::regclass
  ) then
    alter table public.rt004_transponders
      add constraint rt004_transponders_pilot_id_fkey
      foreign key (pilot_id) references public.pilots(id) on delete set null;
  end if;
end $$;

create index if not exists idx_rt004_transponders_pilot_id
  on public.rt004_transponders(pilot_id);
