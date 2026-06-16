/**
 * Länder-Emoji-Flaggen.
 *
 * football-data.org liefert Teamnamen auf Englisch (z.B. "Germany").
 * Wir mappen den Namen auf das passende Flaggen-Emoji.
 *
 * Die Emojis bestehen aus zwei Regional-Indicator-Symbolen (ISO-3166 Alpha-2).
 * Statt jede Flagge hart zu hinterlegen, mappen wir Ländername -> ISO-Code
 * und erzeugen das Emoji daraus.
 */

// Ländername (wie von football-data.org geliefert) -> ISO-3166 Alpha-2 Code
const NAME_TO_ISO: Record<string, string> = {
  // Europa
  Germany: "DE",
  France: "FR",
  England: "GB-ENG", // Sonderfall, siehe unten
  Spain: "ES",
  Portugal: "PT",
  Netherlands: "NL",
  Belgium: "BE",
  Croatia: "HR",
  Italy: "IT",
  Switzerland: "CH",
  Denmark: "DK",
  Poland: "PL",
  Austria: "AT",
  Serbia: "RS",
  Scotland: "GB-SCT",
  Wales: "GB-WLS",
  Norway: "NO",
  Ukraine: "UA",
  Sweden: "SE",
  Turkey: "TR",
  "Czech Republic": "CZ",
  Czechia: "CZ",
  Hungary: "HU",
  Slovakia: "SK",
  Slovenia: "SI",
  Greece: "GR",
  Romania: "RO",
  Ireland: "IE",

  // Südamerika
  Brazil: "BR",
  Argentina: "AR",
  Uruguay: "UY",
  Colombia: "CO",
  Ecuador: "EC",
  Peru: "PE",
  Chile: "CL",
  Paraguay: "PY",
  Venezuela: "VE",
  Bolivia: "BO",

  // Nord-/Mittelamerika & Karibik
  "United States": "US",
  USA: "US",
  Mexico: "MX",
  Canada: "CA",
  "Costa Rica": "CR",
  Panama: "PA",
  Jamaica: "JM",
  Honduras: "HN",
  "Curaçao": "CW",
  Curacao: "CW",

  // Afrika
  Morocco: "MA",
  Senegal: "SN",
  Tunisia: "TN",
  Algeria: "DZ",
  Egypt: "EG",
  Nigeria: "NG",
  Cameroon: "CM",
  Ghana: "GH",
  "Ivory Coast": "CI",
  "Côte d'Ivoire": "CI",
  "South Africa": "ZA",
  Mali: "ML",
  "Cape Verde": "CV",
  "Cabo Verde": "CV",

  // Asien & Ozeanien
  Japan: "JP",
  "South Korea": "KR",
  "Korea Republic": "KR",
  "IR Iran": "IR",
  Iran: "IR",
  "Saudi Arabia": "SA",
  Australia: "AU",
  Qatar: "QA",
  "United Arab Emirates": "AE",
  Iraq: "IQ",
  Uzbekistan: "UZ",
  Jordan: "JO",
  "New Zealand": "NZ",
};

// England/Schottland/Wales haben keine eigenen Regional-Indicator-Emojis,
// nutzen stattdessen die speziellen "Subdivision Flag"-Emojis.
const SUBDIVISION_FLAGS: Record<string, string> = {
  "GB-ENG": "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "GB-SCT": "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "GB-WLS": "🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
};

const FALLBACK_FLAG = "🏳️";

/** Erzeugt aus einem ISO Alpha-2 Code das Regional-Indicator-Flaggen-Emoji. */
function isoToEmoji(iso: string): string {
  if (SUBDIVISION_FLAGS[iso]) {
    return SUBDIVISION_FLAGS[iso];
  }
  if (iso.length !== 2) {
    return FALLBACK_FLAG;
  }
  const codePoints = iso
    .toUpperCase()
    .split("")
    .map((char) => 0x1f1e6 + (char.charCodeAt(0) - 0x41));
  return String.fromCodePoint(...codePoints);
}

/**
 * Liefert das Flaggen-Emoji für einen Teamnamen.
 * Unbekannte Teams bekommen eine neutrale Flagge (nie ein Fehler).
 */
export function flagFor(teamName: string): string {
  const iso = NAME_TO_ISO[teamName.trim()];
  if (!iso) {
    return FALLBACK_FLAG;
  }
  return isoToEmoji(iso);
}
