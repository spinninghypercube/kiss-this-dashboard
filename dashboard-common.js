(function () {
  "use strict";

  const LINK_MODE_KEY = "homelabDashboardLinkMode";
  const ACTIVE_DASHBOARD_KEY = "homelabDashboardActiveDashboard";
  const BUTTON_COLOR_MODE_CYCLE_DEFAULT = "cycle-default";
  const BUTTON_COLOR_MODE_CYCLE_CUSTOM = "cycle-custom";
  const BUTTON_COLOR_MODE_SOLID_ALL = "solid-all";
  const BUTTON_COLOR_MODE_SOLID_PER_GROUP = "solid-per-group";
  const DEFAULT_BUTTON_COLOR_CYCLE_HUE_STEP = 15;
  const DEFAULT_BUTTON_COLOR_CYCLE_SATURATION = 70;
  const DEFAULT_BUTTON_COLOR_CYCLE_LIGHTNESS = 74;
  const DEFAULT_BUTTON_COLOR_SOLID = "#93c5fd";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function makeSafeTabId(rawValue) {
    const source = (rawValue || "tab").toString().trim().toLowerCase();
    const safe = source
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return safe || "tab";
  }

  function normalizeLinkMode(mode) {
    return mode === "internal" ? "internal" : "external";
  }

  function normalizeTitle(value) {
    if (typeof value !== "string") {
      return "KISS this dashboard";
    }

    const trimmed = value.trim();
    return trimmed || "KISS this dashboard";
  }

  function normalizeHexColor(value) {
    if (typeof value !== "string") {
      return "";
    }

    const trimmed = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : "";
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
  }

  function normalizeButtonColorMode(value) {
    const mode = (value || "").toString().trim().toLowerCase();
    if (mode === BUTTON_COLOR_MODE_CYCLE_DEFAULT) {
      return BUTTON_COLOR_MODE_CYCLE_CUSTOM;
    }
    if (mode === BUTTON_COLOR_MODE_CYCLE_CUSTOM) {
      return BUTTON_COLOR_MODE_CYCLE_CUSTOM;
    }
    if (mode === BUTTON_COLOR_MODE_SOLID_ALL) {
      return BUTTON_COLOR_MODE_SOLID_ALL;
    }
    if (mode === BUTTON_COLOR_MODE_SOLID_PER_GROUP) {
      return BUTTON_COLOR_MODE_SOLID_PER_GROUP;
    }
    return BUTTON_COLOR_MODE_CYCLE_CUSTOM;
  }

  function getDefaultButtonColorOptions() {
    return {
      buttonColorMode: BUTTON_COLOR_MODE_CYCLE_CUSTOM,
      buttonCycleHueStep: DEFAULT_BUTTON_COLOR_CYCLE_HUE_STEP,
      buttonCycleSaturation: DEFAULT_BUTTON_COLOR_CYCLE_SATURATION,
      buttonCycleLightness: DEFAULT_BUTTON_COLOR_CYCLE_LIGHTNESS,
      buttonSolidColor: DEFAULT_BUTTON_COLOR_SOLID
    };
  }

  function normalizeExternalLinkHref(value) {
    const text = (value || "").toString().trim();
    if (!text) {
      return "";
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
      return text;
    }

    if (text.startsWith("//")) {
      return `https:${text}`;
    }

    if (
      text.startsWith("/") ||
      text.startsWith("./") ||
      text.startsWith("../") ||
      text.startsWith("#")
    ) {
      return text;
    }

    if (
      /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9.-]+\.[a-z]{2,})(?::\d+)?(?:[/?#].*)?$/i.test(text)
    ) {
      return `https://${text}`;
    }

    return text;
  }

  function hexColorToRgb(value) {
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      return null;
    }
    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16)
    };
  }

  function rgbToHex(rgb) {
    if (!rgb) {
      return "";
    }
    const toHex = (channel) => {
      const safe = Math.max(0, Math.min(255, Math.round(Number(channel) || 0)));
      return safe.toString(16).padStart(2, "0");
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function blendHexColors(backgroundColor, overlayColor, alpha) {
    const bg = hexColorToRgb(backgroundColor);
    const fg = hexColorToRgb(overlayColor);
    if (!bg || !fg) {
      return normalizeHexColor(backgroundColor) || normalizeHexColor(overlayColor) || "";
    }
    const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    return rgbToHex({
      r: bg.r * (1 - safeAlpha) + fg.r * safeAlpha,
      g: bg.g * (1 - safeAlpha) + fg.g * safeAlpha,
      b: bg.b * (1 - safeAlpha) + fg.b * safeAlpha
    });
  }

  function srgbChannelToLinear(channel) {
    const value = channel / 255;
    if (value <= 0.04045) {
      return value / 12.92;
    }
    return Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function isHexColorDark(value) {
    const rgb = hexColorToRgb(value);
    if (!rgb) {
      return true;
    }
    const luminance =
      0.2126 * srgbChannelToLinear(rgb.r) +
      0.7152 * srgbChannelToLinear(rgb.g) +
      0.0722 * srgbChannelToLinear(rgb.b);
    return luminance < 0.52;
  }

  function createCycleButtonColor(index, hueStep, saturation, lightness) {
    const hue = (Math.round(index) * hueStep) % 360;
    const hoverLightness = lightness > 52 ? Math.max(40, lightness - 11) : Math.min(82, lightness + 9);
    return {
      base: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      hover: `hsl(${hue}, ${saturation}%, ${hoverLightness}%)`
    };
  }

  function createSolidButtonColor(baseColor) {
    const normalized = normalizeHexColor(baseColor) || DEFAULT_BUTTON_COLOR_SOLID;
    const hover = isHexColorDark(normalized)
      ? blendHexColors(normalized, "#ffffff", 0.14)
      : blendHexColors(normalized, "#000000", 0.12);
    return {
      base: normalized,
      hover: hover || normalized
    };
  }

  function getButtonColorPair(dashboard, group, buttonIndex) {
    const defaults = getDefaultButtonColorOptions();
    const mode = normalizeButtonColorMode(dashboard && dashboard.buttonColorMode);

    if (mode === BUTTON_COLOR_MODE_CYCLE_CUSTOM) {
      const hueStep = clampNumber(dashboard && dashboard.buttonCycleHueStep, 1, 180, defaults.buttonCycleHueStep);
      const saturation = clampNumber(
        dashboard && dashboard.buttonCycleSaturation,
        0,
        100,
        defaults.buttonCycleSaturation
      );
      const lightness = clampNumber(
        dashboard && dashboard.buttonCycleLightness,
        0,
        100,
        defaults.buttonCycleLightness
      );
      return createCycleButtonColor(buttonIndex, hueStep, saturation, lightness);
    }

    if (mode === BUTTON_COLOR_MODE_SOLID_ALL) {
      return createSolidButtonColor(dashboard && dashboard.buttonSolidColor);
    }

    if (mode === BUTTON_COLOR_MODE_SOLID_PER_GROUP) {
      const groupColor = normalizeHexColor(group && group.buttonSolidColor);
      const fallbackColor = normalizeHexColor(dashboard && dashboard.buttonSolidColor) || defaults.buttonSolidColor;
      return createSolidButtonColor(groupColor || fallbackColor);
    }

    return createCycleButtonColor(
      buttonIndex,
      defaults.buttonCycleHueStep,
      defaults.buttonCycleSaturation,
      defaults.buttonCycleLightness
    );
  }

  function normalizeMigrationTabs(inputTabs) {
    const sourceTabs = Array.isArray(inputTabs) ? inputTabs : [];
    const tabs = sourceTabs
      .map((tab) => {
        const id = makeSafeTabId(tab && (tab.id || tab.label));
        const label = (tab && typeof tab.label === "string" ? tab.label.trim() : "") || id;
        return { id, label };
      })
      .filter((tab) => tab.id.length > 0);

    if (!tabs.some((tab) => tab.id === "external")) {
      tabs.unshift({ id: "external", label: "External" });
    }

    if (!tabs.some((tab) => tab.id === "internal")) {
      tabs.push({ id: "internal", label: "Internal" });
    }

    return tabs;
  }

  function detectTypeFromText(text) {
    const source = (text || "").toString().toLowerCase();
    if (!source) {
      return "";
    }

    if (/extern|public|internet|wan/.test(source)) {
      return "external";
    }

    if (/intern|local|lan|private/.test(source)) {
      return "internal";
    }

    return "";
  }

  function looksLikePrivateHost(hostname) {
    const host = (hostname || "").toLowerCase();
    if (!host) {
      return false;
    }

    if (host === "localhost" || host.endsWith(".local")) {
      return true;
    }

    if (/^10\./.test(host) || /^192\.168\./.test(host)) {
      return true;
    }

    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
      return true;
    }

    return false;
  }

  function detectTypeFromUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return "";
    }

    try {
      const hostname = new URL(rawUrl.trim()).hostname;
      return looksLikePrivateHost(hostname) ? "internal" : "external";
    } catch (error) {
      return "";
    }
  }

  function getTabTypeById(tabs) {
    const map = new Map();
    tabs.forEach((tab) => {
      const explicit = tab.id === "external" || tab.id === "internal" ? tab.id : "";
      map.set(tab.id, explicit || detectTypeFromText(`${tab.id} ${tab.label}`));
    });
    return map;
  }

  function normalizeEntryLinks(entry, migrationTabs) {
    const links = {};
    const sourceLinks = entry && entry.links && typeof entry.links === "object" ? entry.links : {};
    const tabTypeById = getTabTypeById(migrationTabs);

    Object.keys(sourceLinks).forEach((key) => {
      links[key] = typeof sourceLinks[key] === "string" ? sourceLinks[key].trim() : "";
    });

    if (typeof entry.external === "string" && !links.external) {
      links.external = entry.external.trim();
    }

    if (typeof entry.internal === "string" && !links.internal) {
      links.internal = entry.internal.trim();
    }

    Object.keys(links).forEach((key) => {
      const value = links[key];
      if (!value) {
        return;
      }

      const detected =
        key === "external" || key === "internal"
          ? key
          : tabTypeById.get(key) || detectTypeFromText(key);

      if (detected && !links[detected]) {
        links[detected] = value;
      }
    });

    const unresolvedValues = Object.keys(links)
      .filter((key) => key !== "external" && key !== "internal")
      .map((key) => links[key])
      .filter(Boolean);

    unresolvedValues.forEach((value) => {
      const detected = detectTypeFromUrl(value);
      if (detected && !links[detected]) {
        links[detected] = value;
        return;
      }

      if (!links.external) {
        links.external = value;
        return;
      }

      if (!links.internal) {
        links.internal = value;
      }
    });

    if (!links.external) {
      links.external = "";
    }

    if (!links.internal) {
      links.internal = "";
    }

    return { external: links.external, internal: links.internal };
  }

  function normalizeButtonEntry(entry, migrationTabs) {
    return {
      id: entry && entry.id ? String(entry.id) : createId("button"),
      name: entry && typeof entry.name === "string" ? entry.name : "New Button",
      icon: entry && typeof entry.icon === "string" ? entry.icon : "",
      iconData: entry && typeof entry.iconData === "string" ? entry.iconData : "",
      links: normalizeEntryLinks(entry || {}, migrationTabs)
    };
  }

  function normalizeGroup(group, migrationTabs) {
    const entries = Array.isArray(group && group.entries)
      ? group.entries.map((entry) => normalizeButtonEntry(entry, migrationTabs))
      : [];

    return {
      id: group && group.id ? String(group.id) : createId("group"),
      title: group && typeof group.title === "string" ? group.title : "New Group",
      groupEnd: Boolean(group && group.groupEnd),
      buttonSolidColor: normalizeHexColor(group && group.buttonSolidColor),
      entries
    };
  }

  function normalizeThemePresetTheme(theme) {
    const defaults = getDefaultButtonColorOptions();
    return {
      backgroundColor: normalizeHexColor(theme && theme.backgroundColor),
      groupBackgroundColor: normalizeHexColor(theme && theme.groupBackgroundColor),
      textColor: normalizeHexColor(theme && theme.textColor),
      buttonTextColor: normalizeHexColor(theme && theme.buttonTextColor),
      tabColor: normalizeHexColor(theme && theme.tabColor),
      activeTabColor: normalizeHexColor(theme && theme.activeTabColor),
      tabTextColor: normalizeHexColor(theme && theme.tabTextColor),
      activeTabTextColor: normalizeHexColor(theme && theme.activeTabTextColor),
      buttonColorMode: normalizeButtonColorMode(theme && theme.buttonColorMode),
      buttonCycleHueStep: clampNumber(theme && theme.buttonCycleHueStep, 1, 180, defaults.buttonCycleHueStep),
      buttonCycleSaturation: clampNumber(theme && theme.buttonCycleSaturation, 0, 100, defaults.buttonCycleSaturation),
      buttonCycleLightness: clampNumber(theme && theme.buttonCycleLightness, 0, 100, defaults.buttonCycleLightness),
      buttonSolidColor: normalizeHexColor(theme && theme.buttonSolidColor) || defaults.buttonSolidColor
    };
  }

  function normalizeThemePreset(preset, fallbackIndex = 1) {
    const name =
      preset && typeof preset.name === "string" && preset.name.trim()
        ? preset.name.trim()
        : `Theme ${fallbackIndex}`;
    return {
      id: preset && preset.id ? String(preset.id) : createId("theme"),
      name,
      theme: normalizeThemePresetTheme(preset && preset.theme)
    };
  }

  function normalizeDashboard(dashboard, migrationTabs, fallbackLabel) {
    const groups = Array.isArray(dashboard && dashboard.groups)
      ? dashboard.groups.map((group) => normalizeGroup(group, migrationTabs))
      : [];
    const themePresets = Array.isArray(dashboard && dashboard.themePresets)
      ? dashboard.themePresets.map((preset, index) => normalizeThemePreset(preset, index + 1))
      : [];

    const id = dashboard && dashboard.id ? makeSafeTabId(dashboard.id) : createId("dashboard");
    const labelSource =
      dashboard && typeof dashboard.label === "string" && dashboard.label.trim()
        ? dashboard.label.trim()
        : fallbackLabel || "Dashboard";

    return {
      ...getDefaultButtonColorOptions(),
      id,
      label: labelSource,
      showLinkModeToggle:
        dashboard && Object.prototype.hasOwnProperty.call(dashboard, "showLinkModeToggle")
          ? Boolean(dashboard.showLinkModeToggle)
          : true,
      enableInternalLinks:
        dashboard && Object.prototype.hasOwnProperty.call(dashboard, "enableInternalLinks")
          ? Boolean(dashboard.enableInternalLinks)
          : false,
      textColor: normalizeHexColor(dashboard && dashboard.textColor),
      buttonTextColor: normalizeHexColor(dashboard && dashboard.buttonTextColor),
      tabColor: normalizeHexColor(dashboard && dashboard.tabColor),
      activeTabColor: normalizeHexColor(dashboard && dashboard.activeTabColor),
      tabTextColor: normalizeHexColor(dashboard && dashboard.tabTextColor),
      activeTabTextColor: normalizeHexColor(dashboard && dashboard.activeTabTextColor),
      backgroundColor: normalizeHexColor(dashboard && dashboard.backgroundColor),
      groupBackgroundColor: normalizeHexColor(dashboard && dashboard.groupBackgroundColor),
      buttonColorMode: normalizeButtonColorMode(dashboard && dashboard.buttonColorMode),
      buttonCycleHueStep: clampNumber(
        dashboard && dashboard.buttonCycleHueStep,
        1,
        180,
        DEFAULT_BUTTON_COLOR_CYCLE_HUE_STEP
      ),
      buttonCycleSaturation: clampNumber(
        dashboard && dashboard.buttonCycleSaturation,
        0,
        100,
        DEFAULT_BUTTON_COLOR_CYCLE_SATURATION
      ),
      buttonCycleLightness: clampNumber(
        dashboard && dashboard.buttonCycleLightness,
        0,
        100,
        DEFAULT_BUTTON_COLOR_CYCLE_LIGHTNESS
      ),
      buttonSolidColor: normalizeHexColor(dashboard && dashboard.buttonSolidColor) || DEFAULT_BUTTON_COLOR_SOLID,
      themePresets,
      groups
    };
  }

  function normalizeDashboards(config, migrationTabs) {
    if (Array.isArray(config.dashboards) && config.dashboards.length) {
      const usedIds = new Set();
      return config.dashboards
        .map((dashboard, index) => normalizeDashboard(dashboard, migrationTabs, `Dashboard ${index + 1}`))
        .map((dashboard) => {
          let id = dashboard.id || createId("dashboard");
          let counter = 2;
          while (usedIds.has(id)) {
            id = `${dashboard.id}-${counter}`;
            counter += 1;
          }
          usedIds.add(id);
          return {
            id,
            label: dashboard.label,
            showLinkModeToggle: dashboard.showLinkModeToggle,
            enableInternalLinks: dashboard.enableInternalLinks,
            textColor: dashboard.textColor,
            buttonTextColor: dashboard.buttonTextColor,
            tabColor: dashboard.tabColor,
            activeTabColor: dashboard.activeTabColor,
            tabTextColor: dashboard.tabTextColor,
            activeTabTextColor: dashboard.activeTabTextColor,
            backgroundColor: dashboard.backgroundColor,
            groupBackgroundColor: dashboard.groupBackgroundColor,
            buttonColorMode: dashboard.buttonColorMode,
            buttonCycleHueStep: dashboard.buttonCycleHueStep,
            buttonCycleSaturation: dashboard.buttonCycleSaturation,
            buttonCycleLightness: dashboard.buttonCycleLightness,
            buttonSolidColor: dashboard.buttonSolidColor,
            themePresets: dashboard.themePresets,
            groups: dashboard.groups
          };
        });
    }

    const legacyGroups = Array.isArray(config.groups) ? config.groups : [];
    return [
      normalizeDashboard(
        {
          id: "dashboard-1",
          label: "Dashboard 1",
          groups: legacyGroups
        },
        migrationTabs,
        "Dashboard 1"
      )
    ];
  }

  function normalizeConfig(inputConfig) {
    const config = inputConfig && typeof inputConfig === "object" ? inputConfig : {};
    const migrationTabs = normalizeMigrationTabs(config.tabs);
    const dashboards = normalizeDashboards(config, migrationTabs);

    return {
      title: normalizeTitle(config.title),
      dashboards
    };
  }

  async function requestJSON(path, options = {}) {
    const init = {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      },
      body: options.body
    };

    if (init.body && !init.headers["Content-Type"]) {
      init.headers["Content-Type"] = "application/json";
    }

    const response = await fetch(path, init);
    const rawText = await response.text();

    let payload = {};
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch (error) {
        payload = { message: rawText };
      }
    }

    if (!response.ok) {
      const message = payload && payload.message ? payload.message : `Request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  async function fetchDefaultConfig() {
    const response = await fetch("/dashboard-default-config.json", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to load default dashboard config.");
    }

    return normalizeConfig(await response.json());
  }

  async function getConfig() {
    try {
      const payload = await requestJSON("/api/config", { method: "GET" });
      return normalizeConfig(payload.config);
    } catch (error) {
      console.warn("API config unavailable, falling back to default config file.", error);
      return fetchDefaultConfig();
    }
  }

  async function saveConfig(config) {
    const normalized = normalizeConfig(config);
    const payload = await requestJSON("/api/config", {
      method: "POST",
      body: JSON.stringify({ config: normalized })
    });
    return normalizeConfig(payload.config);
  }

  async function login(username, password) {
    return requestJSON("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  }

  async function bootstrapAdmin(username, password) {
    return requestJSON("/api/auth/bootstrap", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  }

  async function logout() {
    return requestJSON("/api/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async function getAuthStatus() {
    return requestJSON("/api/auth/status", { method: "GET" });
  }

  async function changePassword(currentPassword, newPassword) {
    return requestJSON("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  async function changeUsername(currentPassword, newUsername) {
    return requestJSON("/api/auth/change-username", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newUsername })
    });
  }

  async function searchIcons(query, limit = 20, source = "selfhst") {
    const trimmed = (query || "").toString().trim();
    const clampedLimit = Math.max(1, Math.min(Number(limit) || 20, 30));
    const params = new URLSearchParams({
      q: trimmed,
      limit: String(clampedLimit),
      source: String(source || "selfhst")
    });
    return requestJSON(`/api/icons/search?${params.toString()}`, {
      method: "GET"
    });
  }

  async function importSelfhstIcon(reference, format = "svg") {
    return requestJSON("/api/icons/import-selfhst", {
      method: "POST",
      body: JSON.stringify({
        reference,
        format: format === "png" ? "png" : "svg"
      })
    });
  }

  async function importIconifyIcon(name, format = "svg", source = "") {
    return requestJSON("/api/icons/import-iconify", {
      method: "POST",
      body: JSON.stringify({
        name,
        source: (source || "").toString(),
        format: format === "png" ? "png" : "svg"
      })
    });
  }

  function getLinkMode() {
    return normalizeLinkMode(localStorage.getItem(LINK_MODE_KEY));
  }

  function setLinkMode(mode) {
    localStorage.setItem(LINK_MODE_KEY, normalizeLinkMode(mode));
  }

  function getActiveDashboardId() {
    return localStorage.getItem(ACTIVE_DASHBOARD_KEY) || "";
  }

  function setActiveDashboardId(dashboardId) {
    if (!dashboardId) {
      localStorage.removeItem(ACTIVE_DASHBOARD_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_DASHBOARD_KEY, dashboardId);
  }

  window.DashboardCommon = {
    clone,
    createId,
    makeSafeTabId,
    normalizeHexColor,
    normalizeButtonColorMode,
    normalizeExternalLinkHref,
    getDefaultButtonColorOptions,
    getButtonColorPair,
    normalizeConfig,
    getConfig,
    saveConfig,
    fetchDefaultConfig,
    login,
    bootstrapAdmin,
    logout,
    getAuthStatus,
    changePassword,
    changeUsername,
    searchIcons,
    importSelfhstIcon,
    importIconifyIcon,
    getLinkMode,
    setLinkMode,
    getActiveDashboardId,
    setActiveDashboardId
  };
})();
