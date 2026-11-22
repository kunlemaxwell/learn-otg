"use client";
import { createStore } from "./local-store";

/** Small layout preferences, per browser. */
export type UiPrefs = {
  navCollapsed: boolean; // desktop sidebar folded to icons
  homeChat: boolean; // chat panel open beside the canvas on the Learn page
};

const store = createStore<UiPrefs>("learn-otg:ui:v1", { navCollapsed: false, homeChat: true }, (raw) => ({
  navCollapsed: false,
  homeChat: true,
  ...(raw as Partial<UiPrefs>),
}));

export const useUiPrefs = () => store.useValue();
export const setUiPrefs = (patch: Partial<UiPrefs>) => store.set({ ...store.get(), ...patch });
