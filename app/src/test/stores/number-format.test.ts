import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNumberFormatStore } from "../../stores/number-format";

describe("useNumberFormatStore", () => {
  beforeEach(() => {
    useNumberFormatStore.setState({
      locale: "en-US",
      currency: "USD",
      dateFormat: "YYYY-MM-DD",
      firstDayOfWeek: 1,
      uiLanguage: "en",
      translationVersion: 0,
    });
    vi.spyOn(Storage.prototype, "setItem");
  });

  it("has expected default state", () => {
    const s = useNumberFormatStore.getState();
    expect(s.locale).toBe("en-US");
    expect(s.currency).toBe("USD");
    expect(s.dateFormat).toBe("YYYY-MM-DD");
    expect(s.firstDayOfWeek).toBe(1);
    expect(s.uiLanguage).toBe("en");
    expect(s.translationVersion).toBe(0);
  });

  it("setLocale updates locale and persists", () => {
    useNumberFormatStore.getState().setLocale("de-DE");
    expect(useNumberFormatStore.getState().locale).toBe("de-DE");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "hb_number_format",
      "de-DE",
    );
  });

  it("setCurrency updates currency and persists", () => {
    useNumberFormatStore.getState().setCurrency("EUR");
    expect(useNumberFormatStore.getState().currency).toBe("EUR");
    expect(localStorage.setItem).toHaveBeenCalledWith("hb_currency", "EUR");
  });

  it("setDateFormat updates dateFormat and persists", () => {
    useNumberFormatStore.getState().setDateFormat("MM/DD/YYYY");
    expect(useNumberFormatStore.getState().dateFormat).toBe("MM/DD/YYYY");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "hb_date_format",
      "MM/DD/YYYY",
    );
  });

  it("setFirstDayOfWeek updates firstDayOfWeek and persists", () => {
    useNumberFormatStore.getState().setFirstDayOfWeek(0);
    expect(useNumberFormatStore.getState().firstDayOfWeek).toBe(0);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "hb_first_day_of_week",
      "0",
    );
  });

  it("setUiLanguage updates uiLanguage and persists", () => {
    useNumberFormatStore.getState().setUiLanguage("es");
    expect(useNumberFormatStore.getState().uiLanguage).toBe("es");
    expect(localStorage.setItem).toHaveBeenCalledWith("hb_ui_language", "es");
  });

  it("bumpTranslationVersion increments translationVersion", () => {
    useNumberFormatStore.getState().bumpTranslationVersion();
    expect(useNumberFormatStore.getState().translationVersion).toBe(1);
    useNumberFormatStore.getState().bumpTranslationVersion();
    expect(useNumberFormatStore.getState().translationVersion).toBe(2);
  });
});
