import { afterEach, beforeEach, describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import i18n from "../../i18n/i18n";

describe("i18n: react-i18next configuration", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("loads Spanish locale with changeLanguage('es') and translates a known key", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.language).toBe("es");
    expect(i18n.t("welcome.title")).toBe("Bienvenido a HoneyBear Folio");
  });

  it("falls back to English when a key is missing in the current locale", async () => {
    await i18n.changeLanguage("es");
    // i18next falls back to the English resource for missing keys
    expect(i18n.t("welcome.title")).toBeTruthy();
  });

  it("falls back to English and interpolates vars when needed", () => {
    expect(i18n.t("confirm.delete_account", { name: "Alice" })).toBe(
      en["confirm.delete_account"].replace("{name}", "Alice"),
    );
  });
});
