/**
 * Locale registry. `en` and `tr` ship complete inside `src/lib/i18n.ts`; every
 * other language lives in its own file here and is merged in as a translation
 * bundle. Files may be partial — any missing key falls back to English, so a
 * half-translated language is still safe to ship.
 *
 * To add a language: create `<code>.ts` (default-export the dictionary), import
 * it below, add it to `extraTranslations`, and add a row to `LOCALES`.
 */
import es from "./es";
import de from "./de";
import ar from "./ar";
import fr from "./fr";
import it from "./it";
import pt from "./pt";
import ru from "./ru";
import nl from "./nl";
import az from "./az";
import el from "./el";

export type LocaleMeta = { code: string; label: string; dir: "ltr" | "rtl" };

/** Every language offered in the picker (native names). */
export const LOCALES: LocaleMeta[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "zh", label: "中文", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "pt", label: "Português", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "de", label: "Deutsch", dir: "ltr" },
  { code: "nl", label: "Nederlands", dir: "ltr" },
  { code: "it", label: "Italiano", dir: "ltr" },
  { code: "ja", label: "日本語", dir: "ltr" },
  { code: "tr", label: "Türkçe", dir: "ltr" },
  { code: "az", label: "Azərbaycan dili", dir: "ltr" },
  { code: "ko", label: "한국어", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "fa", label: "فارسی", dir: "rtl" },
  { code: "ru", label: "Русский", dir: "ltr" },
  { code: "he", label: "עברית", dir: "rtl" },
  { code: "el", label: "Ελληνικά", dir: "ltr" },
];

/** Translations beyond en/tr. Partial dictionaries are fine (English fallback). */
export const extraTranslations: Record<string, Record<string, unknown>> = {
  es,
  de,
  ar,
  fr,
  it,
  pt,
  ru,
  nl,
  az,
  el,
};

const RTL_CODES = new Set(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code));

export function dirFor(code: string): "ltr" | "rtl" {
  return RTL_CODES.has(code.split("-")[0]) ? "rtl" : "ltr";
}

export const SUPPORTED_CODES = LOCALES.map((l) => l.code);

export function isSupported(code: string | null | undefined): boolean {
  return !!code && SUPPORTED_CODES.includes(code);
}
