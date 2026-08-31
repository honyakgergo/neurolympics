// Design tokens.
//
// Text contrast is deliberate: `text` for anything you read, `muted` for
// secondary copy that still has to be legible, `faint` only for small labels
// on dark fills. Nothing in the UI should use a colour dimmer than `faint`
// for text. `dim` and `raised` are fills, never text colours.
export const C = {
  bg:      "#080b12",
  surface: "#0e131e",
  raised:  "#161d2b",
  dim:     "#1b2233",
  border:  "#252d42",
  hover:   "#3a4763",

  text:    "#e8ecf5",
  muted:   "#a4aec4",
  faint:   "#7c86a0",

  accent:  "#5ecef7",
  green:   "#3ddc84",
  red:     "#ff6b6b",
  amber:   "#fbbf24",
  purple:  "#b39dfb",
  blue:    "#7cb0ff",
  pink:    "#fb8ba1",
};
