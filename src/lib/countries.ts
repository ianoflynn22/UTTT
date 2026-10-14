const CODES =
  "AR AU AT BE BR BG CA CL CN CO HR CZ DK EG EE FI FR DE GR HK HU IS IN ID IE IL IT JP KE LV LT LU MY MX MA NL NZ NG NO PK PE PH PL PT RO RU SA RS SG SK SI ZA KR ES SE CH TW TH TR UA AE GB US VN".split(" ");

export function flag(code?: string | null) {
  if (!code) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryList() {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
}
