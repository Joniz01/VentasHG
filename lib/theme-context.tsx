"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeCtx = { theme: string; setTheme: (t: string) => void };

const ThemeContext = createContext<ThemeCtx>({ theme: "", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("erp-theme") ?? "";
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const setTheme = (t: string) => {
    setThemeState(t);
    localStorage.setItem("erp-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
