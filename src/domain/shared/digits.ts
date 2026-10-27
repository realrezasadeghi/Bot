const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const DIGIT_MAP = new Map<string, string>();
for (let index = 0; index < 10; index += 1) {
  DIGIT_MAP.set(String(index), String(index));
  DIGIT_MAP.set(PERSIAN_DIGITS[index]!, String(index));
  DIGIT_MAP.set(ARABIC_INDIC_DIGITS[index]!, String(index));
  DIGIT_MAP.set(EXTENDED_ARABIC_DIGITS[index]!, String(index));
}

export function normalizeDigits(input: string): string {
  let result = "";
  for (const character of input) {
    result += DIGIT_MAP.get(character) ?? character;
  }
  return result;
}

const ARABIC_TO_PERSIAN_LETTERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ي/g, "ی"],
  [/ك/g, "ک"],
  [/ۀ/g, "ه"],
  [/أ/g, "ا"],
  [/إ/g, "ا"],
  [/ٱ/g, "ا"],
];

export function normalizePersianText(input: string): string {
  let result = input;
  for (const [pattern, replacement] of ARABIC_TO_PERSIAN_LETTERS) {
    result = result.replace(pattern, replacement);
  }
  return result
    .replace(/\u200c/g, " ")
    .replace(/\u200f|\u200e/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

export function normalizeForMatching(input: string): string {
  return normalizePersianText(normalizeDigits(input))
    .replace(/[.,;:،؛\-_/\\()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
