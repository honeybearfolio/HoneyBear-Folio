import { rust } from "../api/tauri-client";
import type { ReportComputeInput, ReportData } from "../api/types";

export async function computeReportData(
  input: ReportComputeInput,
): Promise<ReportData> {
  return rust.compute_report_data({ input });
}
