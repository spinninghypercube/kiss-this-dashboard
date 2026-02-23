(function () {
  "use strict";

  let config = { title: "KISS this dashboard", dashboards: [] };
  let currentDashboardId = "";
  let currentLinkMode = DashboardCommon.getLinkMode();

  const dashboardTabsWrapEl = document.getElementById("dashboardTabsWrap");
  const dashboardTabListEl = document.getElementById("dashboardTabList");
  const dashboardTabActionsEl = document.getElementById("dashboardTabActions");
  const dashboardTabsRowEl = dashboardTabsWrapEl ? dashboardTabsWrapEl.querySelector(".mode-tabs-row") : null;
  const toolbarModeRowEl = document.getElementById("toolbarModeRow");
  const toolbarModeActionsEl = document.getElementById("toolbarModeActions");
  const dashboardLinkModeSwitchEl = document.getElementById("dashboardLinkModeSwitch");
  const linkModeToggleEl = document.getElementById("linkModeToggle");
  const linkModeTextLabelEl = document.getElementById("linkModeTextLabel");
  const contentEl = document.getElementById("dashboardContent");
  let dashboardEditToggleEl = null;

  function normalizeLinkMode(mode) {
    return mode === "internal" ? "internal" : "external";
  }

  function normalizeHexColor(value) {
    return DashboardUI.normalizeHexColor(value);
  }

  function hexColorToRgb(value) {
    return DashboardUI.hexColorToRgb(value);
  }

  function srgbChannelToLinear(channel) {
    return DashboardUI.srgbChannelToLinear(channel);
  }

  function isHexColorDark(value) {
    return DashboardUI.isHexColorDark(value);
  }

  function pickHighContrastColor(value) {
    return DashboardUI.pickHighContrastColor(value);
  }

  function hexColorToRgba(value, alpha) {
    return DashboardUI.hexColorToRgba(value, alpha);
  }

  function applyNavActionTabContrastTheme(surfaceColor) {
    DashboardUI.applyNavActionTabContrastTheme(surfaceColor);
  }

  function redirectDashboardFallbackPaths() {
    const pathname = window.location.pathname || "/";
    const search = window.location.search || "";
    const hash = window.location.hash || "";

    if (pathname === "/edit" || pathname === "/edit/" || pathname === "/admin") {
      window.location.replace(`/edit.html${search}${hash}`);
      return true;
    }

    if (pathname === "/index.html" && window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(null, "", `/${search}${hash}`);
    }

    return false;
  }

  function createEditModeNavToggle(isChecked, onToggle) {
    return DashboardUI.createEditModeToggle(isChecked, onToggle);
  }

  function ensureDashboardEditToggle() {
    if (dashboardEditToggleEl) {
      return dashboardEditToggleEl;
    }
    dashboardEditToggleEl = createEditModeNavToggle(false, (checked) => {
      if (!checked) {
        return;
      }
      window.location.href = "/edit.html";
    });
    return dashboardEditToggleEl;
  }

  function updateToolbarModeRowVisibility() {
    if (!toolbarModeRowEl) {
      return;
    }
    const linkToggleVisible = Boolean(dashboardLinkModeSwitchEl && !dashboardLinkModeSwitchEl.classList.contains("is-hidden"));
    const hasActions = Boolean(toolbarModeActionsEl && toolbarModeActionsEl.childElementCount);
    toolbarModeRowEl.classList.toggle("is-hidden", !linkToggleVisible && !hasActions);
  }

  function updateDashboardTabsOverflowLayout() {
    if (!dashboardTabsRowEl || !dashboardTabListEl) {
      return;
    }
    DashboardUI.updateModeTabsOverflowLayout({
      tabsRowEl: dashboardTabsRowEl,
      tabsListEl: dashboardTabListEl,
      inlineActionsEl: dashboardTabActionsEl,
      overflowActionsEl: toolbarModeActionsEl,
      actionEl: ensureDashboardEditToggle(),
      fallbackActionWidth: 74
    });

    updateToolbarModeRowVisibility();
  }

  function getIconSource(buttonEntry) {
    if (buttonEntry.iconData) {
      return buttonEntry.iconData;
    }

    if (buttonEntry.icon) {
      return `icons/${buttonEntry.icon}`;
    }

    return "";
  }

  function applyPageTitle() {
    const title = (config.title || "").toString().trim() || "KISS this dashboard";
    document.title = title;
  }

  async function redirectToAdminSetupIfNeeded() {
    try {
      const status = await DashboardCommon.getAuthStatus();
      if (status && status.setupRequired) {
        window.location.replace("/edit?setup=1");
        return true;
      }
    } catch (error) {
      console.warn("Auth status check failed, continuing dashboard load.", error);
    }
    return false;
  }

  function getValidDashboardId(requestedId) {
    if (!config.dashboards.length) {
      return "";
    }

    if (requestedId && config.dashboards.some((dashboard) => dashboard.id === requestedId)) {
      return requestedId;
    }

    const savedId = DashboardCommon.getActiveDashboardId();
    if (savedId && config.dashboards.some((dashboard) => dashboard.id === savedId)) {
      return savedId;
    }

    return config.dashboards[0].id;
  }

  function getActiveDashboard() {
    return config.dashboards.find((dashboard) => dashboard.id === currentDashboardId) || null;
  }

  function applyDashboardTheme(dashboard) {
    DashboardUI.applyDashboardThemeCssVariables(dashboard, {
      flatClassName: "dashboard-group-shell-flat",
      groupRadius: "0.85rem",
      setGroupRadius: true,
      defaultPageColor: "#0f172a",
      defaultGroupColor: "#111827"
    });
  }

  function renderDashboardTabs() {
    dashboardTabListEl.innerHTML = "";
    if (dashboardTabActionsEl) {
      dashboardTabActionsEl.innerHTML = "";
    }
    if (toolbarModeActionsEl) {
      toolbarModeActionsEl.innerHTML = "";
    }
    const showDashboardTabs = config.dashboards.length > 1;

    if (showDashboardTabs) {
      config.dashboards.forEach((dashboard) => {
        const li = document.createElement("li");
        li.className = dashboard.id === currentDashboardId ? "is-active" : "";

        const link = document.createElement("a");
        link.href = "#";
        link.textContent = dashboard.label;
        link.setAttribute("role", "button");
        link.addEventListener("click", (event) => {
          event.preventDefault();
          setDashboard(dashboard.id);
        });

        li.appendChild(link);
        dashboardTabListEl.appendChild(li);
      });
    }

    ensureDashboardEditToggle();

    if (dashboardTabsWrapEl) {
      dashboardTabsWrapEl.classList.remove("is-hidden");
    }

    DashboardUI.scheduleModeTabsOverflowLayout(updateDashboardTabsOverflowLayout);
  }

  function renderLinkModeToggle() {
    const dashboard = getActiveDashboard();
    const internalEnabled = Boolean(dashboard && dashboard.enableInternalLinks);
    const showToggle = internalEnabled;
    if (dashboardLinkModeSwitchEl) {
      dashboardLinkModeSwitchEl.classList.toggle("is-hidden", !showToggle);
    }
    updateToolbarModeRowVisibility();
    const isInternal = currentLinkMode === "internal";
    linkModeToggleEl.checked = isInternal;
    if (linkModeTextLabelEl) {
      linkModeTextLabelEl.textContent = "use internal links";
    }
  }

  function renderContent() {
    const dashboard = getActiveDashboard();
    applyDashboardTheme(dashboard);
    DashboardUI.renderDashboardContent({
      containerEl: contentEl,
      dashboard,
      linkMode: currentLinkMode,
      getIconSource,
      emptyText: "No groups configured yet. Open the Admin Panel to add one."
    });
  }

  function setDashboard(dashboardId) {
    currentDashboardId = getValidDashboardId(dashboardId);
    if (!currentDashboardId) {
      return;
    }

    DashboardCommon.setActiveDashboardId(currentDashboardId);
    renderDashboardTabs();
    renderLinkModeToggle();
    renderContent();
  }

  function setLinkMode(mode) {
    currentLinkMode = normalizeLinkMode(mode);
    DashboardCommon.setLinkMode(currentLinkMode);
    renderLinkModeToggle();
    renderContent();
  }

  linkModeToggleEl.addEventListener("change", () => {
    setLinkMode(linkModeToggleEl.checked ? "internal" : "external");
  });

  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => {
      updateDashboardTabsOverflowLayout();
    });
  }

  async function init() {
    if (redirectDashboardFallbackPaths()) {
      return;
    }
    const redirected = await redirectToAdminSetupIfNeeded();
    if (redirected) {
      return;
    }
    config = await DashboardCommon.getConfig();
    applyPageTitle();
    renderLinkModeToggle();
    currentDashboardId = getValidDashboardId("");
    setDashboard(currentDashboardId);
  }

  init().catch((error) => {
    console.error(error);
    contentEl.innerHTML = "<div class=\"empty-state\">Failed to load dashboard config.</div>";
  });
})();
