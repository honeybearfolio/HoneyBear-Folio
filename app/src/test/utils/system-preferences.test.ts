import { afterEach, describe, expect, it } from "vitest";
import { APP_DEFAULTS, STORAGE_KEYS } from "../../constants/app";
import {
  applySystemPreferencesIfNeeded,
  detectSystemPreferences,
} from "../../utils/system-preferences";

describe("detectSystemPreferences", () => {
  it("maps en-US to English, US number format, USD, and Sunday", () => {
    expect(detectSystemPreferences("en-US")).toEqual({
      uiLanguage: "en",
      locale: "en-US",
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      firstDayOfWeek: 0,
    });
  });

  it("maps es-ES to Spanish, European numbers, EUR, and Monday", () => {
    expect(detectSystemPreferences("es-ES")).toEqual({
      uiLanguage: "es",
      locale: "de-DE",
      currency: "EUR",
      dateFormat: "DD/MM/YYYY",
      firstDayOfWeek: 1,
    });
  });

  it("maps fr-FR to French number grouping and EUR", () => {
    expect(detectSystemPreferences("fr-FR")).toEqual({
      uiLanguage: "en",
      locale: "fr-FR",
      currency: "EUR",
      dateFormat: "DD/MM/YYYY",
      firstDayOfWeek: 1,
    });
  });

  it("maps de-CH to apostrophe grouping, CHF, and dotted dates", () => {
    expect(detectSystemPreferences("de-CH")).toEqual({
      uiLanguage: "en",
      locale: "de-CH",
      currency: "CHF",
      dateFormat: "DD.MM.YYYY",
      firstDayOfWeek: 1,
    });
  });

  it("maps en-IN to Indian grouping and INR", () => {
    expect(detectSystemPreferences("en-IN")).toEqual({
      uiLanguage: "en",
      locale: "en-IN",
      currency: "INR",
      dateFormat: "DD/MM/YYYY",
      firstDayOfWeek: 0,
    });
  });

  it("snaps a usable but unrecognized tag from its Intl signature", () => {
    expect(detectSystemPreferences("xx")).toEqual({
      uiLanguage: "en",
      locale: "en-US",
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      firstDayOfWeek: 1,
    });
  });

  it("falls back to built-in defaults for an unusable tag", () => {
    expect(detectSystemPreferences("not a locale")).toEqual({
      uiLanguage: APP_DEFAULTS.UI_LANGUAGE,
      locale: APP_DEFAULTS.LOCALE,
      currency: APP_DEFAULTS.CURRENCY,
      dateFormat: APP_DEFAULTS.DATE_FORMAT,
      firstDayOfWeek: APP_DEFAULTS.FIRST_DAY_OF_WEEK,
    });
  });
});

describe("applySystemPreferencesIfNeeded", () => {
  const originalLanguage = navigator.language;

  function setLanguage(tag: string) {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: tag,
    });
  }

  afterEach(() => {
    localStorage.clear();
    setLanguage(originalLanguage);
  });

  it("writes detected preferences on a fresh install", () => {
    localStorage.clear();
    setLanguage("es-ES");

    applySystemPreferencesIfNeeded();

    expect(localStorage.getItem(STORAGE_KEYS.UI_LANGUAGE)).toBe("es");
    expect(localStorage.getItem(STORAGE_KEYS.NUMBER_FORMAT)).toBe("de-DE");
    expect(localStorage.getItem(STORAGE_KEYS.CURRENCY)).toBe("EUR");
    expect(localStorage.getItem(STORAGE_KEYS.DATE_FORMAT)).toBe("DD/MM/YYYY");
    expect(localStorage.getItem(STORAGE_KEYS.FIRST_DAY_OF_WEEK)).toBe("1");
    expect(localStorage.getItem(STORAGE_KEYS.FIRST_RUN_COMPLETED)).toBe("true");
  });

  it("does nothing when first run was already completed", () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.FIRST_RUN_COMPLETED, "true");
    localStorage.setItem(STORAGE_KEYS.CURRENCY, "GBP");
    setLanguage("es-ES");

    applySystemPreferencesIfNeeded();

    expect(localStorage.getItem(STORAGE_KEYS.CURRENCY)).toBe("GBP");
    expect(localStorage.getItem(STORAGE_KEYS.UI_LANGUAGE)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.NUMBER_FORMAT)).toBeNull();
  });

  it("does not overwrite preferences that are already stored", () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.CURRENCY, "GBP");
    setLanguage("es-ES");

    applySystemPreferencesIfNeeded();

    expect(localStorage.getItem(STORAGE_KEYS.CURRENCY)).toBe("GBP");
    expect(localStorage.getItem(STORAGE_KEYS.UI_LANGUAGE)).toBe("es");
    expect(localStorage.getItem(STORAGE_KEYS.NUMBER_FORMAT)).toBe("de-DE");
    expect(localStorage.getItem(STORAGE_KEYS.FIRST_RUN_COMPLETED)).toBe("true");
  });
});
