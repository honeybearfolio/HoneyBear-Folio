export const getMimeType = (fileName: string): string => {
  const ext = fileName.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    csv: "text/csv",
    json: "application/json",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
  };
  return mimeTypes[ext ?? ""] || "application/octet-stream";
};

export interface ImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export interface FieldMapping {
  date: string;
  payee: string;
  amount: string;
  category: string;
  notes: string;
  account: string;
  ticker: string;
  shares: string;
  price: string;
  fee: string;
  currency: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  success: number;
  failed: number;
}

export interface ImportError {
  row: number;
  error: string;
}

export interface Account {
  id: number;
  name: string;
  balance: number;
  kind: string;
}
