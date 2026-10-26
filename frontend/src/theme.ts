// Design tokens. Dark theme only (see /app/design_guidelines.json).
import { useMemo } from "react";
import { StyleSheet } from "react-native";

const dark = {
  surface: "#0D1117",
  onSurface: "#F0F6FC",
  surfaceSecondary: "#161B22",
  onSurfaceSecondary: "#C9D1D9",
  surfaceTertiary: "#21262D",
  onSurfaceTertiary: "#8B949E",
  surfaceInverse: "#F0F6FC",
  onSurfaceInverse: "#0D1117",
  muted: "#8B949E",
  subtle: "#6E7681",

  brand: "#10B981",
  onBrand: "#04130D",
  brandPrimary: "#10B981",
  onBrandPrimary: "#04130D",
  brandSecondary: "#8B5CF6",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "rgba(16,185,129,0.14)",
  onBrandTertiary: "#34D399",

  routineBg: "rgba(59,130,246,0.14)",
  routine: "#60A5FA",
  eventBg: "rgba(139,92,246,0.14)",
  event: "#A78BFA",
  habitBg: "rgba(16,185,129,0.14)",
  habit: "#34D399",
  travelBg: "rgba(245,158,11,0.14)",
  travel: "#FBBF24",

  success: "#10B981",
  onSuccess: "#04130D",
  warning: "#F59E0B",
  onWarning: "#1A1206",
  error: "#F43F5E",
  onError: "#FFFFFF",
  info: "#3B82F6",
  onInfo: "#FFFFFF",

  border: "#30363D",
  borderStrong: "#484F58",
  divider: "#21262D",
};

export type ThemeColors = typeof dark;

export const fonts = {
  heading: "Outfit_700Bold",
  headingSemi: "Outfit_600SemiBold",
  body: "Manrope_400Regular",
  bodySemi: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
};

export function useTheme(): { scheme: "dark"; colors: ThemeColors } {
  return { scheme: "dark", colors: dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    return useMemo(() => StyleSheet.create(factory(dark)), []);
  };
}
