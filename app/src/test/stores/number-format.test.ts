import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNumberFormatStore } from "../../stores/number-format";
import { STORAGE_KEYS } from "../../constants/app";

describe("useNumberFormatStore", () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useNumberFormatStore.setState({
      locale: "en-US",
      currency: "USD",
      dateFormat: "YYYY-MM-DD",
      firstDayOfWeek: 1,
      uiLanguage: "en",
    });
    setItemSpy = vi.spyOn(Storage.prototype, "setItem");
  });

  it("has expected default state", () => {
    const s = useNumberFormatStore.getState();
    expect(s.locale).toBe("en-US");
    expect(s.currency).toBe("USD");
    expect(s.dateFormat).toBe("YYYY-MM-DD");
    expect(s.firstDayOfWeek).toBe(1);
    expect(s.uiLanguage).toBe("en");
  });

  it("setLocale updates locale and persists", () => {
    useNumberFormatStore.getState().setLocale("de-DE");
    expect(useNumberFormatStore.getState().locale).toBe("de-DE");
    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEYS.NUMBER_FORMAT,
      "de-DE",
    );
  });

  it("setCurrency updates currency and persists", () => {
    useNumberFormatStore.getState().setCurrency("EUR");
    expect(useNumberFormatStore.getState().currency).toBe("EUR");
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEYS.CURRENCY, "EUR");
  });

  it("setDateFormat updates dateFormat and persists", () => {
    useNumberFormatStore.getState().setDateFormat("MM/DD/YYYY");
    expect(useNumberFormatStore.getState().dateFormat).toBe("MM/DD/YYYY");
    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEYS.DATE_FORMAT,
      "MM/DD/YYYY",
    );
  });

  it("setFirstDayOfWeek updates firstDayOfWeek and persists", () => {
    useNumberFormatStore.getState().setFirstDayOfWeek(0);
    expect(useNumberFormatStore.getState().firstDayOfWeek).toBe(0);
    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEYS.FIRST_DAY_OF_WEEK,
      "0",
    );
  });

  it("setUiLanguage updates uiLanguage and persists", () => {
    useNumberFormatStore.getState().setUiLanguage("es");
    expect(useNumberFormatStore.getState().uiLanguage).toBe("es");
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEYS.UI_LANGUAGE, "es");
  });
});
