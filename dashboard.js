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
    const text = (value || "").toString().trim();
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : "";
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

  function pickHighContrastColor(value) {
    return isHexColorDark(value) ? "#f8fafc" : "#0f172a";
  }

  function hexColorToRgba(value, alpha) {
    const rgb = hexColorToRgb(value) || { r: 248, g: 250, b: 252 };
    const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
  }

  function applyNavActionTabContrastTheme(surfaceColor) {
    const navBg = pickHighContrastColor(surfaceColor);
    const navText = pickHighContrastColor(navBg);
    document.documentElement.style.setProperty("--dashboard-nav-tab-bg", navBg);
    document.documentElement.style.setProperty("--dashboard-nav-tab-text", navText);
    document.documentElement.style.setProperty("--dashboard-nav-tab-hover-bg", hexColorToRgba(navBg, 0.86));
    document.documentElement.style.setProperty("--dashboard-nav-tab-hover-text", navText);
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
    const wrapper = document.createElement("div");
    wrapper.className = "mode-switch dashboard-link-mode nav-edit-mode-toggle";
    wrapper.setAttribute("aria-label", "Edit");
    wrapper.tabIndex = 0;

    const labelText = document.createElement("span");
    labelText.className = "mode-switch-label";
    labelText.textContent = "Edit";

    const switchLabel = document.createElement("label");
    switchLabel.className = "ios-switch";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(isChecked);
    input.setAttribute("aria-label", "Toggle Edit");

    const slider = document.createElement("span");
    slider.className = "ios-switch-slider";

    const triggerToggle = (nextChecked) => {
      input.checked = Boolean(nextChecked);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    input.addEventListener("change", (event) => {
      if (typeof onToggle === "function") {
        onToggle(Boolean(event.target && event.target.checked));
      }
    });

    wrapper.addEventListener("click", (event) => {
      const clickedInsideSwitch =
        event.target && typeof event.target.closest === "function" && event.target.closest(".ios-switch");
      if (clickedInsideSwitch) {
        return;
      }
      event.preventDefault();
      triggerToggle(!input.checked);
    });
    wrapper.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      triggerToggle(!input.checked);
    });

    switchLabel.appendChild(input);
    switchLabel.appendChild(slider);
    wrapper.appendChild(labelText);
    wrapper.appendChild(switchLabel);
    return wrapper;
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

    const overflowing = dashboardTabListEl.scrollWidth > dashboardTabsRowEl.clientWidth + 1;
    dashboardTabsRowEl.classList.toggle("tabs-overflowing", overflowing);

    const editToggle = ensureDashboardEditToggle();
    if (overflowing) {
      if (toolbarModeActionsEl) {
        toolbarModeActionsEl.appendChild(editToggle);
      }
    } else if (dashboardTabActionsEl) {
      dashboardTabActionsEl.appendChild(editToggle);
    }

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
    const pageColor = normalizeHexColor(dashboard && dashboard.backgroundColor);
    const groupColor = normalizeHexColor(dashboard && dashboard.groupBackgroundColor);
    const textColor = normalizeHexColor(dashboard && dashboard.textColor);
    const buttonTextColor = normalizeHexColor(dashboard && dashboard.buttonTextColor);
    const tabColor = normalizeHexColor(dashboard && dashboard.tabColor);
    const activeTabColor = normalizeHexColor(dashboard && dashboard.activeTabColor);
    const tabTextColor = normalizeHexColor(dashboard && dashboard.tabTextColor);
    const activeTabTextColor = normalizeHexColor(dashboard && dashboard.activeTabTextColor);
    const navSurfaceColor = pageColor || "#0f172a";
    const pageSurfaceColor = pageColor || "#0f172a";
    const groupSurfaceColor = groupColor || "#111827";
    const flatGroupShell = pageSurfaceColor === groupSurfaceColor;

    document.documentElement.classList.toggle("dashboard-group-shell-flat", flatGroupShell);

    applyNavActionTabContrastTheme(navSurfaceColor);

    if (pageColor) {
      document.documentElement.style.setProperty("--dashboard-page-bg", pageColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-page-bg");
    }

    if (groupColor) {
      document.documentElement.style.setProperty("--dashboard-group-bg", groupColor);
      document.documentElement.style.setProperty("--dashboard-group-radius", "0.85rem");
    } else {
      document.documentElement.style.removeProperty("--dashboard-group-bg");
      document.documentElement.style.removeProperty("--dashboard-group-radius");
    }

    if (textColor) {
      document.documentElement.style.setProperty("--dashboard-text-color", textColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-text-color");
    }

    if (buttonTextColor) {
      document.documentElement.style.setProperty("--dashboard-button-text-color", buttonTextColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-button-text-color");
    }

    if (tabColor) {
      document.documentElement.style.setProperty("--dashboard-tab-bg", tabColor);
      document.documentElement.style.setProperty("--dashboard-tab-hover-bg", tabColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-tab-bg");
      document.documentElement.style.removeProperty("--dashboard-tab-hover-bg");
    }

    if (activeTabColor) {
      document.documentElement.style.setProperty("--dashboard-tab-active-bg", activeTabColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-tab-active-bg");
    }

    if (tabTextColor) {
      document.documentElement.style.setProperty("--dashboard-tab-text", tabTextColor);
      document.documentElement.style.setProperty("--dashboard-tab-hover-text", tabTextColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-tab-text");
      document.documentElement.style.removeProperty("--dashboard-tab-hover-text");
    }

    if (activeTabTextColor) {
      document.documentElement.style.setProperty("--dashboard-tab-active-text", activeTabTextColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-tab-active-text");
    }
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

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(updateDashboardTabsOverflowLayout);
    } else {
      updateDashboardTabsOverflowLayout();
    }
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
    contentEl.innerHTML = "";

    const dashboard = getActiveDashboard();
    applyDashboardTheme(dashboard);
    if (!dashboard || !dashboard.groups.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No groups configured yet. Open the Admin Panel to add one.";
      contentEl.appendChild(empty);
      return;
    }

    let colorIndex = 0;

    dashboard.groups.forEach((group) => {
      const section = document.createElement("section");
      section.className = `group-box${group.groupEnd ? " group-end" : ""}`;

      const title = document.createElement("h2");
      title.className = "title is-6 group-title";
      title.textContent = group.title || "Untitled Group";
      section.appendChild(title);

      const columns = document.createElement("div");
      columns.className = "columns is-mobile is-multiline entry-grid";

      group.entries.forEach((buttonEntry) => {
        const effectiveMode =
          dashboard && dashboard.enableInternalLinks && currentLinkMode === "internal" ? "internal" : "external";

        const link =
          buttonEntry &&
          buttonEntry.links &&
          typeof buttonEntry.links[effectiveMode] === "string"
            ? buttonEntry.links[effectiveMode].trim()
            : "";
        const resolvedHref = effectiveMode === "external" ? DashboardCommon.normalizeExternalLinkHref(link) : link;

        const color = DashboardCommon.getButtonColorPair(dashboard, group, colorIndex);
        colorIndex += 1;

        const column = document.createElement("div");
        column.className = "column is-half-mobile is-one-third-tablet is-one-quarter-desktop";

        const button = document.createElement("a");
        button.className = "button is-fullwidth entry-button";
        button.href = resolvedHref || "#";
        button.target = "_blank";
        button.rel = "noopener noreferrer";
        button.style.backgroundColor = color.base;

        button.addEventListener("mouseenter", () => {
          button.style.backgroundColor = color.hover;
        });

        button.addEventListener("mouseleave", () => {
          button.style.backgroundColor = color.base;
        });

        if (!resolvedHref) {
          button.classList.add("is-static");
          button.removeAttribute("target");
          button.removeAttribute("rel");
          button.addEventListener("click", (event) => {
            event.preventDefault();
          });
        }

        const iconSpan = document.createElement("span");
        iconSpan.className = "icon entry-icon";
        const iconSrc = getIconSource(buttonEntry);
        if (iconSrc) {
          const iconImg = document.createElement("img");
          iconImg.src = iconSrc;
          iconImg.alt = `${buttonEntry.name} icon`;
          iconSpan.appendChild(iconImg);
        }

        const labelSpan = document.createElement("span");
        labelSpan.className = "entry-label";
        labelSpan.textContent = buttonEntry.name || "Unnamed";

        button.appendChild(iconSpan);
        button.appendChild(labelSpan);
        column.appendChild(button);
        columns.appendChild(column);
      });

      section.appendChild(columns);
      contentEl.appendChild(section);
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
