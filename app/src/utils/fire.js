import { rust } from "../api/tauri-client";

export async function runMonteCarloSimulation(params) {
  return rust.run_monte_carlo_simulation({ input: params });
}

export async function calculateDeterministicProjection(params) {
  return rust.calculate_deterministic_projection({ input: params });
}
