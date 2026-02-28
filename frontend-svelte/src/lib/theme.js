// All theme-related constants, functions consolidated here

export const THEME_DEFAULTS = {
  backgroundColor: '#0f172a',
  groupBackgroundColor: '#111827',
  textColor: '#f8fafc',
  buttonTextColor: '#0f172a',
  tabColor: '#1e293b',
  activeTabColor: '#2563eb',
  tabTextColor: '#cbd5e1',
  activeTabTextColor: '#ffffff',
  groupBorderColor: '#1e293b',
  tabHoverColor: '#253348',
  buttonColorMode: 'cycle-custom',
  buttonCycleHueStep: 15,
  buttonCycleSaturation: 70,
  buttonCycleLightness: 74,
  buttonSolidColor: '#93c5fd',
};

// Logical groupings for the theme editor UI
export const COLOR_GROUPS = [
  {
    label: 'Page',
    fields: [
      { key: 'backgroundColor', label: 'Background' },
      { key: 'textColor', label: 'Text' },
    ]
  },
  {
    label: 'Tabs',
    fields: [
      { key: 'tabColor', label: 'Tab background' },
      { key: 'tabTextColor', label: 'Tab text' },
      { key: 'tabHoverColor', label: 'Tab hover' },
      { key: 'activeTabColor', label: 'Active tab background' },
      { key: 'activeTabTextColor', label: 'Active tab text' },
    ]
  },
  {
    label: 'Groups',
    fields: [
      { key: 'groupBackgroundColor', label: 'Group background' },
      { key: 'groupBorderColor', label: 'Group border' },
    ]
  },
  {
    label: 'Buttons',
    fields: [
      { key: 'buttonTextColor', label: 'Button text' },
      { key: 'buttonSolidColor', label: 'Button color (solid mode)' },
    ]
  },
];

export function normalizeTheme(theme) {
  const out = { ...THEME_DEFAULTS };
  if (!theme) return out;
  for (const key of Object.keys(THEME_DEFAULTS)) {
    if (theme[key] !== undefined && theme[key] !== null && theme[key] !== '') {
      out[key] = theme[key];
    }
  }
  // carry over button algorithm settings
  if (theme.buttonColorMode) out.buttonColorMode = theme.buttonColorMode;
  if (theme.buttonCycleHueStep != null) out.buttonCycleHueStep = Number(theme.buttonCycleHueStep);
  if (theme.buttonCycleSaturation != null) out.buttonCycleSaturation = Number(theme.buttonCycleSaturation);
  if (theme.buttonCycleLightness != null) out.buttonCycleLightness = Number(theme.buttonCycleLightness);
  return out;
}

export function applyThemeCssVars(theme) {
  const t = normalizeTheme(theme);
  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, v);

  // Dashboard vars
  set('--startpage-page-bg', t.backgroundColor);
  set('--startpage-group-bg', t.groupBackgroundColor);
  set('--startpage-group-border', t.groupBorderColor);
  set('--startpage-text-color', t.textColor);
  set('--startpage-button-text-color', t.buttonTextColor);
  set('--startpage-tab-bg', t.tabColor);
  set('--startpage-tab-hover-bg', t.tabHoverColor);
  set('--startpage-tab-text', t.tabTextColor);
  set('--startpage-tab-active-bg', t.activeTabColor);
  set('--startpage-tab-active-text', t.activeTabTextColor);

  // When page bg and group bg are identical, remove group box padding so content
  // aligns flush with the tab bar instead of being indented.
  const sameColor = t.backgroundColor.toLowerCase() === t.groupBackgroundColor.toLowerCase();
  set('--startpage-group-padding', sameColor ? '12px 0' : '24px');
  set('--startpage-group-inner-padding', sameColor ? '0' : '0.4rem');
  set('--startpage-group-title-inset', sameColor ? '0' : '0.75rem');

  // Derive edit mode vars from dashboard colors
  const editVars = deriveEditModeColors(t);
  for (const [k, v] of Object.entries(editVars)) {
    set(k, v);
  }
}

export function deriveEditModeColors(t) {
  // All edit/admin mode CSS vars are derived from the user's dashboard colors
  // No separate admin color config needed
  return {
    '--admin-bg': shadeColor(t.backgroundColor, -8),
    '--admin-panel-bg': shadeColor(t.groupBackgroundColor, -5),
    '--admin-input-bg': shadeColor(t.backgroundColor, 5),
    '--admin-input-border': alphaHex(t.textColor, 0.2),
    '--admin-text': t.textColor,
    '--admin-label-text': alphaHex(t.textColor, 0.75),
    '--admin-accent': t.activeTabColor,
    '--admin-accent-text': t.activeTabTextColor,
    '--admin-tab-bg': t.tabColor,
    '--admin-tab-text': t.tabTextColor,
    '--admin-tab-active-bg': t.activeTabColor,
    '--admin-tab-active-text': t.activeTabTextColor,
    '--admin-group-bg': t.groupBackgroundColor,
    '--admin-group-border': t.groupBorderColor,
    '--admin-button-text': t.buttonTextColor,
    '--admin-nav-bg': shadeColor(t.tabColor, -10),
    '--admin-nav-text': t.tabTextColor,
    '--admin-danger': '#ef4444',
    '--admin-success': '#22c55e',
  };
}

// Helpers
function shadeColor(hex, percent) {
  // Lighten (positive) or darken (negative) a hex color by percent
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, r + Math.round(2.55 * percent)));
  g = Math.max(0, Math.min(255, g + Math.round(2.55 * percent)));
  b = Math.max(0, Math.min(255, b + Math.round(2.55 * percent)));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function alphaHex(hex, alpha) {
  // Return hex with alpha as rgba()
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
