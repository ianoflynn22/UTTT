create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_role text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = _role
  );
$$;

insert into public.user_roles (user_id, role)
values ('154aea1e-4bdb-4483-a524-73c25dae4c58', 'admin');

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $func$
declare
  result jsonb;
begin
  if not public.has_role('admin') then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'total_players', (select count(*) from public.profiles),
    'signups_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'games_total', (select count(*) from public.games),
    'games_active', (select count(*) from public.games where status = 'active'),
    'games_finished', (select count(*) from public.games where status = 'finished'),
    'games_7d', (select count(*) from public.games where created_at > now() - interval '7 days'),
    'active_players_7d', (select count(distinct p) from (
        select player_x as p from public.games where created_at > now() - interval '7 days'
        union select player_o from public.games where created_at > now() - interval '7 days') t),
    'games_by_mode', (select coalesce(jsonb_object_agg(mode, c), '{}'::jsonb) from (
        select mode, count(*) as c from public.games group by mode) m),
    'finished_by_mode', (select coalesce(jsonb_object_agg(mode, c), '{}'::jsonb) from (
        select mode, count(*) as c from public.games where status = 'finished' group by mode) m),
    'analyses_total', (select count(*) from public.game_analyses),
    'friendships_total', (select count(*) from public.friendships where status = 'accepted')
  ) into result;

  return result;
end
$func$;