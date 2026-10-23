import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  // jest-dom 7.0.1 still augments Vitest 4's `Assertion<T>`. Vitest 5 extends
  // `Matchers<R, T>`, so the published augmentation no longer applies.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
