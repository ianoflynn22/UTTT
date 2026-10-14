# Agent rules
- Game rules live in src/lib/game.ts as pure functions with injectable rng; UI and AI must not duplicate rule logic (keeps online play/server validation consistent).
- Profiles and per-mode rating rows are created by a database trigger on signup; ratings are read-only to clients and must only be changed server-side (prevents rating tampering).
- Online moves are validated and applied server-side in src/lib/online-api.ts (makeMove) and written with the admin client under a move_seq optimistic lock; clients never write the games table directly.
- Online games persist the full GameState as JSON in games.state; hydrate it with fromJson from src/lib/game.ts, never hand-parse.
- Elo for a finished online game is applied once by the apply_elo_result security-definer SQL function (K=32); matchmaking and challenges run through find_or_create_match / challenge_friend / respond_challenge definer functions.
- A challenge is a games row with status 'waiting'; the security-definer respond_challenge accepts (→ 'active') or deletes it.
- Live board updates use Supabase realtime postgres_changes on public.games with a poll as fallback; challenge/queue listings poll.
- The installable phone app is a PWA: public/manifest.webmanifest, public/sw.js (pass-through) and icons registered in __root.tsx head.


- Analytics only loads after cookie consent (CookieBanner); legal pages share LegalPage layout (GDPR requirement).
- Username filter: public.username_is_blocked + profiles trigger is the gate; src/lib/username-filter.ts mirrors it for friendly UI errors.
- Shared challenge links (/c/$username) go through accept_invite_link (definer: auto-friends) then challenge_friend, so existing challenge rules still apply.
- Native store apps wrap the live site with Capacitor (capacitor.config.json server.url); builds happen locally in Xcode/Android Studio.
- Shared game links: host creates an open lobby (games row 'waiting', player_o NULL) via create_lobby and keeps it alive with lobby_heartbeat; /c/$username finds it with open_lobby (fresh within 60s) and joins with join_lobby, otherwise redirects home.
- Daily puzzle = beat a deterministic defender (defenderReply in src/lib/puzzle.ts) from a generated position with a known 5+ move winning line; server re-validates the full move list. Hinted days are never saved, so they break streaks.
- Account deletion (src/lib/account.functions.ts) removes the login and personal rows but keeps finished games, anonymising the profile to deleted-user-<id>; profiles has no FK to auth.users so it survives (opponents keep their history).
- Blocking is a friendships row with status blocked (requester = blocker), created via block_user; is_blocked guards requests, invite links and lobbies.
- Friend games (games.created_by set: challenges, rematches, share links) are unrated; apply_elo_result skips them. Only matchmaking games (created_by NULL) change Elo.
