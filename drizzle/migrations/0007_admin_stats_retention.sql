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
    'friendships_total', (select count(*) from public.friendships where status = 'accepted'),
    'retention', jsonb_build_object(
      'players_older_7d', (select count(*) from public.profiles where created_at < now() - interval '7 days'),
      'returned_week_1', (select count(distinct p) from (
          select g.player_x as p, g.created_at from public.games g
          union select g.player_o, g.created_at from public.games g) t
          join public.profiles pr on pr.id = t.p
          where pr.created_at < now() - interval '7 days'
            and t.created_at > pr.created_at + interval '1 day'),
      'returned_after_7d', (select count(distinct p) from (
          select g.player_x as p, g.created_at from public.games g
          union select g.player_o, g.created_at from public.games g) t
          join public.profiles pr on pr.id = t.p
          where t.created_at > pr.created_at + interval '7 days'),
      'multi_game_players', (select count(*) from (
          select u from (
            select player_x as u from public.games
            union all select player_o from public.games) allp
          group by u having count(*) > 1) mg)
    )
  ) into result;

  return result;
end
$func$;