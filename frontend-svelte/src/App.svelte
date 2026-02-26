<script>
  import { flip } from 'svelte/animate';
  import { afterUpdate, onDestroy, onMount, tick } from 'svelte';
  import Sortable from 'sortablejs';
  import './styles/dashboard.css';
  import './styles/edit.css';
  import { DashboardCommon, DEFAULT_THEME, normalizeHexColorLoose, clampInteger, iconSource } from './lib/dashboard-common.js';
  import { DashboardUI, applyAdminThemePreview } from './lib/dashboard-ui.js';
  import LoginView from './components/LoginView.svelte';
  import AccountPane from './components/AccountPane.svelte';
  import ButtonModal from './components/ButtonModal.svelte';

  // ─── Constants ────────────────────────────────────────────────────────────────

  const DEFAULT_BUTTON_COLOR_OPTIONS = DashboardCommon.getDefaultButtonColorOptions();
  const DND_FLIP_DURATION_MS = 160;
  const BUILT_IN_THEME_PRESETS = [
    {
      id: 'builtin-default-theme',
      name: 'Default Theme',
      theme: {
        backgroundColor: '#101728', groupBackgroundColor: '#172644', textColor: '#f8fafc',
        buttonTextColor: '#0f172a', tabColor: '#1e293b', activeTabColor: '#2563eb',
        tabTextColor: '#cbd5e1', activeTabTextColor: '#ffffff',
        buttonColorMode: 'cycle-custom', buttonCycleHueStep: 15,
        buttonCycleSaturation: 70, buttonCycleLightness: 74, buttonSolidColor: '#93c5fd'
      }
    },
    {
      id: 'builtin-paper-ink',
      name: 'Paper & Ink',
      theme: {
        backgroundColor: '#f8fafc', groupBackgroundColor: '#e2e8f0', textColor: '#0f172a',
        buttonTextColor: '#ffffff', tabColor: '#cbd5e1', activeTabColor: '#0f172a',
        tabTextColor: '#0f172a', activeTabTextColor: '#f8fafc',
        buttonColorMode: 'solid-all', buttonCycleHueStep: 15,
        buttonCycleSaturation: 70, buttonCycleLightness: 74, buttonSolidColor: '#0f172a'
      }
    },
    {
      id: 'builtin-forest-terminal',
      name: 'Forest Terminal',
      theme: {
        backgroundColor: '#071a12', groupBackgroundColor: '#0d261d', textColor: '#d1fae5',
        buttonTextColor: '#062f23', tabColor: '#14532d', activeTabColor: '#10b981',
        tabTextColor: '#d1fae5', activeTabTextColor: '#052e22',
        buttonColorMode: 'cycle-custom', buttonCycleHueStep: 11,
        buttonCycleSaturation: 66, buttonCycleLightness: 64, buttonSolidColor: '#34d399'
      }
    },
    {
      id: 'builtin-sunset-control',
      name: 'Sunset Control',
      theme: {
        backgroundColor: '#1f1027', groupBackgroundColor: '#2c1637', textColor: '#fae8ff',
        buttonTextColor: '#240f2d', tabColor: '#4a1d5d', activeTabColor: '#f97316',
        tabTextColor: '#f5d0fe', activeTabTextColor: '#1f0a04',
        buttonColorMode: 'cycle-custom', buttonCycleHueStep: 18,
        buttonCycleSaturation: 85, buttonCycleLightness: 68, buttonSolidColor: '#fb923c'
      }
    },
    {
      id: 'builtin-calm-blueprint',
      name: 'Calm Blueprint',
      theme: {
        backgroundColor: '#0b1324', groupBackgroundColor: '#12203a', textColor: '#dbeafe',
        buttonTextColor: '#082f49', tabColor: '#1d4ed8', activeTabColor: '#38bdf8',
        tabTextColor: '#dbeafe', activeTabTextColor: '#082f49',
        buttonColorMode: 'solid-all', buttonCycleHueStep: 15,
        buttonCycleSaturation: 70, buttonCycleLightness: 74, buttonSolidColor: '#7dd3fc'
      }
    }
  ];
  const COLOR_FIELDS = [
    { key: 'backgroundColor',      label: 'Tab Background Color', placeholder: '#0f172a', help: 'Background color for this dashboard page.',                        columnClass: 'is-6' },
    { key: 'groupBackgroundColor', label: 'Group Box Color',       placeholder: '#111827', help: 'Background color for the button groups on this dashboard.',        columnClass: 'is-6' },
    { key: 'textColor',            label: 'Page Text Color',       placeholder: '#f8fafc', help: 'Main text color for this tab on dashboard and admin.',              columnClass: 'is-6' },
    { key: 'buttonTextColor',      label: 'Button Text Color',     placeholder: '#0f172a', help: 'Text color used on dashboard buttons and admin button previews.',   columnClass: 'is-6' },
    { key: 'tabColor',             label: 'Tab Color',             placeholder: '#1e293b', help: 'Inactive tab background color.',                                    columnClass: 'is-6' },
    { key: 'activeTabColor',       label: 'Active Tab Color',      placeholder: '#2563eb', help: 'Active tab background color.',                                      columnClass: 'is-6' },
    { key: 'tabTextColor',         label: 'Tab Text Color',        placeholder: '#cbd5e1', help: 'Inactive tab text color.',                                          columnClass: 'is-6' },
    { key: 'activeTabTextColor',   label: 'Active Tab Text Color', placeholder: '#ffffff', help: 'Active tab text color.',                                            columnClass: 'is-6' }
  ];

  // ─── Shared state ─────────────────────────────────────────────────────────────

  let editMode = false;
  let config = { title: 'KISS this dashboard', dashboards: [], themePresets: [] };
  let activeDashboardId = DashboardCommon.getActiveDashboardId();
  let activeDashboard = null;
  let loading = true;
  let loadError = '';

  // ─── View-mode state ──────────────────────────────────────────────────────────

  let currentLinkMode = DashboardCommon.getLinkMode();
  let viewGroups = [];
  let tabsScrollEl;
  let tabsListEl;
  let tabsActionsEl;
  let tabsRowEl;
  let editActionsWidth = 0;
  let tabsOverflowing = false;
  let isMobileViewport = false;
  let resizeObserver;

  // ─── Edit-mode auth state ─────────────────────────────────────────────────────

  let authenticated = false;
  let authUser = '';
  let authMustChangePassword = false;
  let authSetupRequired = false;

  // ─── Edit-mode UI state ───────────────────────────────────────────────────────

  let accountPaneOpen = false;
  let showThemeEditor = false;
  let messageText = '';
  let messageTone = 'is-success';
  let messageVisible = false;
  let messageTimer = null;

  // ─── Edit-mode draft state ────────────────────────────────────────────────────

  let pageTitleDraft = '';
  let enableInternalLinksDraft = false;
  let showLinkToggleDraft = true;
  let themeDraft = buildDefaultThemeValues();
  let themePresetSelectValue = '';
  let themePresetName = '';

  // ─── Edit-mode modal state ────────────────────────────────────────────────────

  let actionModal = {
    open: false, mode: '', dashboardId: '', groupId: '', buttonId: '',
    title: 'Add Group', text: 'Create a new group.', titleLabel: 'Group Title',
    titlePlaceholder: 'New Group', titleValue: '', titleFieldVisible: true,
    confirmLabel: 'Add Group', confirmTone: 'is-link'
  };
  let buttonModalOpen = false;
  let buttonModalIsNew = false;
  let buttonModalGroupId = '';
  let buttonModalButtonId = '';
  let buttonModalInitialData = { name: '', icon: '', externalUrl: '', internalUrl: '', iconData: '' };

  // ─── Edit-mode DnD state ──────────────────────────────────────────────────────

  let dndPersistTimer = null;
  let tabsSortable = null;
  let groupsSortable = null;
  let buttonSortables = [];
  let sortableRefreshQueued = false;

  // ─── Edit-mode computed state ─────────────────────────────────────────────────

  let builtInThemePresets = [];
  let savedThemePresets = [];
  let themePresetSelected = null;
  let canDeleteThemePreset = false;
  let editorGroups = [];
  let themeButtonMode = DashboardCommon.normalizeButtonColorMode(themeDraft.buttonColorMode);

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function clone(value) { return DashboardCommon.clone(value); }

  function normalizeLinkMode(mode) { return mode === 'internal' ? 'internal' : 'external'; }

  function clearMessageTimer() {
    if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; }
  }
  function hideMessage() {
    clearMessageTimer();
    messageVisible = false; messageText = ''; messageTone = 'is-success';
  }
  function showMessage(text, tone = 'is-success') {
    clearMessageTimer();
    messageText = text || ''; messageTone = tone || 'is-success';
    messageVisible = Boolean(messageText);
    if (messageVisible) messageTimer = setTimeout(() => hideMessage(), 2000);
  }

  function clearTransientDndUiState() {
    // No svelte-dnd-action items to clear — Sortable.js handles DnD via DOM
  }

  function touchConfig() {
    config = clone(config);
  }

  // ─── Dashboard lookup ─────────────────────────────────────────────────────────

  function getDashboardIndex(dashboardId) {
    return (config.dashboards || []).findIndex((d) => d.id === dashboardId);
  }

  function ensureActiveDashboard() {
    if (!Array.isArray(config.dashboards) || !config.dashboards.length) {
      config.dashboards = [{
        id: DashboardCommon.createId('dashboard'), label: 'Dashboard 1',
        ...buildDefaultThemeValues(), enableInternalLinks: false,
        showLinkModeToggle: true, themePresets: [], groups: []
      }];
    }
    if (!activeDashboardId || getDashboardIndex(activeDashboardId) < 0) {
      activeDashboardId = config.dashboards[0].id;
    }
    DashboardCommon.setActiveDashboardId(activeDashboardId);
  }

  function getActiveDashboard() {
    ensureActiveDashboard();
    return config.dashboards[getDashboardIndex(activeDashboardId)] || null;
  }

  function getValidDashboardId(requestedId) {
    const dashboards = Array.isArray(config?.dashboards) ? config.dashboards : [];
    if (!dashboards.length) return '';
    if (requestedId && dashboards.some((d) => d.id === requestedId)) return requestedId;
    const saved = DashboardCommon.getActiveDashboardId();
    if (saved && dashboards.some((d) => d.id === saved)) return saved;
    return dashboards[0].id;
  }

  function setActiveDashboard(dashboardId) {
    hideMessage();
    activeDashboardId = getValidDashboardId(dashboardId);
    ensureActiveDashboard();
    DashboardCommon.setActiveDashboardId(activeDashboardId);
    accountPaneOpen = false;
    if (editMode) {
      syncDraftsFromActiveDashboard();
      applyCurrentAdminThemePreview();
    } else {
      applyDashboardTheme();
    }
  }

  // ─── Theme helpers ────────────────────────────────────────────────────────────

  function normalizeThemePresetTheme(theme) {
    const defaults = DEFAULT_BUTTON_COLOR_OPTIONS;
    return {
      backgroundColor:      DashboardUI.normalizeHexColor(theme?.backgroundColor)      || DEFAULT_THEME.backgroundColor,
      groupBackgroundColor: DashboardUI.normalizeHexColor(theme?.groupBackgroundColor) || DEFAULT_THEME.groupBackgroundColor,
      textColor:            DashboardUI.normalizeHexColor(theme?.textColor)            || DEFAULT_THEME.textColor,
      buttonTextColor:      DashboardUI.normalizeHexColor(theme?.buttonTextColor)      || DEFAULT_THEME.buttonTextColor,
      tabColor:             DashboardUI.normalizeHexColor(theme?.tabColor)             || DEFAULT_THEME.tabColor,
      activeTabColor:       DashboardUI.normalizeHexColor(theme?.activeTabColor)       || DEFAULT_THEME.activeTabColor,
      tabTextColor:         DashboardUI.normalizeHexColor(theme?.tabTextColor)         || DEFAULT_THEME.tabTextColor,
      activeTabTextColor:   DashboardUI.normalizeHexColor(theme?.activeTabTextColor)   || DEFAULT_THEME.activeTabTextColor,
      buttonColorMode:      DashboardCommon.normalizeButtonColorMode(theme?.buttonColorMode),
      buttonCycleHueStep:   clampInteger(theme?.buttonCycleHueStep, 1, 180, defaults.buttonCycleHueStep),
      buttonCycleSaturation: clampInteger(theme?.buttonCycleSaturation, 0, 100, defaults.buttonCycleSaturation),
      buttonCycleLightness: clampInteger(theme?.buttonCycleLightness, 0, 100, defaults.buttonCycleLightness),
      buttonSolidColor:     DashboardUI.normalizeHexColor(theme?.buttonSolidColor) || defaults.buttonSolidColor
    };
  }

  function getResolvedBuiltInThemePresets() {
    return BUILT_IN_THEME_PRESETS.map((preset) => ({ ...preset, theme: normalizeThemePresetTheme(preset.theme) }));
  }

  function buildDefaultThemeValues() {
    const builtInDefault = getResolvedBuiltInThemePresets().find((p) => p.id === 'builtin-default-theme');
    return builtInDefault ? { ...builtInDefault.theme } : normalizeThemePresetTheme({});
  }

  function applyDashboardTheme() {
    DashboardUI.applyDashboardThemeCssVariables(getActiveDashboard(), {
      flatClassName: 'dashboard-group-shell-flat',
      groupRadius: '0.85rem', setGroupRadius: true,
      defaultPageColor: '#0f172a', defaultGroupColor: '#111827'
    });
  }

  function applyCurrentAdminThemePreview() {
    applyAdminThemePreview({ ...themeDraft }, DEFAULT_THEME);
  }

  function applyPageTitle() {
    document.title = (config?.title || '').toString().trim() || 'KISS this dashboard';
  }

  // ─── View-mode helpers ────────────────────────────────────────────────────────

  function setLinkMode(mode) {
    currentLinkMode = normalizeLinkMode(mode);
    DashboardCommon.setLinkMode(currentLinkMode);
  }

  function buttonResolvedHref(entry, dashboard) {
    const effectiveMode = dashboard?.enableInternalLinks && currentLinkMode === 'internal' ? 'internal' : 'external';
    const raw = entry?.links && typeof entry.links[effectiveMode] === 'string' ? entry.links[effectiveMode].trim() : '';
    return effectiveMode === 'external' ? DashboardCommon.normalizeExternalLinkHref(raw) : raw;
  }

  function buttonDecorations(dashboard) {
    const groups = Array.isArray(dashboard?.groups) ? dashboard.groups : [];
    const result = [];
    let colorIndex = 0;
    for (const group of groups) {
      const entries = [];
      for (const entry of Array.isArray(group?.entries) ? group.entries : []) {
        const color = DashboardCommon.getButtonColorPair(dashboard, group, colorIndex);
        colorIndex += 1;
        entries.push({ entry, color, href: buttonResolvedHref(entry, dashboard), iconSrc: iconSource(entry) });
      }
      result.push({ group, entries });
    }
    return result;
  }

  function updateTabsOverflowState() {
    if (!tabsScrollEl || !tabsListEl || (config?.dashboards || []).length <= 1) {
      tabsOverflowing = false; return;
    }
    // Compare tabs width against the full row width (not the reduced scroll container).
    // Button moves below only when tabs genuinely exceed the entire available row width.
    // This means tabs can scroll within their allocated space without triggering overflow.
    const rowWidth = tabsRowEl ? tabsRowEl.clientWidth : tabsScrollEl.clientWidth;
    tabsOverflowing = tabsListEl.scrollWidth > rowWidth;
  }
  async function refreshTabsOverflowState() { await tick(); updateTabsOverflowState(); }
  function updateViewportState() { isMobileViewport = window.innerWidth <= 768; }

  // ─── Config loading ───────────────────────────────────────────────────────────

  async function loadConfig() {
    loading = true;
    loadError = '';
    try {
      config = DashboardCommon.normalizeConfig(await DashboardCommon.getConfig());
      activeDashboardId = getValidDashboardId('');
      ensureActiveDashboard();
      applyPageTitle();
      applyDashboardTheme();
    } catch (error) {
      console.error(error);
      loadError = 'Failed to load dashboard config.';
    } finally {
      loading = false;
    }
  }

  async function persistConfig(message = '') {
    config = DashboardCommon.normalizeConfig(config);
    ensureActiveDashboard();
    config = DashboardCommon.normalizeConfig(await DashboardCommon.saveConfig(config));
    ensureActiveDashboard();
    syncDraftsFromActiveDashboard();
    applyCurrentAdminThemePreview();
    if (message && message.trim()) showMessage(message, 'is-success');
  }

  // ─── Mode switching ───────────────────────────────────────────────────────────

  async function enterEditMode() {
    if (window.history?.pushState) window.history.pushState(null, '', '/edit');
    editMode = true;
    try {
      const status = await DashboardCommon.getAuthStatus();
      if (!status?.authenticated) {
        authSetupRequired = Boolean(status?.setupRequired);
        authenticated = false;
        if (authSetupRequired) showMessage('Create the first admin account to continue.', 'is-warning');
        return;
      }
      authUser = status?.username || 'admin';
      authMustChangePassword = Boolean(status?.mustChangePassword);
      authenticated = true;
      syncDraftsFromActiveDashboard();
      applyCurrentAdminThemePreview();
      if (authMustChangePassword) {
        accountPaneOpen = true;
        showMessage('First-time setup: change the account password before editing the dashboard.', 'is-warning');
      }
    } catch (error) {
      console.error(error);
      showMessage('Admin API unavailable. Check backend service.', 'is-danger');
    }
  }

  function exitEditMode() {
    if (window.history?.pushState) window.history.pushState(null, '', '/');
    editMode = false;
    authenticated = false;
    accountPaneOpen = false;
    showThemeEditor = false;
    destroyAllSortables();
    hideMessage();
    applyDashboardTheme();
  }

  function toggleEditMode() {
    if (editMode) { exitEditMode(); } else { enterEditMode(); }
  }

  async function logoutSubmit() {
    hideMessage();
    try { await DashboardCommon.logout(); } catch (error) { console.warn(error); }
    authUser = '';
    exitEditMode();
  }

  // ─── Edit-mode draft sync ─────────────────────────────────────────────────────

  function getSavedThemePresets() {
    const items = Array.isArray(config?.themePresets) ? config.themePresets : [];
    return items.map((preset, i) => ({
      id: preset?.id ? String(preset.id) : `theme-${i + 1}`,
      name: (preset?.name || `Theme ${i + 1}`).toString(),
      theme: normalizeThemePresetTheme(preset?.theme)
    }));
  }

  function getNextCustomThemePresetName() {
    const names = new Set(getSavedThemePresets().map((p) => p.name.trim().toLowerCase()));
    for (let i = 1; i < 10000; i += 1) {
      const candidate = `Custom theme ${i}`;
      if (!names.has(candidate.toLowerCase())) return candidate;
    }
    return `Custom theme ${Date.now()}`;
  }

  function syncDraftsFromActiveDashboard() {
    const dashboard = getActiveDashboard();
    if (!dashboard) return;
    pageTitleDraft = dashboard.label || '';
    enableInternalLinksDraft = Boolean(dashboard.enableInternalLinks);
    showLinkToggleDraft = dashboard.showLinkModeToggle !== false;
    themeDraft = normalizeThemePresetTheme(dashboard);
    if (!themePresetName.trim()) themePresetName = getNextCustomThemePresetName();
  }

  // ─── Edit-mode theme functions ────────────────────────────────────────────────

  function setThemeField(key, value, { commit = false } = {}) {
    const next = { ...themeDraft };
    if (key === 'buttonColorMode') {
      next[key] = DashboardCommon.normalizeButtonColorMode(value);
    } else if (key === 'buttonCycleHueStep') {
      next[key] = clampInteger(value, 1, 180, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleHueStep);
    } else if (key === 'buttonCycleSaturation') {
      next[key] = clampInteger(value, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleSaturation);
    } else if (key === 'buttonCycleLightness') {
      next[key] = clampInteger(value, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleLightness);
    } else if (key === 'buttonSolidColor') {
      next[key] = normalizeHexColorLoose(value) || next[key] || DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor;
    } else {
      const fallback = COLOR_FIELDS.find((f) => f.key === key);
      next[key] = normalizeHexColorLoose(value) || (commit ? (fallback?.placeholder || DEFAULT_THEME[key] || '') : next[key]);
      if (!next[key]) next[key] = fallback?.placeholder || DEFAULT_THEME[key] || '';
    }
    themeDraft = next;
    applyCurrentAdminThemePreview();
    if (commit) saveActiveDashboardSettings().catch((err) => { console.error(err); showMessage('Failed to update tab settings.', 'is-danger'); });
  }

  function resetThemeColors() {
    themeDraft = { ...buildDefaultThemeValues() };
    applyCurrentAdminThemePreview();
    saveActiveDashboardSettings().catch((err) => { console.error(err); showMessage('Failed to reset tab colors.', 'is-danger'); });
  }

  // ─── Edit-mode theme preset functions ────────────────────────────────────────

  function getSelectedThemePreset() {
    const value = (themePresetSelectValue || '').trim();
    if (!value.includes(':')) return null;
    const [scope, id] = value.split(':', 2);
    if (scope === 'builtin') {
      const p = getResolvedBuiltInThemePresets().find((x) => x.id === id);
      return p ? { ...p, scope } : null;
    }
    if (scope === 'saved') {
      const p = getSavedThemePresets().find((x) => x.id === id);
      return p ? { ...p, scope } : null;
    }
    return null;
  }

  async function onThemePresetSelectChange(value) {
    themePresetSelectValue = value;
    const preset = getSelectedThemePreset();
    if (!preset) return;
    themePresetName = getNextCustomThemePresetName();
    themeDraft = normalizeThemePresetTheme(preset.theme);
    applyCurrentAdminThemePreview();
    await saveActiveDashboardSettings({ silentSuccess: true });
  }

  async function saveCurrentThemePreset() {
    hideMessage();
    const name = (themePresetName || '').trim();
    if (!name) { showMessage('Preset name is required.', 'is-danger'); return; }
    const saved = getSavedThemePresets();
    const existingIndex = saved.findIndex((p) => p.name.trim().toLowerCase() === name.toLowerCase());
    const presetId = existingIndex >= 0 ? saved[existingIndex].id : DashboardCommon.createId('theme');
    const nextPreset = { id: presetId, name, theme: normalizeThemePresetTheme(themeDraft) };
    const nextSaved = saved.slice();
    if (existingIndex >= 0) { nextSaved.splice(existingIndex, 1, nextPreset); } else { nextSaved.push(nextPreset); }
    config.themePresets = nextSaved;
    touchConfig();
    themePresetSelectValue = `saved:${presetId}`;
    await persistConfig(existingIndex >= 0 ? 'Theme preset updated.' : 'Theme preset saved.');
  }

  async function deleteSelectedThemePreset() {
    hideMessage();
    const preset = getSelectedThemePreset();
    if (!preset || preset.scope !== 'saved') { showMessage('Select a saved theme preset to delete.', 'is-danger'); return; }
    const saved = getSavedThemePresets();
    const nextSaved = saved.filter((p) => p.id !== preset.id);
    if (nextSaved.length === saved.length) { showMessage('Theme preset not found.', 'is-danger'); return; }
    config.themePresets = nextSaved;
    touchConfig();
    themePresetSelectValue = '';
    await persistConfig(`Theme preset "${preset.name}" deleted.`);
  }

  // ─── Edit-mode save functions ─────────────────────────────────────────────────

  async function saveTabTitle() {
    hideMessage();
    const dashboard = getActiveDashboard();
    if (!dashboard) { showMessage('Dashboard not found.', 'is-danger'); return; }
    const tabTitle = pageTitleDraft.trim();
    if (!tabTitle) { showMessage('Tab title cannot be empty.', 'is-danger'); pageTitleDraft = dashboard.label; return; }
    if (dashboard.label === tabTitle) return;
    dashboard.label = tabTitle;
    touchConfig();
    await persistConfig('Tab title updated.');
  }

  async function saveActiveDashboardSettings(options = {}) {
    hideMessage();
    const silentSuccess = Boolean(options.silentSuccess);
    const dashboard = getActiveDashboard();
    if (!dashboard) { showMessage('Dashboard not found.', 'is-danger'); return; }
    dashboard.enableInternalLinks = Boolean(enableInternalLinksDraft);
    dashboard.showLinkModeToggle = Boolean(showLinkToggleDraft);
    dashboard.backgroundColor = themeDraft.backgroundColor;
    dashboard.groupBackgroundColor = themeDraft.groupBackgroundColor;
    dashboard.textColor = themeDraft.textColor;
    dashboard.buttonTextColor = themeDraft.buttonTextColor;
    dashboard.tabColor = themeDraft.tabColor;
    dashboard.activeTabColor = themeDraft.activeTabColor;
    dashboard.tabTextColor = themeDraft.tabTextColor;
    dashboard.activeTabTextColor = themeDraft.activeTabTextColor;
    dashboard.buttonColorMode = DashboardCommon.normalizeButtonColorMode(themeDraft.buttonColorMode);
    dashboard.buttonCycleHueStep = clampInteger(themeDraft.buttonCycleHueStep, 1, 180, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleHueStep);
    dashboard.buttonCycleSaturation = clampInteger(themeDraft.buttonCycleSaturation, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleSaturation);
    dashboard.buttonCycleLightness = clampInteger(themeDraft.buttonCycleLightness, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleLightness);
    dashboard.buttonSolidColor = DashboardUI.normalizeHexColor(themeDraft.buttonSolidColor) || DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor;
    touchConfig();
    await persistConfig(silentSuccess ? '' : 'Tab settings updated.');
  }

  async function updateGroupTitle(group, nextTitle) {
    const trimmed = (nextTitle || '').trim();
    if (!trimmed) { showMessage('Group title cannot be empty.', 'is-danger'); syncDraftsFromActiveDashboard(); return; }
    if (group.title === trimmed) return;
    group.title = trimmed;
    touchConfig();
    await persistConfig('Group updated.');
  }

  async function pasteColorIntoField(key) {
    if (!navigator.clipboard?.readText) { showMessage('Clipboard paste is not available in this browser.', 'is-danger'); return; }
    try {
      const text = await navigator.clipboard.readText();
      const normalized = normalizeHexColorLoose(text);
      if (!normalized) throw new Error('Clipboard does not contain a valid 6-character hex color.');
      setThemeField(key, normalized, { commit: true });
    } catch (error) {
      console.error(error);
      showMessage(error.message || 'Failed to paste color.', 'is-danger');
    }
  }

  function getGroupButtonSolidColor(group) {
    return DashboardUI.normalizeHexColor(group?.buttonSolidColor) || DashboardUI.normalizeHexColor(themeDraft.buttonSolidColor) || DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor;
  }

  function setGroupButtonSolidColor(group, value, commit = false) {
    group.buttonSolidColor = normalizeHexColorLoose(value) || getGroupButtonSolidColor(group);
    touchConfig();
    if (commit) persistConfig('Tab settings updated.').catch((err) => { console.error(err); showMessage('Failed to update tab settings.', 'is-danger'); });
  }

  // ─── Edit-mode action modals ──────────────────────────────────────────────────

  function openActionModal(options) {
    actionModal = { ...actionModal, ...options, open: true };
  }

  function closeActionModal() {
    actionModal = { ...actionModal, open: false, mode: '', dashboardId: '', groupId: '', buttonId: '' };
  }

  function openAddDashboardModal() {
    openActionModal({
      mode: 'add-dashboard', title: 'Add Dashboard', text: 'Create a new dashboard tab.',
      titleLabel: 'Tab Title', titlePlaceholder: `Dashboard ${((config.dashboards || []).length || 0) + 1}`,
      titleValue: '', titleFieldVisible: true, confirmLabel: 'Add Dashboard', confirmTone: 'is-link'
    });
  }

  function openAddGroupModal() {
    openActionModal({
      mode: 'add-group', dashboardId: activeDashboardId, title: 'Add Group',
      text: 'Create a new group.', titleLabel: 'Group Title', titlePlaceholder: 'New Group',
      titleValue: '', titleFieldVisible: true, confirmLabel: 'Add Group', confirmTone: 'is-link'
    });
  }

  function openDeleteGroupModal(group) {
    const dashboard = getActiveDashboard();
    if (!dashboard || !group) return;
    openActionModal({
      mode: 'delete-group', dashboardId: dashboard.id, groupId: group.id,
      title: 'Delete Group', text: `Delete group "${group.title}" and all buttons?`,
      titleValue: '', titleFieldVisible: false, confirmLabel: 'Delete Group', confirmTone: 'is-danger'
    });
  }

  function openDeleteDashboardModal() {
    const dashboard = getActiveDashboard();
    if (!dashboard) return;
    openActionModal({
      mode: 'delete-dashboard', dashboardId: dashboard.id, title: 'Delete Tab',
      text: `Delete tab "${dashboard.label}" and all its groups/buttons?`,
      titleValue: '', titleFieldVisible: false, confirmLabel: 'Delete Tab', confirmTone: 'is-danger'
    });
  }

  function openDeleteButtonModal(groupId, buttonId, buttonName) {
    openActionModal({
      mode: 'delete-button', dashboardId: activeDashboardId, groupId, buttonId,
      title: 'Delete Button', text: `Delete button "${buttonName}"?`,
      titleValue: '', titleFieldVisible: false, confirmLabel: 'Delete Button', confirmTone: 'is-danger'
    });
  }

  async function confirmActionModal() {
    hideMessage();
    const mode = actionModal.mode;

    if (mode === 'add-dashboard') {
      const label = (actionModal.titleValue || '').trim() || `Dashboard ${(config.dashboards || []).length + 1}`;
      const dashboard = { id: DashboardCommon.makeSafeTabId(label), label, ...buildDefaultThemeValues(), enableInternalLinks: false, showLinkModeToggle: true, themePresets: [], groups: [] };
      const existingIds = new Set((config.dashboards || []).map((d) => d.id));
      let id = dashboard.id; let n = 2;
      while (!id || existingIds.has(id)) { id = `${dashboard.id || 'dashboard'}-${n}`; n += 1; }
      dashboard.id = id;
      config.dashboards.push(dashboard);
      activeDashboardId = dashboard.id;
      closeActionModal();
      await persistConfig('');
      return;
    }

    if (mode === 'add-group') {
      const title = (actionModal.titleValue || '').trim();
      if (!title) { showMessage('Group title cannot be empty.', 'is-danger'); return; }
      const dashboard = getActiveDashboard();
      if (!dashboard) { closeActionModal(); showMessage('Dashboard not found.', 'is-danger'); return; }
      dashboard.groups.push({ id: DashboardCommon.createId('group'), title, groupEnd: true, entries: [] });
      touchConfig();
      closeActionModal();
      await persistConfig('Group added.');
      return;
    }

    if (mode === 'delete-group') {
      const dashboard = config.dashboards[getDashboardIndex(actionModal.dashboardId)];
      if (!dashboard) { closeActionModal(); showMessage('Dashboard not found.', 'is-danger'); return; }
      const groupIndex = dashboard.groups.findIndex((g) => g.id === actionModal.groupId);
      if (groupIndex < 0) { closeActionModal(); showMessage('Group not found.', 'is-danger'); return; }
      dashboard.groups.splice(groupIndex, 1);
      touchConfig(); closeActionModal();
      await persistConfig('Group deleted.');
      return;
    }

    if (mode === 'delete-button') {
      const dashboard = config.dashboards[getDashboardIndex(actionModal.dashboardId)];
      if (!dashboard) { closeActionModal(); showMessage('Dashboard not found.', 'is-danger'); return; }
      const group = dashboard.groups.find((g) => g.id === actionModal.groupId);
      if (!group) { closeActionModal(); showMessage('Group not found.', 'is-danger'); return; }
      const buttonIndex = group.entries.findIndex((e) => e.id === actionModal.buttonId);
      if (buttonIndex < 0) { closeActionModal(); showMessage('Button not found.', 'is-danger'); return; }
      group.entries.splice(buttonIndex, 1);
      touchConfig(); closeActionModal(); buttonModalOpen = false;
      await persistConfig('Button deleted.');
      return;
    }

    if (mode === 'delete-dashboard') {
      if ((config.dashboards || []).length <= 1) { closeActionModal(); showMessage('At least one dashboard is required.', 'is-danger'); return; }
      const index = getDashboardIndex(actionModal.dashboardId);
      if (index < 0) { closeActionModal(); showMessage('Dashboard not found.', 'is-danger'); return; }
      config.dashboards.splice(index, 1);
      if (activeDashboardId === actionModal.dashboardId) activeDashboardId = config.dashboards[0]?.id || '';
      touchConfig(); closeActionModal();
      await persistConfig('');
    }
  }

  // ─── Edit-mode button modal ───────────────────────────────────────────────────

  function openButtonModal(groupId, buttonId = '') {
    const dashboard = getActiveDashboard();
    const group = dashboard?.groups?.find((item) => item.id === groupId);
    if (!group) { showMessage('Group not found.', 'is-danger'); return; }
    let buttonEntry = null;
    if (buttonId) {
      buttonEntry = group.entries.find((item) => item.id === buttonId) || null;
      if (!buttonEntry) { showMessage('Button not found.', 'is-danger'); return; }
    }
    buttonModalIsNew = !buttonId;
    buttonModalGroupId = groupId;
    buttonModalButtonId = buttonId || '';
    buttonModalInitialData = {
      name: buttonEntry?.name || '', icon: buttonEntry?.icon || '',
      externalUrl: buttonEntry?.links?.external || '', internalUrl: buttonEntry?.links?.internal || '',
      iconData: buttonEntry?.iconData || ''
    };
    buttonModalOpen = true;
  }

  function findButtonPosition(dashboard, buttonId) {
    for (let g = 0; g < (dashboard?.groups || []).length; g += 1) {
      const b = dashboard.groups[g].entries.findIndex((e) => e.id === buttonId);
      if (b >= 0) return { groupIndex: g, buttonIndex: b };
    }
    return null;
  }

  async function handleButtonModalSave(event) {
    hideMessage();
    const d = event.detail;
    const dashboard = config.dashboards[getDashboardIndex(activeDashboardId)];
    if (!dashboard) { showMessage('Dashboard not found.', 'is-danger'); return; }
    let groupIndex = dashboard.groups.findIndex((g) => g.id === d.groupId);
    if (groupIndex < 0) { showMessage('Group not found.', 'is-danger'); return; }
    let buttonEntry; let isNew = false;
    if (d.isNew) {
      buttonEntry = { id: DashboardCommon.createId('button'), name: '', icon: '', iconData: '', links: { external: '', internal: '' } };
      isNew = true;
    } else {
      const pos = findButtonPosition(dashboard, d.buttonId);
      if (!pos) { showMessage('Button not found.', 'is-danger'); return; }
      groupIndex = pos.groupIndex;
      buttonEntry = dashboard.groups[pos.groupIndex].entries[pos.buttonIndex];
    }
    buttonEntry.name = d.name; buttonEntry.icon = d.icon;
    buttonEntry.links = buttonEntry.links && typeof buttonEntry.links === 'object' ? buttonEntry.links : {};
    buttonEntry.links.external = d.externalUrl; buttonEntry.links.internal = d.internalUrl;
    buttonEntry.iconData = d.iconData;
    if (isNew) dashboard.groups[groupIndex].entries.push(buttonEntry);
    touchConfig(); buttonModalOpen = false;
    await persistConfig('');
    if (isNew) showMessage('Button added.', 'is-success');
  }

  function handleButtonModalDeleteRequest(event) {
    const { groupId, buttonId, buttonName } = event.detail;
    openDeleteButtonModal(groupId, buttonId, buttonName);
  }

  // ─── Edit-mode DnD (Sortable.js) ──────────────────────────────────────────────

  function reorderByIdsPreservingObjects(items, orderedIds) {
    const source = Array.isArray(items) ? items : [];
    const byId = new Map(source.filter((x) => x?.id).map((x) => [x.id, x]));
    const next = []; const seen = new Set();
    for (const id of (Array.isArray(orderedIds) ? orderedIds : [])) {
      if (!id || seen.has(id)) continue;
      const item = byId.get(id);
      if (!item) continue;
      next.push(item); seen.add(id);
    }
    for (const item of source) {
      if (!item?.id || seen.has(item.id)) continue;
      next.push(item); seen.add(item.id);
    }
    return next;
  }

  function collectChildIds(container, selector, attrName) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(selector))
      .map((node) => (node instanceof HTMLElement ? (node.dataset?.[attrName] || '').trim() : ''))
      .filter(Boolean);
  }

  function applyTabsOrderFromDom() {
    const list = document.getElementById('mainTabsList');
    if (!list) return;
    const orderedIds = collectChildIds(list, ':scope > li.tab-sort-item[data-dashboard-id]', 'dashboardId');
    if (!orderedIds.length && (config.dashboards || []).length) return;
    config.dashboards = reorderByIdsPreservingObjects(config.dashboards, orderedIds);
    touchConfig(); ensureActiveDashboard(); syncDraftsFromActiveDashboard(); applyCurrentAdminThemePreview();
  }

  function applyGroupsOrderFromDom() {
    const dashboard = getActiveDashboard();
    if (!dashboard) return;
    const container = document.getElementById('groupsEditor');
    if (!container) return;
    const orderedIds = collectChildIds(container, ':scope > section[data-group-sort-item][data-group-id]', 'groupId');
    if (!orderedIds.length && (dashboard.groups || []).length) return;
    dashboard.groups = reorderByIdsPreservingObjects(dashboard.groups, orderedIds);
    touchConfig();
  }

  function applyButtonOrdersFromDom() {
    const dashboard = getActiveDashboard();
    if (!dashboard) return;
    const groups = Array.isArray(dashboard.groups) ? dashboard.groups : [];
    const groupsById = new Map(groups.map((g) => [g.id, g]));
    const allEntriesById = new Map();
    for (const group of groups) {
      for (const entry of Array.isArray(group.entries) ? group.entries : []) {
        if (entry?.id && !allEntriesById.has(entry.id)) allEntriesById.set(entry.id, entry);
      }
    }
    const grids = Array.from(document.querySelectorAll('#groupsEditor .entry-grid[data-group-id]'));
    if (!grids.length) return;
    const seenIds = new Set();
    for (const grid of grids) {
      if (!(grid instanceof HTMLElement)) continue;
      const groupId = (grid.dataset?.groupId || '').trim();
      const group = groupsById.get(groupId);
      if (!group) continue;
      const orderedIds = collectChildIds(grid, ':scope > div[data-button-sort-item][data-button-id]', 'buttonId');
      const nextEntries = [];
      for (const id of orderedIds) {
        if (!id || seenIds.has(id)) continue;
        const entry = allEntriesById.get(id);
        if (!entry) continue;
        nextEntries.push(entry); seenIds.add(id);
      }
      for (const entry of Array.isArray(group.entries) ? group.entries : []) {
        if (!entry?.id || seenIds.has(entry.id)) continue;
        nextEntries.push(entry); seenIds.add(entry.id);
      }
      group.entries = nextEntries;
    }
    touchConfig();
  }

  function queueDndPersist(errorMessage) {
    if (dndPersistTimer) { clearTimeout(dndPersistTimer); dndPersistTimer = null; }
    dndPersistTimer = setTimeout(() => {
      dndPersistTimer = null;
      persistConfig('').catch((err) => { console.error(err); showMessage(errorMessage || 'Failed to reorder items.', 'is-danger'); });
    }, 0);
  }

  function destroySortableInstance(instance) {
    if (!instance) return;
    try { instance.destroy(); } catch (err) { console.error(err); }
  }

  function destroyAllSortables() {
    destroySortableInstance(tabsSortable); tabsSortable = null;
    destroySortableInstance(groupsSortable); groupsSortable = null;
    for (const s of buttonSortables) destroySortableInstance(s);
    buttonSortables = [];
  }

  function createSortableInstances() {
    destroyAllSortables();
    if (!editMode || !authenticated) return;
    const tabsList = document.getElementById('mainTabsList');
    if (tabsList) {
      tabsSortable = Sortable.create(tabsList, {
        animation: DND_FLIP_DURATION_MS, draggable: 'li.tab-sort-item[data-dashboard-id]',
        handle: '.tab-drag-handle',
        forceFallback: true,
        onEnd: () => { try { applyTabsOrderFromDom(); queueDndPersist('Failed to reorder tabs.'); } catch (e) { console.error(e); showMessage('Failed to reorder tabs.', 'is-danger'); } }
      });
    }
    const groupsContainer = document.getElementById('groupsEditor');
    if (groupsContainer?.querySelector('section[data-group-sort-item]')) {
      groupsSortable = Sortable.create(groupsContainer, {
        group: { name: 'kiss-groups', pull: false, put: false },
        animation: DND_FLIP_DURATION_MS, draggable: 'section[data-group-sort-item][data-group-id]',
        handle: '.group-drag-handle',
        scroll: true, scrollSensitivity: 100, scrollSpeed: 10,
        onEnd: () => { try { applyGroupsOrderFromDom(); queueDndPersist('Failed to reorder groups.'); } catch (e) { console.error(e); showMessage('Failed to reorder groups.', 'is-danger'); } }
      });
    }
    buttonSortables = Array.from(document.querySelectorAll('#groupsEditor .entry-grid[data-group-id]')).map((grid) =>
      Sortable.create(grid, {
        group: { name: 'kiss-buttons', pull: true, put: true },
        animation: DND_FLIP_DURATION_MS, draggable: 'div[data-button-sort-item][data-button-id]',
        handle: '.button-drag-handle',
        scroll: true, scrollSensitivity: 100, scrollSpeed: 10,
        forceFallback: true,
        onEnd: () => { try { applyButtonOrdersFromDom(); queueDndPersist('Failed to reorder buttons.'); } catch (e) { console.error(e); showMessage('Failed to reorder buttons.', 'is-danger'); } }
      })
    );
  }

  function queueSortableRefresh() {
    if (sortableRefreshQueued) return;
    sortableRefreshQueued = true;
    Promise.resolve().then(async () => { sortableRefreshQueued = false; await tick(); createSortableInstances(); });
  }

  // ─── Edit-mode group decorations ──────────────────────────────────────────────

  function decoratedEditorGroups() {
    const dashboard = getActiveDashboard();
    if (!dashboard) return [];
    const previewDashboard = { ...dashboard, ...themeDraft };
    const groups = Array.isArray(dashboard.groups) ? dashboard.groups : [];
    let colorIndex = 0;
    return groups.map((group) => {
      const entries = (Array.isArray(group.entries) ? group.entries : []).map((buttonEntry) => {
        const color = DashboardCommon.getButtonColorPair(previewDashboard, group, colorIndex);
        colorIndex += 1;
        return { id: buttonEntry.id, buttonEntry, color, iconSrc: iconSource(buttonEntry) };
      });
      return { id: group.id, group, entries };
    });
  }

  function accountLinkLabel() {
    if (authMustChangePassword) return accountPaneOpen ? 'Close Setup' : 'Finish Setup';
    return accountPaneOpen ? 'Close Account' : 'Account';
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  afterUpdate(() => {
    if (editMode && authenticated) {
      queueSortableRefresh();
    } else {
      destroyAllSortables();
    }
  });

  onDestroy(() => {
    destroyAllSortables();
    clearMessageTimer();
    resizeObserver?.disconnect();
  });

  onMount(() => {
    const pathname = window.location.pathname || '/';
    // Normalize legacy URLs
    if (pathname === '/index.html' && window.history?.replaceState) window.history.replaceState(null, '', '/');
    else if (/^\/(?:edit\.html|admin(?:\.html)?)/.test(pathname) && window.history?.replaceState) window.history.replaceState(null, '', '/edit');

    const startInEditMode = /^\/edit\/?$/.test(window.location.pathname);

    loadConfig().then(() => {
      if (startInEditMode) enterEditMode();
    });

    const onResize = () => { applyDashboardTheme(); updateViewportState(); updateTabsOverflowState(); };
    window.addEventListener('resize', onResize);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateTabsOverflowState());
      if (tabsScrollEl) resizeObserver.observe(tabsScrollEl);
      if (tabsListEl) resizeObserver.observe(tabsListEl);
    }
    updateViewportState();

    return () => {
      window.removeEventListener('resize', onResize);
      destroyAllSortables();
      clearMessageTimer();
    };
  });

  // ─── Reactive declarations ────────────────────────────────────────────────────

  $: { config; activeDashboardId; activeDashboard = getActiveDashboard(); }
  $: { activeDashboard; currentLinkMode; viewGroups = (!editMode && activeDashboard) ? buttonDecorations(activeDashboard) : []; }
  $: { editMode; authenticated; config; activeDashboardId; themeDraft; editorGroups = (editMode && authenticated) ? decoratedEditorGroups() : []; }
  $: { config; builtInThemePresets = getResolvedBuiltInThemePresets(); savedThemePresets = getSavedThemePresets(); }
  $: { themePresetSelectValue; builtInThemePresets; savedThemePresets; themePresetSelected = getSelectedThemePreset(); canDeleteThemePreset = Boolean(themePresetSelected?.scope === 'saved'); }
  $: { themeDraft; themeButtonMode = DashboardCommon.normalizeButtonColorMode(themeDraft.buttonColorMode); }
  $: showLinkToggle = !editMode && Boolean(activeDashboard?.enableInternalLinks);
  $: showEditInToolbar = true;
  $: { loading; activeDashboard; config; if (!loading && activeDashboard && !editMode) { applyPageTitle(); applyDashboardTheme(); } }
</script>

<svelte:head>
  <style data-kiss-route="native-hover">
    .entry-button { background-color: var(--entry-btn-base, transparent); }
    .entry-button:hover { background-color: var(--entry-btn-hover, var(--entry-btn-base, transparent)); }
    .entry-preview-button { background-color: var(--entry-btn-base, transparent); }
    .entry-preview-button:hover { background-color: var(--entry-btn-hover, var(--entry-btn-base, transparent)); }
  </style>
</svelte:head>

<section class="section">
  <div class={editMode ? 'admin-shell' : 'dashboard-shell'}>

    {#if editMode}
      <div id="messageBox" class={`notification ${messageVisible ? '' : 'is-hidden'} ${messageTone}`.trim()}>{messageText}</div>
    {/if}

    <!-- ─── Shared toolbar ──────────────────────────────────────────── -->
    <div class="toolbar {editMode ? 'mode-tabs-toolbar' : ''}">
      <div class="tabs is-boxed mode-tabs">
        <div bind:this={tabsRowEl} class="mode-tabs-row">
          <div bind:this={tabsScrollEl} class="mode-tabs-scroll">
            <ul bind:this={tabsListEl} id="mainTabsList">
              {#each config.dashboards as dashboard (dashboard.id)}
                <li
                  class={`${dashboard.id === activeDashboardId ? 'is-active ' : ''}${editMode ? 'tab-sort-item' : ''}`.trim()}
                  data-tab-sort-item={editMode ? '' : undefined}
                  data-dashboard-id={editMode ? dashboard.id : undefined}
                  animate:flip={{ duration: DND_FLIP_DURATION_MS }}
                >
                  <a href="/" role="button" on:click|preventDefault={() => setActiveDashboard(dashboard.id)}>
                    {#if editMode && authenticated}
                      <span class="drag-handle tab-drag-handle" title={`Drag to reorder tab ${dashboard.label}`} aria-label={`Drag to reorder tab ${dashboard.label}`}>⋮⋮</span>
                    {/if}
                    <span class="tab-link-label">{dashboard.label}</span>
                  </a>
                </li>
              {/each}
              {#if editMode && authenticated}
                <li class="add-tab">
                  <a href="/edit" title="Add dashboard" aria-label="Add dashboard" on:click|preventDefault={openAddDashboardModal}>+</a>
                </li>
              {/if}
            </ul>
          </div>
        </div>
      </div>

      <!-- Link mode toggle + overflow edit toggle -->
      {#if showLinkToggle || showEditInToolbar}
        <div class="toolbar-mode-row">
          {#if showLinkToggle}
            <div class="toolbar-mode-left">
              <div class="mode-switch dashboard-link-mode">
                <span class="mode-switch-label">Use internal links</span>
                <label class="ios-switch" for="linkModeToggle">
                  <input id="linkModeToggle" type="checkbox" checked={currentLinkMode === 'internal'} on:change={(e) => setLinkMode(e.currentTarget.checked ? 'internal' : 'external')} aria-label="Switch between external and internal links" />
                  <span class="ios-switch-slider"></span>
                </label>
              </div>
            </div>
          {/if}
          {#if showEditInToolbar}
            <div class="toolbar-mode-actions">
              <div class="mode-switch dashboard-link-mode nav-edit-mode-toggle" role="button" tabindex="0"
                on:click={(e) => { if (!e.target?.closest?.('.ios-switch')) toggleEditMode(); }}
                on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEditMode(); } }}>
                <span class="mode-switch-label">Edit</span>
                <label class="ios-switch">
                  <input type="checkbox" checked={editMode} on:change={toggleEditMode} aria-label="Toggle Edit" />
                  <span class="ios-switch-slider"></span>
                </label>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- ─── Edit-mode: admin topbar ─────────────────────────────────── -->
    {#if editMode && authenticated}
      <div class="admin-topbar-shell mt-3 mb-5">
        <div class="admin-topbar">
          <div class="admin-topbar-left">
            <h1 class="title is-4 mb-0">KISS dashboard</h1>
            <button id="accountLinkBtn" class={`button is-small account-link-btn ${authMustChangePassword ? 'is-warning' : 'is-link'} is-light`.trim()} type="button" on:click={() => (accountPaneOpen = !accountPaneOpen)}>{accountLinkLabel()}</button>
          </div>
          <div class="admin-topbar-actions">
            <button id="logoutBtn" class="button is-danger is-light is-small" type="button" on:click={logoutSubmit}>Log Out</button>
          </div>
        </div>
        {#if authMustChangePassword}
          <div class="notification is-warning is-light mt-3 mb-0">
            First-time setup required: change the account password before editing or saving dashboard settings.
          </div>
        {/if}
      </div>
    {/if}

    <!-- ─── View mode: dashboard ─────────────────────────────────────── -->
    {#if !editMode}
      <div id="dashboardContent">
        {#if loading}
          <div class="empty-state">Loading dashboard…</div>
        {:else if loadError}
          <div class="empty-state">{loadError}</div>
        {:else if !activeDashboard || !viewGroups.length}
          <div class="empty-state">No groups configured yet. Flip the Edit toggle to add one.</div>
        {:else}
          {#each viewGroups as item}
            <section class="group-box" class:group-end={item.group?.groupEnd}>
              <h2 class="title is-6 group-title">{item.group?.title || 'Untitled Group'}</h2>
              <div class="columns is-mobile is-multiline entry-grid">
                {#each item.entries as decorated}
                  <div class="column is-half-mobile is-one-third-tablet is-one-quarter-desktop">
                    <a
                      class="button is-fullwidth entry-button"
                      href={decorated.href || '#'}
                      target={decorated.href ? '_blank' : undefined}
                      rel={decorated.href ? 'noopener noreferrer' : undefined}
                      class:is-static={!decorated.href}
                      style={`--entry-btn-base:${decorated.color.base};--entry-btn-hover:${decorated.color.hover};`}
                      on:click={(e) => { if (!decorated.href) e.preventDefault(); }}
                    >
                      <span class="icon entry-icon">
                        {#if decorated.iconSrc}<img src={decorated.iconSrc} alt={`${decorated.entry?.name || 'Button'} icon`} />{/if}
                      </span>
                      <span class="entry-label">{decorated.entry?.name || 'Unnamed'}</span>
                    </a>
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        {/if}
      </div>
    {/if}

    <!-- ─── Edit mode: login or admin panel ──────────────────────────── -->
    {#if editMode}
      {#if !authenticated}
        <LoginView
          bind:authSetupRequired
          showMessage={showMessage}
          on:loginsuccess={async (e) => {
            authUser = e.detail.user;
            authMustChangePassword = Boolean(e.detail.mustChangePassword);
            authSetupRequired = false;
            authenticated = true;
            syncDraftsFromActiveDashboard();
            applyCurrentAdminThemePreview();
            if (authMustChangePassword) {
              accountPaneOpen = true;
              showMessage('First-time setup: change the account password before editing the dashboard.', 'is-warning');
            }
          }}
        />
      {:else}
        <div id="editorPane">
          <div class="box panel-box dashboard-settings-box">
            <div class="settings-head">
              <h2 class="title is-5">Tab Settings</h2>
              <div class="settings-actions">
                <button id="liveColorEditorToggleBtn" class="button is-link is-light is-small" type="button" on:click={() => (showThemeEditor = !showThemeEditor)}>{showThemeEditor ? 'Hide theme editor' : 'Show theme editor'}</button>
                <button id="deleteDashboardBtn" class="button is-danger is-light is-small delete-dashboard-btn" type="button" disabled={(config.dashboards || []).length <= 1} on:click={openDeleteDashboardModal}>Delete tab</button>
              </div>
            </div>
            <div class="field mb-3">
              <label class="label" for="pageTitleInput">Tab Title</label>
              <div class="title-editor">
                <input id="pageTitleInput" class="input" type="text" maxlength="80" placeholder="Dashboard 1" bind:value={pageTitleDraft} on:keydown={(e)=> e.key === 'Enter' && e.currentTarget.blur()} on:blur={() => saveTabTitle().catch((err) => { console.error(err); showMessage('Failed to update tab title.', 'is-danger'); })} />
              </div>
            </div>
            <div class="field mb-3">
              <label class="checkbox">
                <input id="enableInternalLinksCheckbox" type="checkbox" bind:checked={enableInternalLinksDraft} on:change={() => saveActiveDashboardSettings().catch((err) => { console.error(err); showMessage('Failed to update tab settings.', 'is-danger'); })} />
                Use internal and external links
              </label>
            </div>

            <div id="liveColorEditorPanel" class={`live-color-editor-panel ${showThemeEditor ? '' : 'is-hidden'}`.trim()}>
              <div class="live-color-editor-head">
                <h3 class="title is-5">Theme Editor</h3>
                <button id="resetThemeColorsBtn" class="button is-link is-light is-small" type="button" on:click={resetThemeColors}>Reset Colors</button>
              </div>
              <div class="columns is-multiline">
                <div class="column is-12">
                  <div class="field mb-0">
                    <label class="label" for="themePresetSelect">Theme Presets</label>
                    <div class="theme-preset-editor-card">
                      <div class="theme-preset-toolbar">
                        <p class="control is-expanded">
                          <span class="select is-fullwidth">
                            <select id="themePresetSelect" bind:value={themePresetSelectValue} on:change={(e) => onThemePresetSelectChange(e.currentTarget.value).catch((err) => { console.error(err); showMessage('Failed to load theme preset.', 'is-danger'); })}>
                              <option value="">-Select a theme-</option>
                              {#if builtInThemePresets.length}
                                <optgroup label="Built-in">
                                  {#each builtInThemePresets as preset}
                                    <option value={`builtin:${preset.id}`}>{preset.name}</option>
                                  {/each}
                                </optgroup>
                              {/if}
                              {#if savedThemePresets.length}
                                <optgroup label="Saved themes">
                                  {#each savedThemePresets as preset}
                                    <option value={`saved:${preset.id}`}>{preset.name}</option>
                                  {/each}
                                </optgroup>
                              {/if}
                            </select>
                          </span>
                        </p>
                        <p class={`control ${canDeleteThemePreset ? '' : 'is-hidden'}`.trim()}>
                          <button id="themePresetDeleteBtn" class="button is-danger is-light" type="button" disabled={!canDeleteThemePreset} on:click={() => deleteSelectedThemePreset().catch((err) => { console.error(err); showMessage('Failed to delete theme preset.', 'is-danger'); })}>Delete</button>
                        </p>
                      </div>
                      <div class="theme-preset-save-row">
                        <input id="themePresetNameInput" class="input" type="text" maxlength="60" placeholder="Save current theme as preset" bind:value={themePresetName} />
                        <button id="themePresetSaveBtn" class="button is-link" type="button" on:click={() => saveCurrentThemePreset().catch((err) => { console.error(err); showMessage('Failed to save theme preset.', 'is-danger'); })}>Save Current Theme</button>
                      </div>
                      <p class="help mb-0">Built-in presets are available for every tab. Saved themes are available across all tabs.</p>
                    </div>
                  </div>
                </div>

                <div class="column is-12">
                  <div class="field mb-0">
                    <label class="label" for="buttonColorModeSelect">Button Colors</label>
                    <div class="button-color-editor-card">
                      <div class="field">
                        <div class="control">
                          <div class="select is-fullwidth">
                            <select id="buttonColorModeSelect" bind:value={themeDraft.buttonColorMode} on:change={() => { themeDraft = { ...themeDraft, buttonColorMode: DashboardCommon.normalizeButtonColorMode(themeDraft.buttonColorMode) }; applyCurrentAdminThemePreview(); saveActiveDashboardSettings().catch((err) => { console.error(err); showMessage('Failed to update tab settings.', 'is-danger'); }); }}>
                              <option value="cycle-custom">Color cycle</option>
                              <option value="solid-all">Solid color (all buttons)</option>
                              <option value="solid-per-group">Solid colors per group</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div class:is-hidden={themeButtonMode !== 'cycle-custom'}>
                        <div class="button-color-mode-grid">
                          <div class="field mb-0">
                            <label class="label" for="buttonCycleHueStepInput">Hue Step</label>
                            <input id="buttonCycleHueStepInput" class="input button-color-number-input" type="number" min="1" max="180" step="1" value={themeDraft.buttonCycleHueStep} on:input={(e)=> { themeDraft = { ...themeDraft, buttonCycleHueStep: clampInteger(e.currentTarget.value, 1, 180, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleHueStep) }; }} on:change={() => saveActiveDashboardSettings().catch((err) => { console.error(err); showMessage('Failed to update tab settings.', 'is-danger'); })} />
                          </div>
                          <div class="field mb-0">
                            <label class="label" for="buttonCycleSaturationInput">Saturation (%)</label>
                            <input id="buttonCycleSaturationInput" class="input button-color-number-input" type="number" min="0" max="100" step="1" value={themeDraft.buttonCycleSaturation} on:input={(e)=> { themeDraft = { ...themeDraft, buttonCycleSaturation: clampInteger(e.currentTarget.value, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleSaturation) }; }} on:change={() => saveActiveDashboardSettings().catch((err) => { console.error(err); showMessage('Failed to update tab settings.', 'is-danger'); })} />
                          </div>
                          <div class="field mb-0">
                            <label class="label" for="buttonCycleLightnessInput">Lightness (%)</label>
                            <input id="buttonCycleLightnessInput" class="input button-color-number-input" type="number" min="0" max="100" step="1" value={themeDraft.buttonCycleLightness} on:input={(e)=> { themeDraft = { ...themeDraft, buttonCycleLightness: clampInteger(e.currentTarget.value, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleLightness) }; }} on:change={() => saveActiveDashboardSettings().catch((err) => { console.error(err); showMessage('Failed to update tab settings.', 'is-danger'); })} />
                          </div>
                        </div>
                      </div>
                      <div class={`mt-3 ${themeButtonMode === 'solid-all' ? '' : 'is-hidden'}`.trim()}>
                        <div class="field mb-0">
                          <label class="label" for="buttonSolidColorCodeInput">Button Color</label>
                          <div class="field has-addons color-picker-row">
                            <p class="control"><span class="color-swatch-addon" aria-hidden="true" style={`background-color:${themeDraft.buttonSolidColor || DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor}`}></span></p>
                            <p class="control is-expanded"><input id="buttonSolidColorCodeInput" class="input color-code-input" type="text" inputmode="text" maxlength="7" placeholder="#93c5fd" value={themeDraft.buttonSolidColor} on:keydown={(e)=> e.key === 'Enter' && e.currentTarget.blur()} on:input={(e)=> { const n = normalizeHexColorLoose(e.currentTarget.value); if (n) themeDraft = { ...themeDraft, buttonSolidColor: n }; }} on:blur={(e)=> setThemeField('buttonSolidColor', e.currentTarget.value, { commit: true })} /></p>
                            <p class="control"><button class="input-icon-btn paste-btn" type="button" title="Paste color code" aria-label="Paste color code" on:click={() => pasteColorIntoField('buttonSolidColor')}>📋</button></p>
                            <p class="control"><label class="input-icon-btn color-picker-btn" title="Open color picker" aria-label="Open color picker">🎨<input class="color-picker-input" type="color" value={themeDraft.buttonSolidColor} on:input={(e)=> { themeDraft = { ...themeDraft, buttonSolidColor: e.currentTarget.value }; applyCurrentAdminThemePreview(); }} on:change={(e)=> setThemeField('buttonSolidColor', e.currentTarget.value, { commit: true })} /></label></p>
                          </div>
                        </div>
                      </div>
                      <p class={`help mt-3 ${themeButtonMode === 'solid-per-group' ? '' : 'is-hidden'}`.trim()}>Per-group button color pickers are shown inside each group block.</p>
                    </div>
                  </div>
                </div>

                {#each COLOR_FIELDS as field}
                  <div class={`column ${field.columnClass}`}>
                    <div class="field mb-0">
                      <label class="label" for={`${field.key}CodeInput`}>{field.label}</label>
                      <div class="field has-addons color-picker-row">
                        <p class="control"><span id={`${field.key}Swatch`} class="color-swatch-addon" aria-hidden="true" style={`background-color:${themeDraft[field.key] || field.placeholder}`}></span></p>
                        <p class="control is-expanded">
                          <input
                            id={`${field.key}CodeInput`}
                            class="input color-code-input"
                            type="text" inputmode="text" maxlength="7"
                            placeholder={field.placeholder}
                            value={themeDraft[field.key] || field.placeholder}
                            on:keydown={(e)=> e.key === 'Enter' && e.currentTarget.blur()}
                            on:input={(e) => { const n = normalizeHexColorLoose(e.currentTarget.value); if (n) { themeDraft = { ...themeDraft, [field.key]: n }; applyCurrentAdminThemePreview(); } }}
                            on:blur={(e) => setThemeField(field.key, e.currentTarget.value, { commit: true })}
                          />
                        </p>
                        <p class="control"><button id={`${field.key}PasteBtn`} class="input-icon-btn paste-btn" type="button" title="Paste color code" aria-label="Paste color code" on:click={() => pasteColorIntoField(field.key)}>📋</button></p>
                        <p class="control"><label class="input-icon-btn color-picker-btn" title="Open color picker" aria-label="Open color picker">🎨<input id={`${field.key}Input`} class="color-picker-input" type="color" value={themeDraft[field.key] || field.placeholder} on:input={(e) => { themeDraft = { ...themeDraft, [field.key]: e.currentTarget.value }; applyCurrentAdminThemePreview(); }} on:change={(e)=> setThemeField(field.key, e.currentTarget.value, { commit: true })} /></label></p>
                      </div>
                      <p class="help mt-2">{field.help}</p>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          {#if !editorGroups.length}
            <div id="groupsEditor">
              <div class="box panel-box">
                <p class="muted">No groups configured yet. Add a group to get started.</p>
              </div>
            </div>
          {:else}
            <div id="groupsEditor">
              {#each editorGroups as row (row.group.id)}
                <section
                  class={`box group-box ${row.group.groupEnd ? 'group-end' : ''}`.trim()}
                  data-group-sort-item=""
                  data-group-id={row.group.id}
                  animate:flip={{ duration: DND_FLIP_DURATION_MS }}
                >
                  <div class="group-head">
                    <div class="group-head-main">
                      <button type="button" class="drag-handle group-drag-handle" title={`Drag to reorder group ${row.group.title || 'group'}`} aria-label={`Drag to reorder group ${row.group.title || 'group'}`}>⋮⋮</button>
                      <input
                        type="text" class="input group-title-input" maxlength="80"
                        value={row.group.title} placeholder="Group title"
                        on:keydown={(e)=> e.key === 'Enter' && e.currentTarget.blur()}
                        on:blur={(e)=> updateGroupTitle(row.group, e.currentTarget.value).catch((err) => { console.error(err); showMessage('Failed to update group title.', 'is-danger'); })}
                      />
                      {#if themeButtonMode === 'solid-per-group'}
                        <div class="group-button-color-inline">
                          <span class="group-button-color-inline-label">Button Color</span>
                          <input type="color" aria-label={`Button color for group ${row.group.title || 'group'}`} value={getGroupButtonSolidColor(row.group)} on:input={(e)=> setGroupButtonSolidColor(row.group, e.currentTarget.value, false)} on:change={(e)=> setGroupButtonSolidColor(row.group, e.currentTarget.value, true)} />
                          <input class="input" type="text" maxlength="7" inputmode="text" placeholder={DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor} value={getGroupButtonSolidColor(row.group)} on:keydown={(e)=> e.key === 'Enter' && e.currentTarget.blur()} on:input={(e)=> { const n = normalizeHexColorLoose(e.currentTarget.value); if (n) setGroupButtonSolidColor(row.group, n, false); }} on:blur={(e)=> setGroupButtonSolidColor(row.group, e.currentTarget.value, true)} aria-label={`Button color code for group ${row.group.title || 'group'}`} />
                        </div>
                      {/if}
                      <button type="button" class="button is-danger is-light is-small group-delete-btn" on:click={() => openDeleteGroupModal(row.group)}>Delete group</button>
                    </div>
                  </div>

                  <div class="columns is-mobile is-multiline entry-grid" data-button-sort-container="" data-group-id={row.group.id}>
                    {#each row.entries as cell (cell.buttonEntry.id)}
                      <div
                        class="column is-half-mobile is-one-third-tablet is-one-quarter-desktop"
                        data-button-sort-item=""
                        data-button-id={cell.buttonEntry.id}
                        animate:flip={{ duration: DND_FLIP_DURATION_MS }}
                      >
                        <div class="entry-admin-card">
                          <button
                            type="button" class="button is-fullwidth entry-preview-button"
                            title={`Edit button: ${cell.buttonEntry.name}`}
                            aria-label={`Edit button ${cell.buttonEntry.name}`}
                            style={`--entry-btn-base:${cell.color.base};--entry-btn-hover:${cell.color.hover};`}
                            on:click={() => openButtonModal(row.group.id, cell.buttonEntry.id)}
                          >
                            <span class="drag-handle button-drag-handle" title={`Drag to reorder button ${cell.buttonEntry.name || 'button'}`} aria-label={`Drag to reorder button ${cell.buttonEntry.name || 'button'}`}>⋮⋮</span>
                            <span class="icon entry-icon">{#if cell.iconSrc}<img src={cell.iconSrc} alt={`${cell.buttonEntry.name} icon`} />{/if}</span>
                            <span class="entry-label">{cell.buttonEntry.name}</span>
                            <span class="entry-preview-edit-icon" aria-hidden="true">✎</span>
                          </button>
                        </div>
                      </div>
                    {/each}
                    <div class="column is-half-mobile is-one-third-tablet is-one-quarter-desktop" data-entry-add-slot="">
                      <div class="entry-admin-card">
                        <button type="button" class="button is-fullwidth entry-add-button" title="Add button" aria-label="Add button" on:click={() => openButtonModal(row.group.id)}>+</button>
                      </div>
                    </div>
                  </div>
                </section>
              {/each}
            </div>
          {/if}

          <div class="box panel-box group-add-panel">
            <button id="addGroupBtn" class="button is-fullwidth group-add-panel-button" type="button" title="Add group" aria-label="Add group" on:click={openAddGroupModal}>+</button>
          </div>
        </div>
      {/if}
    {/if}

  </div>
</section>

<!-- ─── Modals (edit mode only) ──────────────────────────────────────── -->
{#if editMode}
  <ButtonModal
    open={buttonModalOpen}
    isNew={buttonModalIsNew}
    groupId={buttonModalGroupId}
    buttonId={buttonModalButtonId}
    initialData={buttonModalInitialData}
    internalLinksEnabled={enableInternalLinksDraft}
    showMessage={showMessage}
    on:close={() => (buttonModalOpen = false)}
    on:save={(e) => handleButtonModalSave(e).catch((err) => { console.error(err); showMessage('Failed to save button.', 'is-danger'); })}
    on:deleterequest={handleButtonModalDeleteRequest}
  />

  <AccountPane
    open={accountPaneOpen}
    authUser={authUser}
    authMustChangePassword={authMustChangePassword}
    showMessage={showMessage}
    on:close={() => (accountPaneOpen = false)}
    on:usernamechanged={(e) => { authUser = e.detail.user; }}
    on:passwordchanged={(e) => { authMustChangePassword = Boolean(e.detail.mustChangePassword); if (!authMustChangePassword) accountPaneOpen = false; }}
  />

  <div id="groupActionModal" class={`modal ${actionModal.open ? 'is-active' : ''}`.trim()}>
    <button type="button" class="modal-background" aria-label="Close dialog" on:click={closeActionModal}></button>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">{actionModal.title}</p>
      </header>
      <section class="modal-card-body">
        <p class="mb-3">{actionModal.text}</p>
        <div class={`field ${actionModal.titleFieldVisible ? '' : 'is-hidden'}`.trim()}>
          <label class="label" for="groupActionModalTitleInput">{actionModal.titleLabel}</label>
          <input id="groupActionModalTitleInput" class="input" type="text" maxlength="80" placeholder={actionModal.titlePlaceholder} bind:value={actionModal.titleValue} on:keydown={(e)=> { if (e.key === 'Enter') { e.preventDefault(); confirmActionModal().catch((err) => { console.error(err); showMessage('Action failed.', 'is-danger'); }); } }} />
        </div>
      </section>
      <footer class="modal-card-foot is-justify-content-flex-end">
        <div class="buttons">
          <button class="button" type="button" on:click={closeActionModal}>Cancel</button>
          <button class={`button ${actionModal.confirmTone}`.trim()} type="button" on:click={() => confirmActionModal().catch((err) => { console.error(err); showMessage('Action failed.', 'is-danger'); })}>{actionModal.confirmLabel}</button>
        </div>
      </footer>
    </div>
  </div>
{/if}
