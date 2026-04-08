import useDocumentClass from "./useDocumentClass";

export default function useIsDark(): boolean {
  return useDocumentClass("dark");
}
