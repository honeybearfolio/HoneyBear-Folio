import { rust } from "../api/tauri-client";

export async function runMonteCarloSimulation(
  params: Record<string, unknown>,
): Promise<unknown> {
  return rust.run_monte_carlo_simulation({ input: params });
}

export async function calculateDeterministicProjection(
  params: Record<string, unknown>,
): Promise<unknown> {
  return rust.calculate_deterministic_projection({ input: params });
}
