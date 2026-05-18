/**
 * Official Amalgated Lending brand palette — single source for JS consumers (MUI, charts, inline styles).
 * Tailwind tokens live in `frontend/src/index.css` @theme (keep hex values aligned).
 */
export const fintechPalette = {
  crimson: {
    main: '#D92243',
    hover: '#B81C37',
    soft: '#E85A73',
    muted: 'rgba(217, 34, 67, 0.12)',
  },
  orange: {
    main: '#F69D39',
    hover: '#E88820',
    soft: '#FBC06D',
    muted: 'rgba(246, 157, 57, 0.18)',
  },
  gold: {
    main: '#E0C375',
    hover: '#C9A85D',
    muted: 'rgba(224, 195, 117, 0.28)',
  },
  cream: {
    main: '#FFF5E5',
    alt: '#FFF9EF',
  },
  semantic: {
    success: '#15803D',
    successSoft: '#22C55E',
    successLight: '#DCFCE7',
    error: '#B91C1C',
    errorLight: '#FECACA',
  },
  surface: {
    canvas: '#FFF5E5',
    paper: '#FFFFFF',
    alt: '#FFF9EF',
  },
  text: {
    primary: '#1C1917',
    secondary: '#57534E',
  },
}

/** MUI palette object — keep aligned with `fintechPalette`. */
export function muiPaletteFromFintech() {
  const p = fintechPalette
  return {
    mode: 'light',
    primary: { main: p.crimson.main, dark: p.crimson.hover, light: p.crimson.soft },
    secondary: { main: p.orange.main, dark: p.orange.hover, light: p.orange.soft },
    success: {
      main: p.semantic.success,
      dark: '#166534',
      light: p.semantic.successLight,
    },
    warning: { main: p.orange.main, dark: p.orange.hover, light: '#FFFBEB' },
    info: { main: p.gold.main, dark: p.gold.hover, light: '#FEF9E7' },
    error: { main: p.semantic.error, dark: '#991B1B', light: p.semantic.errorLight },
    background: { default: p.surface.canvas, paper: p.surface.paper },
    text: { primary: p.text.primary, secondary: p.text.secondary },
    divider: 'rgba(28, 25, 23, 0.08)',
  }
}
