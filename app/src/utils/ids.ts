export function sameId(
  a: string | number | undefined,
  b: string | number,
): boolean {
  return a !== undefined && String(a) === String(b);
}
