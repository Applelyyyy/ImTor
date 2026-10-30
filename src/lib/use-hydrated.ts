"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
/** SSR controls stay disabled until React has installed their event handlers. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
