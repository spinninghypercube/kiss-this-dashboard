(function () {
  "use strict";

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

  function setCssVariable(root, key, value) {
    if (!root) {
      return;
    }
    if (value) {
      root.style.setProperty(key, value);
      return;
    }
    root.style.removeProperty(key);
  }

  function applyNavActionTabContrastTheme(surfaceColor, root) {
    const targetRoot = root || document.documentElement;
    const navBg = pickHighContrastColor(surfaceColor);
    const navText = pickHighContrastColor(navBg);
    setCssVariable(targetRoot, "--dashboard-nav-tab-bg", navBg);
    setCssVariable(targetRoot, "--dashboard-nav-tab-text", navText);
    setCssVariable(targetRoot, "--dashboard-nav-tab-hover-bg", hexColorToRgba(navBg, 0.86));
    setCssVariable(targetRoot, "--dashboard-nav-tab-hover-text", navText);
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
    const navSurfaceColor = pageColor || (opts.defaultPageColor || "#0f172a");
    const pageSurfaceColor = pageColor || (opts.defaultPageColor || "#0f172a");
    const groupSurfaceColor = groupColor || (opts.defaultGroupColor || "#111827");
    const flatGroupShell = pageSurfaceColor === groupSurfaceColor;
    const flatClassName = opts.flatClassName || "";

    if (flatClassName && root && root.classList) {
      root.classList.toggle(flatClassName, flatGroupShell);
    }

    applyNavActionTabContrastTheme(navSurfaceColor, root);

    setCssVariable(root, "--dashboard-page-bg", pageColor);
    setCssVariable(root, "--dashboard-group-bg", groupColor);
    setCssVariable(root, "--dashboard-text-color", textColor);
    setCssVariable(root, "--dashboard-button-text-color", buttonTextColor);

    if (groupColor && opts.setGroupRadius !== false) {
      setCssVariable(root, "--dashboard-group-radius", opts.groupRadius || "0.85rem");
    } else if (opts.setGroupRadius !== false) {
      setCssVariable(root, "--dashboard-group-radius", "");
    }

    if (tabColor) {
      setCssVariable(root, "--dashboard-tab-bg", tabColor);
      setCssVariable(root, "--dashboard-tab-hover-bg", tabColor);
    } else {
      setCssVariable(root, "--dashboard-tab-bg", "");
      setCssVariable(root, "--dashboard-tab-hover-bg", "");
    }

    setCssVariable(root, "--dashboard-tab-active-bg", activeTabColor);

    if (tabTextColor) {
      setCssVariable(root, "--dashboard-tab-text", tabTextColor);
      setCssVariable(root, "--dashboard-tab-hover-text", tabTextColor);
    } else {
      setCssVariable(root, "--dashboard-tab-text", "");
      setCssVariable(root, "--dashboard-tab-hover-text", "");
    }

    setCssVariable(root, "--dashboard-tab-active-text", activeTabTextColor);

    return {
      pageColor: pageSurfaceColor,
      groupColor: groupSurfaceColor,
      flatGroupShell,
      textColor: textColor || "",
      buttonTextColor: buttonTextColor || ""
    };
  }

  function createModeSwitchToggle(options) {
    const opts = options || {};
    const wrapper = document.createElement("div");
    wrapper.className = (opts.wrapperClassName || "mode-switch").trim();
    wrapper.setAttribute("aria-label", (opts.label || "Toggle").toString());
    wrapper.tabIndex = 0;

    const labelText = document.createElement("span");
    labelText.className = "mode-switch-label";
    labelText.textContent = (opts.label || "").toString();

    const switchLabel = document.createElement("label");
    switchLabel.className = "ios-switch";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(opts.checked);
    input.setAttribute("aria-label", (opts.inputAriaLabel || opts.label || "Toggle").toString());

    const slider = document.createElement("span");
    slider.className = "ios-switch-slider";

    const triggerToggle = (nextChecked) => {
      input.checked = Boolean(nextChecked);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    input.addEventListener("change", (event) => {
      if (typeof opts.onToggle === "function") {
        opts.onToggle(Boolean(event.target && event.target.checked));
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
    wrapper._modeSwitchInput = input;
    return wrapper;
  }

  function createEditModeToggle(isChecked, onToggle) {
    return createModeSwitchToggle({
      checked: isChecked,
      label: "Edit",
      inputAriaLabel: "Toggle Edit",
      wrapperClassName: "mode-switch dashboard-link-mode nav-edit-mode-toggle",
      onToggle
    });
  }

  function measureElementWidth(el, fallback) {
    if (!el) {
      return Number(fallback) || 0;
    }
    const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
    const width = rect && Number.isFinite(rect.width) ? rect.width : 0;
    if (width > 0) {
      if (el.dataset) {
        el.dataset.lastMeasuredWidth = String(width);
      }
      return width;
    }
    const cached = el.dataset ? Number(el.dataset.lastMeasuredWidth) : 0;
    if (cached > 0) {
      return cached;
    }
    return Number(fallback) || 0;
  }

  function measureInlineActionsWidth(inlineActionsEl, actionEl, fallbackActionWidth) {
    if (!inlineActionsEl || !actionEl) {
      return 0;
    }

    const actionWidth = measureElementWidth(actionEl, fallbackActionWidth || 72);
    let padding = 0;
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      const styles = window.getComputedStyle(inlineActionsEl);
      padding += parseFloat(styles.paddingLeft || "0") || 0;
      padding += parseFloat(styles.paddingRight || "0") || 0;
      padding += parseFloat(styles.columnGap || styles.gap || "0") || 0;
    }
    return actionWidth + padding;
  }

  function updateModeTabsOverflowLayout(options) {
    const opts = options || {};
    const tabsRowEl = opts.tabsRowEl;
    const tabsListEl = opts.tabsListEl;
    const actionEl = opts.actionEl;
    const inlineActionsEl = opts.inlineActionsEl;
    const overflowActionsEl = opts.overflowActionsEl;

    if (!tabsRowEl || !tabsListEl) {
      return false;
    }

    const rowWidth = tabsRowEl.clientWidth || 0;
    const tabsWidth = tabsListEl.scrollWidth || 0;
    const inlineActionWidth = actionEl ? measureInlineActionsWidth(inlineActionsEl, actionEl, opts.fallbackActionWidth) : 0;
    const fitsInline = tabsWidth <= rowWidth - inlineActionWidth + 1;
    const overflowing = !fitsInline;

    tabsRowEl.classList.toggle("tabs-overflowing", overflowing);

    if (actionEl) {
      if (overflowing && overflowActionsEl) {
        overflowActionsEl.appendChild(actionEl);
      } else if (inlineActionsEl) {
        inlineActionsEl.appendChild(actionEl);
      }
    }

    if (typeof opts.onLayout === "function") {
      opts.onLayout({ overflowing, fitsInline, rowWidth, tabsWidth, inlineActionWidth });
    }

    return overflowing;
  }

  function scheduleModeTabsOverflowLayout(fn) {
    if (typeof fn !== "function") {
      return;
    }
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(fn);
      return;
    }
    fn();
  }

  function renderDashboardContent(options) {
    const opts = options || {};
    const containerEl = opts.containerEl;
    if (!containerEl) {
      return;
    }

    const dashboard = opts.dashboard || null;
    const currentLinkMode = opts.linkMode === "internal" ? "internal" : "external";
    const getIconSource = typeof opts.getIconSource === "function" ? opts.getIconSource : () => "";
    const emptyText = (opts.emptyText || "No groups configured yet.").toString();

    containerEl.innerHTML = "";

    if (!dashboard || !Array.isArray(dashboard.groups) || !dashboard.groups.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = emptyText;
      containerEl.appendChild(empty);
      return;
    }

    let colorIndex = 0;

    dashboard.groups.forEach((group) => {
      const section = document.createElement("section");
      section.className = `group-box${group && group.groupEnd ? " group-end" : ""}`;

      const title = document.createElement("h2");
      title.className = "title is-6 group-title";
      title.textContent = (group && group.title) || "Untitled Group";
      section.appendChild(title);

      const columns = document.createElement("div");
      columns.className = "columns is-mobile is-multiline entry-grid";

      const entries = Array.isArray(group && group.entries) ? group.entries : [];
      entries.forEach((buttonEntry) => {
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
          iconImg.alt = `${(buttonEntry && buttonEntry.name) || "Button"} icon`;
          iconSpan.appendChild(iconImg);
        }

        const labelSpan = document.createElement("span");
        labelSpan.className = "entry-label";
        labelSpan.textContent = (buttonEntry && buttonEntry.name) || "Unnamed";

        button.appendChild(iconSpan);
        button.appendChild(labelSpan);
        column.appendChild(button);
        columns.appendChild(column);
      });

      section.appendChild(columns);
      containerEl.appendChild(section);
    });
  }

  window.DashboardUI = {
    normalizeHexColor,
    hexColorToRgb,
    srgbChannelToLinear,
    isHexColorDark,
    pickHighContrastColor,
    hexColorToRgba,
    applyNavActionTabContrastTheme,
    applyDashboardThemeCssVariables,
    createModeSwitchToggle,
    createEditModeToggle,
    updateModeTabsOverflowLayout,
    scheduleModeTabsOverflowLayout,
    renderDashboardContent
  };
})();
