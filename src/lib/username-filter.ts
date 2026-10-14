// Mirrors public.username_is_blocked in the database (the database is the real gate).
// Light touch: only slurs and the worst words, matched after undoing simple letter swaps.
const BLOCKED =
  /(nigg|niga|faggot|fagot|retard|tranny|kike|chink|wetback|gook|raghead|towelhead|beaner|hitler|kkk|rapist|negro)/;

const SWAPS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", _: "" };

export function isUsernameBlocked(name: string): boolean {
  const n = name.toLowerCase().replace(/[013457@$_]/g, (c) => SWAPS[c] ?? c);
  return BLOCKED.test(n);
}

export const BLOCKED_MSG = "That username isn't allowed. Please pick another.";
