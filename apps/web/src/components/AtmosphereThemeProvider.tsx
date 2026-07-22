"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  loadThemeSelection,
  saveThemeSelection,
  type ThemeSelection,
} from "../lib/themes";

type AtmosphereThemeContextValue = {
  /** "auto" follows the page (cases pick their theme); anything else forces. */
  selection: ThemeSelection;
  setSelection: (sel: ThemeSelection) => void;
};

const AtmosphereThemeContext =
  createContext<AtmosphereThemeContextValue | null>(null);

export function useAtmosphereTheme() {
  const ctx = useContext(AtmosphereThemeContext);
  if (!ctx) {
    throw new Error(
      "useAtmosphereTheme must be used within AtmosphereThemeProvider"
    );
  }
  return ctx;
}

/**
 * User's UI theme choice, persisted on this device. Server + first paint
 * use "auto" (no hydration flash); the stored pick lands on mount.
 */
export default function AtmosphereThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selection, setSelectionState] = useState<ThemeSelection>("auto");

  useEffect(() => {
    setSelectionState(loadThemeSelection());
  }, []);

  const setSelection = useCallback((sel: ThemeSelection) => {
    saveThemeSelection(sel);
    setSelectionState(sel);
  }, []);

  return (
    <AtmosphereThemeContext.Provider value={{ selection, setSelection }}>
      {children}
    </AtmosphereThemeContext.Provider>
  );
}
