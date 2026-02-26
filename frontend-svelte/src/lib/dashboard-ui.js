import {
  normalizeHexColor,
  hexColorToRgb,
  isHexColorDark,
  blendHexColors,
  DEFAULT_THEME
} from './dashboard-common.js';

function pickHighContrastColor(value) {
  return isHexColorDark(value) ? '#f8fafc' : '#0f172a';
}

function hexColorToRgba(value, alpha) {
  const rgb = hexColorToRgb(value) || { r: 248, g: 250, b: 252 };
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + safeAlpha + ')';
}

function setCssVariable(root, key, value) {
  if (!root) return;
  if (value) {
    root.style.setProperty(key, value);
  } else {
    root.style.removeProperty(key);
  }
}

function applyNavActionTabContrastTheme(surfaceColor, root) {
  const targetRoot = root || document.documentElement;
  const navBg = pickHighContrastColor(surfaceColor);
  const navText = pickHighContrastColor(navBg);
  setCssVariable(targetRoot, '--dashboard-nav-tab-bg', navBg);
  setCssVariable(targetRoot, '--dashboard-nav-tab-text', navText);
  setCssVariable(targetRoot, '--dashboard-nav-tab-hover-bg', hexColorToRgba(navBg, 0.86));
  setCssVariable(targetRoot, '--dashboard-nav-tab-hover-text', navText);
}

function applyDashboardThemeCssVariables(themeLike, options) {
  const opts = options || {};
  const root = opts.root || document.documentElement;
  const pageColor = normalizeHexColor(themeLike && themeLike.backgroundColor);
  const groupColor = normalizeHexColor(themeLike && themeLike.groupBackgroundColor);
  const textColor = normalizeHexColor(themeLike && themeLike.textColor);
  const buttonTextColor = normalizeHexColor(themeLike && themeLike.buttonTextColor);
  const tabColor = normalizeHexColor(themeLike && themeLike.tabColor);
  const activeTabColor = normalizeHexColor(themeLike && themeLike.activeTabColor);
  const tabTextColor = normalizeHexColor(themeLike && themeLike.tabTextColor);
  const activeTabTextColor = normalizeHexColor(themeLike && themeLike.activeTabTextColor);
  const navSurfaceColor = pageColor || (opts.defaultPageColor || '#0f172a');
  const pageSurfaceColor = pageColor || (opts.defaultPageColor || '#0f172a');
  const groupSurfaceColor = groupColor || (opts.defaultGroupColor || '#111827');
  const flatGroupShell = pageSurfaceColor === groupSurfaceColor;
  const flatClassName = opts.flatClassName || '';

  if (flatClassName && root && root.classList) {
    root.classList.toggle(flatClassName, flatGroupShell);
  }

  applyNavActionTabContrastTheme(navSurfaceColor, root);

  setCssVariable(root, '--dashboard-page-bg', pageColor);
  setCssVariable(root, '--dashboard-group-bg', groupColor);
  setCssVariable(root, '--dashboard-text-color', textColor);
  setCssVariable(root, '--dashboard-button-text-color', buttonTextColor);

  if (groupColor && opts.setGroupRadius !== false) {
    setCssVariable(root, '--dashboard-group-radius', opts.groupRadius || '0.85rem');
  } else if (opts.setGroupRadius !== false) {
    setCssVariable(root, '--dashboard-group-radius', '');
  }

  if (tabColor) {
    setCssVariable(root, '--dashboard-tab-bg', tabColor);
    setCssVariable(root, '--dashboard-tab-hover-bg', tabColor);
  } else {
    setCssVariable(root, '--dashboard-tab-bg', '');
    setCssVariable(root, '--dashboard-tab-hover-bg', '');
  }

  setCssVariable(root, '--dashboard-tab-active-bg', activeTabColor);

  if (tabTextColor) {
    setCssVariable(root, '--dashboard-tab-text', tabTextColor);
    setCssVariable(root, '--dashboard-tab-hover-text', tabTextColor);
  } else {
    setCssVariable(root, '--dashboard-tab-text', '');
    setCssVariable(root, '--dashboard-tab-hover-text', '');
  }

  setCssVariable(root, '--dashboard-tab-active-text', activeTabTextColor);

  return {
    pageColor: pageSurfaceColor,
    groupColor: groupSurfaceColor,
    flatGroupShell,
    textColor: textColor || '',
    buttonTextColor: buttonTextColor || ''
  };
}

export function applyAdminThemePreview(themeLike, defaults) {
  const def = defaults || DEFAULT_THEME;
  const dashboardColor = normalizeHexColor(themeLike && themeLike.backgroundColor);
  const groupColor = normalizeHexColor(themeLike && themeLike.groupBackgroundColor);
  const pageTextColor = normalizeHexColor(themeLike && themeLike.textColor);
  const buttonTextColor = normalizeHexColor(themeLike && themeLike.buttonTextColor);
  const tabColor = normalizeHexColor(themeLike && themeLike.tabColor);
  const activeTabColor = normalizeHexColor(themeLike && themeLike.activeTabColor);
  const tabTextColor = normalizeHexColor(themeLike && themeLike.tabTextColor);
  const activeTabTextColor = normalizeHexColor(themeLike && themeLike.activeTabTextColor);

  const dashboardSurfaceColor = dashboardColor || def.backgroundColor;
  const groupSurfaceColor = groupColor || def.groupBackgroundColor;

  applyDashboardThemeCssVariables(
    { backgroundColor: dashboardColor, groupBackgroundColor: groupColor, textColor: pageTextColor,
      buttonTextColor, tabColor, activeTabColor, tabTextColor, activeTabTextColor },
    { flatClassName: 'admin-group-shell-flat', setGroupRadius: false,
      defaultPageColor: def.backgroundColor, defaultGroupColor: def.groupBackgroundColor }
  );

  const root = document.documentElement;
  const entryAccent = pickHighContrastColor(groupSurfaceColor);
  const groupAccent = pickHighContrastColor(dashboardSurfaceColor);
  root.style.setProperty('--admin-entry-add-accent', entryAccent);
  root.style.setProperty('--admin-entry-add-accent-soft', hexColorToRgba(entryAccent, 0.78));
  root.style.setProperty('--admin-entry-add-accent-hover-bg', hexColorToRgba(entryAccent, 0.1));
  root.style.setProperty('--admin-group-add-accent', groupAccent);
  root.style.setProperty('--admin-group-add-accent-soft', hexColorToRgba(groupAccent, 0.78));
  root.style.setProperty('--admin-group-add-accent-hover-bg', hexColorToRgba(groupAccent, 0.1));

  const surfaceText = pickHighContrastColor(groupSurfaceColor);
  const panelSurface = blendHexColors(dashboardSurfaceColor, '#0f172a', 0.72) || '#0f172a';
  const panelText = pickHighContrastColor(panelSurface);
  root.style.setProperty('--admin-surface-text-color', surfaceText);
  root.style.setProperty('--admin-surface-text-muted', hexColorToRgba(surfaceText, 0.88));
  root.style.setProperty('--admin-panel-text-color', panelText);
  root.style.setProperty('--admin-panel-text-muted', hexColorToRgba(panelText, 0.88));
}

export const DashboardUI = {
  normalizeHexColor,
  hexColorToRgb,
  pickHighContrastColor,
  hexColorToRgba,
  applyNavActionTabContrastTheme,
  applyDashboardThemeCssVariables
};

export default DashboardUI;
