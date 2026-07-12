import { useState, useCallback } from "react";
import { autoMapImportColumns } from "../utils/accounts-io";
import type { FieldMapping } from "../components/shared/import-types";

export const EMPTY_FIELD_MAPPING: FieldMapping = {
  date: "",
  payee: "",
  amount: "",
  category: "",
  notes: "",
  account: "",
  ticker: "",
  shares: "",
  price: "",
  fee: "",
  currency: "",
};

export function useColumnMapping() {
  const [mapping, setMapping] = useState<FieldMapping>(EMPTY_FIELD_MAPPING);

  const applyAutoMap = useCallback((cols: string[]) => {
    setMapping((prevMapping) => ({
      ...prevMapping,
      ...autoMapImportColumns(cols),
    }));
  }, []);

  const resetMapping = useCallback(() => {
    setMapping(EMPTY_FIELD_MAPPING);
  }, []);

  return { mapping, setMapping, applyAutoMap, resetMapping };
}
