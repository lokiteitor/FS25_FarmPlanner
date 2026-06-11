// features/machinery-manage/lib/capacity — theoretical field-work capacity.
//
// FS25 theoretical area capacity (ha/h) = workingWidth(m) * workingSpeed(km/h)
// / 10. Derivation: a machine of width W (m) moving at speed S (km/h) sweeps
//   W [m] * S*1000 [m/h] = W*S*1000 [m²/h]
// and 1 ha = 10_000 m², so m²/h -> ha/h divides by 10_000:
//   (W*S*1000) / 10_000 = W*S / 10  [ha/h]
// This is the documented theoretical (100% efficiency) figure shown in the UI.

/** Theoretical capacity in ha/h from width (m) and speed (km/h). */
export function theoreticalCapacityHaPerH(
  workingWidthM: number,
  workingSpeedKmh: number,
): number {
  if (!Number.isFinite(workingWidthM) || !Number.isFinite(workingSpeedKmh)) return 0
  if (workingWidthM <= 0 || workingSpeedKmh <= 0) return 0
  return (workingWidthM * workingSpeedKmh) / 10
}

/** Capacity formatted to 2 decimals with the ha/h unit (Spanish UI). */
export function formatCapacity(workingWidthM: number, workingSpeedKmh: number): string {
  const cap = theoreticalCapacityHaPerH(workingWidthM, workingSpeedKmh)
  return `${cap.toFixed(2)} ha/h`
}
