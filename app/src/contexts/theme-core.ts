import { createContext, useContext } from "react";

export interface ThemeContextValue {
  theme: string;
  setTheme: (newTheme: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { ThemeContext, useTheme };
