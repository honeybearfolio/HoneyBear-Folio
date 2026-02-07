import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t, setLanguage, getCurrentLanguage } from "../../i18n/i18n";

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
});
