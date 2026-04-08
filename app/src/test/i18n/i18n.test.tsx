import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t, setLanguage, getCurrentLanguage, setLocale } from "../../i18n/i18n";
import en from "../../i18n/en.json";

describe("i18n: dynamic locale loading", () => {
  beforeEach(async () => {
    // ensure tests start in English
    await setLanguage("en");
  });

  afterEach(async () => {
    // restore to English to avoid leaking state
    await setLanguage("en");
  });

  it("loads Spanish locale with setLanguage('es') and translates a known key", async () => {
    await setLanguage("es");
    expect(getCurrentLanguage()).toBe("es");
    expect(t("welcome.title")).toBe("Bienvenido a HoneyBear Folio");
  });

  it("falls back to English when a key is missing in the current locale", async () => {
    await setLanguage("es");
    // simulate an incomplete locale object
    setLocale({});
    expect(t("welcome.title")).toBe(en["welcome.title"]);
  });

  it("treats a value identical to the key as untranslated and falls back to English", async () => {
    await setLanguage("es");
    setLocale({ "welcome.title": "welcome.title" });
    expect(t("welcome.title")).toBe(en["welcome.title"]);
  });

  it("falls back to English and interpolates vars when needed", async () => {
    await setLanguage("es");
    setLocale({});
    expect(t("confirm.delete_account", { name: "Alice" })).toBe(
      en["confirm.delete_account"].replace("{name}", "Alice"),
    );
  });
});
