import useDocumentClass from "./useDocumentClass";

export default function useIsHighContrast(): boolean {
  return useDocumentClass("high-contrast");
}
