import { Platform } from "react-native";

export const COLORS = {
  background: "#F3F1EC",
  surface: "#FFFDF8",
  surfaceMuted: "#EFE9DE",
  border: "#DDD4C8",
  text: "#1C1915",
  textMuted: "#6B645B",
  accent: "#1F6A53",
  accentSoft: "#DCEFE8",
  warning: "#C46A2F",
  danger: "#B6493A",
  success: "#2F7D5B",
  shadow: "rgba(18, 15, 10, 0.08)",
};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const RADII = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
};

export const FONTS = {
  display: Platform.select({ ios: "Avenir Next", android: "serif" }),
  body: Platform.select({ ios: "Avenir Next", android: "serif" }),
};
