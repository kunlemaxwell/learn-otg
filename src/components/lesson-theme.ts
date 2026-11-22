// OpenUI theme overrides so built-in charts and controls follow the Learn OTG palette.
const PALETTE_LIGHT = ["#0B6E4F", "#F2B544", "#1A639A", "#B0285C", "#A44A24", "#6B5BD6"];
const PALETTE_DARK = ["#4FD1A1", "#F5C565", "#6CB8EE", "#F07AA6", "#EE9A72", "#A99BFF"];
const CHARTS = [
  "defaultChartPalette",
  "barChartPalette",
  "lineChartPalette",
  "areaChartPalette",
  "pieChartPalette",
  "radarChartPalette",
  "radialChartPalette",
  "horizontalBarChartPalette",
];
// Built-in themes set a palette per chart type, so brand every one of them.
export const lightTheme = {
  interactiveAccentDefault: "#0B6E4F",
  interactiveAccentHover: "#095C42",
  interactiveAccentPressed: "#074A35",
  textBrand: "#0B6E4F",
  textAccentPrimary: "#FFFFFF",
  ...Object.fromEntries(CHARTS.map((k) => [k, PALETTE_LIGHT])),
  borderAccent: "#0B6E4F",
  fontBody: "var(--font-sans)",
  fontHeading: "var(--font-sans)",
  fontLabel: "var(--font-sans)",
};
export const darkTheme = {
  interactiveAccentDefault: "#4FD1A1",
  interactiveAccentHover: "#6BE0B5",
  interactiveAccentPressed: "#3BBF8F",
  textBrand: "#4FD1A1",
  textAccentPrimary: "#062018",
  ...Object.fromEntries(CHARTS.map((k) => [k, PALETTE_DARK])),
  borderAccent: "#4FD1A1",
  fontBody: "var(--font-sans)",
  fontHeading: "var(--font-sans)",
  fontLabel: "var(--font-sans)",
};

