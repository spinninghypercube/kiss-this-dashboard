(function () {
  "use strict";

  let config = { title: "KISS this dashboard", dashboards: [] };
  let previewMode = DashboardCommon.getLinkMode();
  let activeDashboardId = DashboardCommon.getActiveDashboardId();
  let authUser = "";
  let authMustChangePassword = false;
  let authSetupRequired = false;
  let accountPaneOpen = false;
  let messageTimer = null;
  const DEFAULT_DASHBOARD_BG_COLOR = "#0f172a";
  const DEFAULT_GROUP_BOX_BG_COLOR = "#111827";
  const DEFAULT_PAGE_TEXT_COLOR = "#f8fafc";
  const DEFAULT_BUTTON_TEXT_COLOR = "#0f172a";
  const DEFAULT_TAB_COLOR = "#1e293b";
  const DEFAULT_ACTIVE_TAB_COLOR = "#2563eb";
  const DEFAULT_TAB_TEXT_COLOR = "#cbd5e1";
  const DEFAULT_ACTIVE_TAB_TEXT_COLOR = "#ffffff";
  const DEFAULT_THEME_COLOR_VALUES = {
    backgroundColor: DEFAULT_DASHBOARD_BG_COLOR,
    groupBackgroundColor: DEFAULT_GROUP_BOX_BG_COLOR,
    textColor: DEFAULT_PAGE_TEXT_COLOR,
    buttonTextColor: DEFAULT_BUTTON_TEXT_COLOR,
    tabColor: DEFAULT_TAB_COLOR,
    activeTabColor: DEFAULT_ACTIVE_TAB_COLOR,
    tabTextColor: DEFAULT_TAB_TEXT_COLOR,
    activeTabTextColor: DEFAULT_ACTIVE_TAB_TEXT_COLOR
  };
  const DEFAULT_BUTTON_COLOR_OPTIONS = DashboardCommon.getDefaultButtonColorOptions();
  const BUILT_IN_THEME_PRESETS = [
    {
      id: "builtin-default-theme",
      name: "Default Theme",
      theme: {
        backgroundColor: "#101728",
        groupBackgroundColor: "#172644",
        textColor: "#f8fafc",
        buttonTextColor: "#0f172a",
        tabColor: "#1e293b",
        activeTabColor: "#2563eb",
        tabTextColor: "#cbd5e1",
        activeTabTextColor: "#ffffff",
        buttonColorMode: "cycle-custom",
        buttonCycleHueStep: 15,
        buttonCycleSaturation: 70,
        buttonCycleLightness: 74,
        buttonSolidColor: "#93c5fd"
      }
    },
    {
      id: "builtin-paper-ink",
      name: "Paper & Ink",
      theme: {
        backgroundColor: "#f8fafc",
        groupBackgroundColor: "#e2e8f0",
        textColor: "#0f172a",
        buttonTextColor: "#ffffff",
        tabColor: "#cbd5e1",
        activeTabColor: "#0f172a",
        tabTextColor: "#0f172a",
        activeTabTextColor: "#f8fafc",
        buttonColorMode: "solid-all",
        buttonCycleHueStep: 15,
        buttonCycleSaturation: 70,
        buttonCycleLightness: 74,
        buttonSolidColor: "#0f172a"
      }
    },
    {
      id: "builtin-forest-terminal",
      name: "Forest Terminal",
      theme: {
        backgroundColor: "#071a12",
        groupBackgroundColor: "#0d261d",
        textColor: "#d1fae5",
        buttonTextColor: "#062f23",
        tabColor: "#14532d",
        activeTabColor: "#10b981",
        tabTextColor: "#d1fae5",
        activeTabTextColor: "#052e22",
        buttonColorMode: "cycle-custom",
        buttonCycleHueStep: 11,
        buttonCycleSaturation: 66,
        buttonCycleLightness: 64,
        buttonSolidColor: "#34d399"
      }
    },
    {
      id: "builtin-sunset-control",
      name: "Sunset Control",
      theme: {
        backgroundColor: "#1f1027",
        groupBackgroundColor: "#2c1637",
        textColor: "#fae8ff",
        buttonTextColor: "#240f2d",
        tabColor: "#4a1d5d",
        activeTabColor: "#f97316",
        tabTextColor: "#f5d0fe",
        activeTabTextColor: "#1f0a04",
        buttonColorMode: "cycle-custom",
        buttonCycleHueStep: 18,
        buttonCycleSaturation: 85,
        buttonCycleLightness: 68,
        buttonSolidColor: "#fb923c"
      }
    },
    {
      id: "builtin-calm-blueprint",
      name: "Calm Blueprint",
      theme: {
        backgroundColor: "#0b1324",
        groupBackgroundColor: "#12203a",
        textColor: "#dbeafe",
        buttonTextColor: "#082f49",
        tabColor: "#1d4ed8",
        activeTabColor: "#38bdf8",
        tabTextColor: "#dbeafe",
        activeTabTextColor: "#082f49",
        buttonColorMode: "solid-all",
        buttonCycleHueStep: 15,
        buttonCycleSaturation: 70,
        buttonCycleLightness: 74,
        buttonSolidColor: "#7dd3fc"
      }
    }
  ];

  const buttonModalState = {
    dashboardId: "",
    sourceGroupId: "",
    buttonId: "",
    isNew: false,
    modalIconData: "",
    iconSearchSeq: 0,
    iconSearchDebounceTimer: 0
  };

  const actionModalState = {
    mode: "",
    dashboardId: "",
    groupId: "",
    buttonId: ""
  };
  let activePointerSort = null;

  const loginView = document.getElementById("loginView");
  const adminView = document.getElementById("adminView");
  const messageBox = document.getElementById("messageBox");
  const loginViewTitle = document.getElementById("loginViewTitle");
  const loginViewIntro = document.getElementById("loginViewIntro");

  const loginForm = document.getElementById("loginForm");
  const loginUsername = document.getElementById("loginUsername");
  const loginPassword = document.getElementById("loginPassword");
  const bootstrapForm = document.getElementById("bootstrapForm");
  const bootstrapUsername = document.getElementById("bootstrapUsername");
  const bootstrapPassword = document.getElementById("bootstrapPassword");
  const bootstrapConfirmPassword = document.getElementById("bootstrapConfirmPassword");
  const logoutBtn = document.getElementById("logoutBtn");

  const mainTabsList = document.getElementById("mainTabsList");
  const editorPane = document.getElementById("editorPane");
  const accountPane = document.getElementById("accountPane");
  const accountLinkBtn = document.getElementById("accountLinkBtn");
  const accountCloseBtn = document.getElementById("accountCloseBtn");
  const deleteDashboardBtn = document.getElementById("deleteDashboardBtn");
  const resetStarterConfigBtn = document.getElementById("resetStarterConfigBtn");
  const usernameForm = document.getElementById("usernameForm");
  const currentUsernameInput = document.getElementById("currentUsername");
  const newUsernameInput = document.getElementById("newUsername");
  const usernameCurrentPasswordInput = document.getElementById("usernameCurrentPassword");

  const previewModeToggle = document.getElementById("previewModeToggle");
  const previewModeExternalLabel = document.getElementById("previewModeExternalLabel");
  const previewModeInternalLabel = document.getElementById("previewModeInternalLabel");

  const addGroupBtn = document.getElementById("addGroupBtn");
  const groupsEditor = document.getElementById("groupsEditor");
  const pageTitleInput = document.getElementById("pageTitleInput");
  const liveColorEditorToggleBtn = document.getElementById("liveColorEditorToggleBtn");
  const liveColorEditorPanel = document.getElementById("liveColorEditorPanel");
  const resetThemeColorsBtn = document.getElementById("resetThemeColorsBtn");
  const themePresetSelect = document.getElementById("themePresetSelect");
  const themePresetPreviewBtn = document.getElementById("themePresetPreviewBtn");
  const themePresetApplyBtn = document.getElementById("themePresetApplyBtn");
  const themePresetDeleteControl = document.getElementById("themePresetDeleteControl");
  const themePresetDeleteBtn = document.getElementById("themePresetDeleteBtn");
  const themePresetNameInput = document.getElementById("themePresetNameInput");
  const themePresetSaveBtn = document.getElementById("themePresetSaveBtn");
  const enableInternalLinksCheckbox = document.getElementById("enableInternalLinksCheckbox");
  const showLinkToggleCheckbox = document.getElementById("showLinkToggleCheckbox");
  const showLinkToggleField = document.getElementById("showLinkToggleField");
  const buttonColorModeSelect = document.getElementById("buttonColorModeSelect");
  const buttonColorCycleCustomFields = document.getElementById("buttonColorCycleCustomFields");
  const buttonColorSolidAllFields = document.getElementById("buttonColorSolidAllFields");
  const buttonColorPerGroupHint = document.getElementById("buttonColorPerGroupHint");
  const buttonCycleHueStepInput = document.getElementById("buttonCycleHueStepInput");
  const buttonCycleSaturationInput = document.getElementById("buttonCycleSaturationInput");
  const buttonCycleLightnessInput = document.getElementById("buttonCycleLightnessInput");
  const buttonSolidColorInput = document.getElementById("buttonSolidColorInput");
  const buttonSolidColorCodeInput = document.getElementById("buttonSolidColorCodeInput");
  const buttonSolidColorSwatch = document.getElementById("buttonSolidColorSwatch");
  const buttonSolidColorPasteBtn = document.getElementById("buttonSolidColorPasteBtn");
  const dashboardBgColorInput = document.getElementById("dashboardBgColorInput");
  const dashboardBgColorCodeInput = document.getElementById("dashboardBgColorCodeInput");
  const groupBgColorInput = document.getElementById("groupBgColorInput");
  const groupBgColorCodeInput = document.getElementById("groupBgColorCodeInput");
  const pageTextColorInput = document.getElementById("pageTextColorInput");
  const pageTextColorCodeInput = document.getElementById("pageTextColorCodeInput");
  const buttonTextColorInput = document.getElementById("buttonTextColorInput");
  const buttonTextColorCodeInput = document.getElementById("buttonTextColorCodeInput");
  const tabColorInput = document.getElementById("tabColorInput");
  const tabColorCodeInput = document.getElementById("tabColorCodeInput");
  const activeTabColorInput = document.getElementById("activeTabColorInput");
  const activeTabColorCodeInput = document.getElementById("activeTabColorCodeInput");
  const tabTextColorInput = document.getElementById("tabTextColorInput");
  const tabTextColorCodeInput = document.getElementById("tabTextColorCodeInput");
  const activeTabTextColorInput = document.getElementById("activeTabTextColorInput");
  const activeTabTextColorCodeInput = document.getElementById("activeTabTextColorCodeInput");
  const dashboardBgColorSwatch = document.getElementById("dashboardBgColorSwatch");
  const groupBgColorSwatch = document.getElementById("groupBgColorSwatch");
  const pageTextColorSwatch = document.getElementById("pageTextColorSwatch");
  const buttonTextColorSwatch = document.getElementById("buttonTextColorSwatch");
  const tabColorSwatch = document.getElementById("tabColorSwatch");
  const activeTabColorSwatch = document.getElementById("activeTabColorSwatch");
  const tabTextColorSwatch = document.getElementById("tabTextColorSwatch");
  const activeTabTextColorSwatch = document.getElementById("activeTabTextColorSwatch");
  const dashboardBgColorPasteBtn = document.getElementById("dashboardBgColorPasteBtn");
  const groupBgColorPasteBtn = document.getElementById("groupBgColorPasteBtn");
  const pageTextColorPasteBtn = document.getElementById("pageTextColorPasteBtn");
  const buttonTextColorPasteBtn = document.getElementById("buttonTextColorPasteBtn");
  const tabColorPasteBtn = document.getElementById("tabColorPasteBtn");
  const activeTabColorPasteBtn = document.getElementById("activeTabColorPasteBtn");
  const tabTextColorPasteBtn = document.getElementById("tabTextColorPasteBtn");
  const activeTabTextColorPasteBtn = document.getElementById("activeTabTextColorPasteBtn");

  const passwordForm = document.getElementById("passwordForm");
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const firstRunSetupNotice = document.getElementById("firstRunSetupNotice");
  const accountSetupNotice = document.getElementById("accountSetupNotice");

  const entryModal = document.getElementById("entryModal");
  const entryModalTitle = document.getElementById("entryModalTitle");
  const entryNameInput = document.getElementById("entryNameInput");
  const entryIconInput = document.getElementById("entryIconInput");
  const entryIconFilenameColumn = document.getElementById("entryIconFilenameColumn");
  const entryIconUpload = document.getElementById("entryIconUpload");
  const entryClearIconData = document.getElementById("entryClearIconData");
  const entryIconSearchInput = document.getElementById("entryIconSearchInput");
  const entryIconSourceSelect = document.getElementById("entryIconSourceSelect");
  const entryIconSearchBtn = document.getElementById("entryIconSearchBtn");
  const entryIconSearchResults = document.getElementById("entryIconSearchResults");
  const entryIconSearchStatus = document.getElementById("entryIconSearchStatus");
  const entryExternalUrlInput = document.getElementById("entryExternalUrlInput");
  const entryInternalUrlInput = document.getElementById("entryInternalUrlInput");
  const entryExternalUrlColumn = document.getElementById("entryExternalUrlColumn");
  const entryInternalUrlColumn = document.getElementById("entryInternalUrlColumn");
  const entryUrlHelpText = document.getElementById("entryUrlHelpText");
  const entryExternalUrlPasteBtn = document.getElementById("entryExternalUrlPasteBtn");
  const entryInternalUrlPasteBtn = document.getElementById("entryInternalUrlPasteBtn");
  const entryIconPreview = document.getElementById("entryIconPreview");
  const entryDeleteBtn = document.getElementById("entryDeleteBtn");
  const entryCancelBtn = document.getElementById("entryCancelBtn");
  const entrySaveBtn = document.getElementById("entrySaveBtn");
  const entryCloseBtn = document.getElementById("entryCloseBtn");
  const entryIconInputHint = document.getElementById("entryIconInputHint");

  const groupActionModal = document.getElementById("groupActionModal");
  const groupActionModalTitle = document.getElementById("groupActionModalTitle");
  const groupActionModalText = document.getElementById("groupActionModalText");
  const groupActionTitleField = document.getElementById("groupActionTitleField");
  const groupActionTitleLabel = document.getElementById("groupActionTitleLabel");
  const groupActionTitleInput = document.getElementById("groupActionTitleInput");
  const groupActionCancelBtn = document.getElementById("groupActionCancelBtn");
  const groupActionConfirmBtn = document.getElementById("groupActionConfirmBtn");

  const themeColorControls = [
    {
      key: "backgroundColor",
      pickerInput: dashboardBgColorInput,
      codeInput: dashboardBgColorCodeInput,
      swatchEl: dashboardBgColorSwatch,
      pasteBtn: dashboardBgColorPasteBtn,
      fallback: DEFAULT_DASHBOARD_BG_COLOR
    },
    {
      key: "groupBackgroundColor",
      pickerInput: groupBgColorInput,
      codeInput: groupBgColorCodeInput,
      swatchEl: groupBgColorSwatch,
      pasteBtn: groupBgColorPasteBtn,
      fallback: DEFAULT_GROUP_BOX_BG_COLOR
    },
    {
      key: "textColor",
      pickerInput: pageTextColorInput,
      codeInput: pageTextColorCodeInput,
      swatchEl: pageTextColorSwatch,
      pasteBtn: pageTextColorPasteBtn,
      fallback: DEFAULT_PAGE_TEXT_COLOR
    },
    {
      key: "buttonTextColor",
      pickerInput: buttonTextColorInput,
      codeInput: buttonTextColorCodeInput,
      swatchEl: buttonTextColorSwatch,
      pasteBtn: buttonTextColorPasteBtn,
      fallback: DEFAULT_BUTTON_TEXT_COLOR
    },
    {
      key: "tabColor",
      pickerInput: tabColorInput,
      codeInput: tabColorCodeInput,
      swatchEl: tabColorSwatch,
      pasteBtn: tabColorPasteBtn,
      fallback: DEFAULT_TAB_COLOR
    },
    {
      key: "activeTabColor",
      pickerInput: activeTabColorInput,
      codeInput: activeTabColorCodeInput,
      swatchEl: activeTabColorSwatch,
      pasteBtn: activeTabColorPasteBtn,
      fallback: DEFAULT_ACTIVE_TAB_COLOR
    },
    {
      key: "tabTextColor",
      pickerInput: tabTextColorInput,
      codeInput: tabTextColorCodeInput,
      swatchEl: tabTextColorSwatch,
      pasteBtn: tabTextColorPasteBtn,
      fallback: DEFAULT_TAB_TEXT_COLOR
    },
    {
      key: "activeTabTextColor",
      pickerInput: activeTabTextColorInput,
      codeInput: activeTabTextColorCodeInput,
      swatchEl: activeTabTextColorSwatch,
      pasteBtn: activeTabTextColorPasteBtn,
      fallback: DEFAULT_ACTIVE_TAB_TEXT_COLOR
    }
  ];
  const buttonSolidColorControl = {
    key: "buttonSolidColor",
    pickerInput: buttonSolidColorInput,
    codeInput: buttonSolidColorCodeInput,
    swatchEl: buttonSolidColorSwatch,
    pasteBtn: buttonSolidColorPasteBtn,
    fallback: DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor
  };

  function getThemeColorControl(key) {
    return themeColorControls.find((control) => control.key === key) || null;
  }

  function clampInteger(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(numeric)));
  }

  function getSelectedButtonColorMode() {
    return DashboardCommon.normalizeButtonColorMode(buttonColorModeSelect && buttonColorModeSelect.value);
  }

  function refreshButtonColorModeControlsUI() {
    const mode = getSelectedButtonColorMode();
    if (buttonColorCycleCustomFields) {
      buttonColorCycleCustomFields.classList.toggle("is-hidden", mode !== "cycle-custom");
    }
    if (buttonColorSolidAllFields) {
      buttonColorSolidAllFields.classList.toggle("is-hidden", mode !== "solid-all");
    }
    if (buttonColorPerGroupHint) {
      buttonColorPerGroupHint.classList.toggle("is-hidden", mode !== "solid-per-group");
    }
  }

  function setButtonColorControlsFromDashboard(dashboard) {
    const defaults = DEFAULT_BUTTON_COLOR_OPTIONS;
    const mode = DashboardCommon.normalizeButtonColorMode(dashboard && dashboard.buttonColorMode);
    if (buttonColorModeSelect) {
      buttonColorModeSelect.value = mode;
    }
    if (buttonCycleHueStepInput) {
      buttonCycleHueStepInput.value = clampInteger(
        dashboard && dashboard.buttonCycleHueStep,
        1,
        180,
        defaults.buttonCycleHueStep
      );
    }
    if (buttonCycleSaturationInput) {
      buttonCycleSaturationInput.value = clampInteger(
        dashboard && dashboard.buttonCycleSaturation,
        0,
        100,
        defaults.buttonCycleSaturation
      );
    }
    if (buttonCycleLightnessInput) {
      buttonCycleLightnessInput.value = clampInteger(
        dashboard && dashboard.buttonCycleLightness,
        0,
        100,
        defaults.buttonCycleLightness
      );
    }
    setThemeColorControlValue(
      buttonSolidColorControl,
      normalizeHexColor(dashboard && dashboard.buttonSolidColor) || defaults.buttonSolidColor
    );
    refreshButtonColorModeControlsUI();
  }

  function readButtonColorSettingsFromControls() {
    const defaults = DEFAULT_BUTTON_COLOR_OPTIONS;
    return {
      buttonColorMode: getSelectedButtonColorMode(),
      buttonCycleHueStep: clampInteger(
        buttonCycleHueStepInput && buttonCycleHueStepInput.value,
        1,
        180,
        defaults.buttonCycleHueStep
      ),
      buttonCycleSaturation: clampInteger(
        buttonCycleSaturationInput && buttonCycleSaturationInput.value,
        0,
        100,
        defaults.buttonCycleSaturation
      ),
      buttonCycleLightness: clampInteger(
        buttonCycleLightnessInput && buttonCycleLightnessInput.value,
        0,
        100,
        defaults.buttonCycleLightness
      ),
      buttonSolidColor: readThemeColorControlValue(buttonSolidColorControl) || defaults.buttonSolidColor
    };
  }

  function getButtonColorPreviewDashboard(dashboard) {
    if (!dashboard) {
      return dashboard;
    }
    return {
      ...dashboard,
      ...readButtonColorSettingsFromControls()
    };
  }

  function showMessage(text, type = "is-success") {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
    messageBox.className = `notification ${type}`;
    messageBox.textContent = text;
    messageBox.classList.remove("is-hidden");
    messageTimer = setTimeout(() => {
      hideMessage();
    }, 2000);
  }

  function applyLoginViewMode() {
    if (loginViewTitle) {
      loginViewTitle.textContent = authSetupRequired ? "First-Time Setup" : "KISS this dashboard Admin";
    }
    if (loginViewIntro) {
      loginViewIntro.textContent = authSetupRequired
        ? "Create the first admin account for KISS this dashboard."
        : "Log in to manage your dashboard.";
    }
    if (loginForm) {
      loginForm.classList.toggle("is-hidden", authSetupRequired);
    }
    if (bootstrapForm) {
      bootstrapForm.classList.toggle("is-hidden", !authSetupRequired);
    }
  }

  function hideMessage() {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
    messageBox.className = "notification is-hidden";
    messageBox.textContent = "";
  }

  function syncCurrentUsernameField() {
    currentUsernameInput.value = authUser || "admin";
  }

  function applyFirstRunSetupState() {
    if (firstRunSetupNotice) {
      firstRunSetupNotice.classList.toggle("is-hidden", !authMustChangePassword);
    }
    if (accountSetupNotice) {
      accountSetupNotice.classList.toggle("is-hidden", !authMustChangePassword);
    }
    if (accountLinkBtn) {
      if (authMustChangePassword) {
        accountLinkBtn.classList.add("is-warning");
        accountLinkBtn.classList.remove("is-link");
      } else {
        accountLinkBtn.classList.remove("is-warning");
        accountLinkBtn.classList.add("is-link");
      }
    }
  }

  function setAccountPaneOpen(isOpen) {
    accountPaneOpen = Boolean(isOpen);
    accountPane.classList.toggle("is-active", accountPaneOpen);
    if (authMustChangePassword) {
      accountLinkBtn.textContent = accountPaneOpen ? "Close Setup" : "Finish Setup";
    } else {
      accountLinkBtn.textContent = accountPaneOpen ? "Close Account" : "Account";
    }
    syncCurrentUsernameField();
    applyFirstRunSetupState();
  }

  function setIconActionButton(button, toneClasses, iconText, label) {
    button.className = `button ${toneClasses} is-small icon-action`;
    button.textContent = iconText;
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  function createDragHandleSpan(className, label) {
    const handle = document.createElement("span");
    handle.className = `drag-handle ${className}`.trim();
    handle.textContent = "⋮⋮";
    handle.title = label;
    handle.setAttribute("aria-label", label);
    handle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    return handle;
  }

  function createDragHandleButton(className, label) {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = `drag-handle ${className}`.trim();
    handle.textContent = "⋮⋮";
    handle.title = label;
    handle.setAttribute("aria-label", label);
    handle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    return handle;
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

  function updateThemeEditorToggleButtonLabel() {
    if (!liveColorEditorToggleBtn || !liveColorEditorPanel) {
      return;
    }
    const isHidden = liveColorEditorPanel.classList.contains("is-hidden");
    liveColorEditorToggleBtn.textContent = isHidden ? "Show theme editor" : "Hide theme editor";
  }

  function normalizeEditorUrlBarPath() {
    if (!window.history || typeof window.history.replaceState !== "function") {
      return;
    }

    const pathname = window.location.pathname || "";
    if (pathname !== "/edit.html" && pathname !== "/admin.html") {
      return;
    }

    const search = window.location.search || "";
    const hash = window.location.hash || "";
    window.history.replaceState(null, "", `/edit${search}${hash}`);
  }

  function moveArrayItem(items, fromIndex, toIndex) {
    if (!Array.isArray(items)) {
      return false;
    }
    if (fromIndex === toIndex) {
      return false;
    }
    if (fromIndex < 0 || fromIndex >= items.length) {
      return false;
    }
    if (toIndex < 0 || toIndex >= items.length) {
      return false;
    }
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    return true;
  }

  function getSortableChildIndex(container, markerEl, itemSelector) {
    let index = 0;
    for (let cursor = container.firstElementChild; cursor; cursor = cursor.nextElementSibling) {
      if (cursor === markerEl) {
        return index;
      }
      if (
        typeof cursor.matches === "function" &&
        cursor.matches(itemSelector) &&
        !cursor.classList.contains("sortable-placeholder")
      ) {
        index += 1;
      }
    }
    return index;
  }

  function getSortableEndReference(container, options) {
    if (!container || !options || !options.endBeforeSelector) {
      return null;
    }
    return container.querySelector(options.endBeforeSelector);
  }

  function findPointerSortCrossContainer(state, probeX, probeY) {
    if (!state || !state.options || !state.options.crossContainerSelector) {
      return null;
    }

    const { crossContainerSelector, itemSelector, handleSelector } = state.options;
    const points =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(probeX, probeY)
        : [document.elementFromPoint(probeX, probeY)];

    for (const node of points) {
      if (!node || typeof node.closest !== "function") {
        continue;
      }
      const container = node.closest(crossContainerSelector);
      if (!container) {
        continue;
      }
      const containerOptions = container.__kissPointerSortableOptions;
      if (!containerOptions) {
        continue;
      }
      if (containerOptions.itemSelector !== itemSelector || containerOptions.handleSelector !== handleSelector) {
        continue;
      }
      return container;
    }

    return null;
  }

  function updatePointerSortFloatingPosition(state, clientX, clientY) {
    if (!state || !state.started || !state.item) {
      return;
    }
    const nextLeft = clientX - state.pointerOffsetX;
    const nextTop = clientY - state.pointerOffsetY;
    state.item.style.transform = `translate(${Math.round(nextLeft)}px, ${Math.round(nextTop)}px)`;
  }

  function getAdjacentSortableSibling(node, itemSelector, direction) {
    let cursor = direction < 0 ? node.previousElementSibling : node.nextElementSibling;
    while (cursor) {
      if (
        typeof cursor.matches === "function" &&
        cursor.matches(itemSelector) &&
        !cursor.classList.contains("sortable-placeholder")
      ) {
        return cursor;
      }
      cursor = direction < 0 ? cursor.previousElementSibling : cursor.nextElementSibling;
    }
    return null;
  }

  function comparePointerToSortableItem(axis, clientX, clientY, rect) {
    const xCenter = rect.left + rect.width / 2;
    const yCenter = rect.top + rect.height / 2;
    const xDead = Math.max(8, Math.min(20, rect.width * 0.16));
    const yDead = Math.max(8, Math.min(20, rect.height * 0.18));

    if (axis === "vertical") {
      if (clientY < yCenter - yDead) {
        return -1;
      }
      if (clientY > yCenter + yDead) {
        return 1;
      }
      return 0;
    }

    if (axis === "horizontal") {
      if (clientX < xCenter - xDead) {
        return -1;
      }
      if (clientX > xCenter + xDead) {
        return 1;
      }
      return 0;
    }

    if (clientY < rect.top + yDead) {
      return -1;
    }
    if (clientY > rect.bottom - yDead) {
      return 1;
    }
    if (clientX < xCenter - xDead) {
      return -1;
    }
    if (clientX > xCenter + xDead) {
      return 1;
    }
    return 0;
  }

  function repositionPointerSortPlaceholder(state, clientX, clientY) {
    if (!state || !state.started || !state.placeholder || !state.container) {
      return;
    }

    const { options, placeholder } = state;
    let container = state.container;
    const itemSelector = options.itemSelector;
    const probeX =
      clientX + (typeof state.sortProbeOffsetX === "number" ? state.sortProbeOffsetX : 0);
    const probeY =
      clientY + (typeof state.sortProbeOffsetY === "number" ? state.sortProbeOffsetY : 0);
    const crossContainer = findPointerSortCrossContainer(state, probeX, probeY);
    if (crossContainer && crossContainer !== state.container) {
      state.container = crossContainer;
      container = crossContainer;
      if (placeholder.parentNode !== container) {
        const targetEndReference = getSortableEndReference(container, options);
        container.insertBefore(placeholder, targetEndReference);
      }
    }
    const previousX = typeof state.lastRepositionX === "number" ? state.lastRepositionX : clientX;
    const previousY = typeof state.lastRepositionY === "number" ? state.lastRepositionY : clientY;
    const deltaX = clientX - previousX;
    const deltaY = clientY - previousY;
    state.lastRepositionX = clientX;
    state.lastRepositionY = clientY;
    const axis = options.axis || "vertical";
    const containerRect = container.getBoundingClientRect();
    const withinBounds =
      probeX >= containerRect.left - 24 &&
      probeX <= containerRect.right + 24 &&
      probeY >= containerRect.top - 24 &&
      probeY <= containerRect.bottom + 24;

    if (!withinBounds) {
      return;
    }

    const firstItem = Array.from(container.querySelectorAll(itemSelector)).find(
      (itemEl) => itemEl !== placeholder && !itemEl.classList.contains("sortable-placeholder")
    );
    if (!firstItem) {
      const emptyEndReference = getSortableEndReference(container, options);
      if (placeholder.nextElementSibling !== emptyEndReference) {
        container.insertBefore(placeholder, emptyEndReference);
      }
      return;
    }

    if (axis === "vertical") {
      const firstRect = firstItem.getBoundingClientRect();
      if (probeY < firstRect.top + firstRect.height / 2) {
        if (placeholder !== firstItem.previousElementSibling) {
          container.insertBefore(placeholder, firstItem);
        }
        return;
      }
    }

    if (axis === "horizontal") {
      const firstRect = firstItem.getBoundingClientRect();
      if (probeX < firstRect.left + firstRect.width / 2) {
        if (placeholder !== firstItem.previousElementSibling) {
          container.insertBefore(placeholder, firstItem);
        }
        return;
      }
    }

    const endReference = getSortableEndReference(container, options);
    if (axis !== "horizontal" && axis !== "vertical" && probeY > containerRect.bottom - 18) {
      if (placeholder.nextElementSibling !== endReference) {
        container.insertBefore(placeholder, endReference);
      }
      return;
    }

    if (axis === "vertical" && probeY > containerRect.bottom - 18) {
      container.insertBefore(placeholder, endReference);
      return;
    }

    if (axis === "horizontal" && probeX > containerRect.right - 18) {
      container.insertBefore(placeholder, endReference);
      return;
    }

    const majorDelta =
      axis === "vertical"
        ? deltaY
        : axis === "horizontal"
          ? deltaX
          : Math.abs(deltaY) >= Math.abs(deltaX)
            ? deltaY
            : deltaX;
    const checkForwardFirst = majorDelta >= 0;

    for (let step = 0; step < 24; step += 1) {
      const prevItem = getAdjacentSortableSibling(placeholder, itemSelector, -1);
      const nextItem = getAdjacentSortableSibling(placeholder, itemSelector, 1);
      let moved = false;

      const tryMoveForward = () => {
        if (!nextItem) {
          return false;
        }
        const cmp = comparePointerToSortableItem(axis, probeX, probeY, nextItem.getBoundingClientRect());
        if (cmp > 0) {
          container.insertBefore(placeholder, nextItem.nextElementSibling);
          return true;
        }
        return false;
      };

      const tryMoveBackward = () => {
        if (!prevItem) {
          return false;
        }
        const cmp = comparePointerToSortableItem(axis, probeX, probeY, prevItem.getBoundingClientRect());
        if (cmp < 0) {
          container.insertBefore(placeholder, prevItem);
          return true;
        }
        return false;
      };

      if (checkForwardFirst) {
        moved = tryMoveForward() || tryMoveBackward();
      } else {
        moved = tryMoveBackward() || tryMoveForward();
      }

      if (!moved) {
        break;
      }
    }
  }

  function cleanupActivePointerSort(state) {
    if (!state) {
      return;
    }

    window.removeEventListener("pointermove", state.onPointerMove, true);
    window.removeEventListener("pointerup", state.onPointerUp, true);
    window.removeEventListener("pointercancel", state.onPointerCancel, true);

    if (state.handle && typeof state.handle.releasePointerCapture === "function") {
      try {
        if (state.handle.hasPointerCapture(state.pointerId)) {
          state.handle.releasePointerCapture(state.pointerId);
        }
      } catch (error) {
        // Ignore pointer capture cleanup errors on browsers that throw after DOM moves.
      }
    }

    if (state.placeholder && state.placeholder.parentNode) {
      state.placeholder.remove();
    }

    if (state.item) {
      state.item.classList.remove("sortable-floating");
      if (state.originalStyleAttr === null) {
        state.item.removeAttribute("style");
      } else {
        state.item.setAttribute("style", state.originalStyleAttr);
      }
    }

    document.body.classList.remove("sorting-active");
    if (activePointerSort === state) {
      activePointerSort = null;
    }
  }

  function finishPointerSort(state, clientX, clientY) {
    if (!state) {
      return;
    }

    if (!state.started) {
      cleanupActivePointerSort(state);
      return;
    }

    repositionPointerSortPlaceholder(state, clientX, clientY);
    const fromContainer = state.originContainer || state.container;
    const toContainer = state.container;
    const sameContainer = toContainer === fromContainer;
    const rawToIndex = getSortableChildIndex(toContainer, state.placeholder, state.options.itemSelector);
    const toIndex = sameContainer && rawToIndex > state.fromIndex ? rawToIndex - 1 : rawToIndex;

    toContainer.insertBefore(state.item, state.placeholder);
    const changed = sameContainer ? toIndex !== state.fromIndex : true;
    const onReorder = state.options && typeof state.options.onReorder === "function" ? state.options.onReorder : null;
    const onMoveBetweenContainers =
      state.options && typeof state.options.onMoveBetweenContainers === "function"
        ? state.options.onMoveBetweenContainers
        : null;

    cleanupActivePointerSort(state);

    if (!changed) {
      return;
    }

    const operation = sameContainer
      ? onReorder
        ? onReorder(state.fromIndex, toIndex)
        : null
      : onMoveBetweenContainers
        ? onMoveBetweenContainers(state.fromIndex, toIndex, {
            fromContainer,
            toContainer
          })
        : null;

    if (!operation) {
      renderEditor();
      return;
    }

    Promise.resolve(operation).catch((error) => {
      console.error(error);
      showMessage((state.options && state.options.errorMessage) || "Failed to reorder items.", "is-danger");
      renderEditor();
    });
  }

  function startPointerSort(state, event) {
    if (!state || state.started) {
      return;
    }

    const rect = state.item.getBoundingClientRect();
    state.started = true;
    state.pointerOffsetX = event.clientX - rect.left;
    state.pointerOffsetY = event.clientY - rect.top;
    state.sortProbeOffsetX = rect.width / 2 - state.pointerOffsetX;
    state.sortProbeOffsetY = rect.height / 2 - state.pointerOffsetY;

    const placeholder = state.item.cloneNode(true);
    placeholder.className = `${state.item.className} sortable-placeholder`.trim();
    placeholder.removeAttribute("id");
    if ((state.options && state.options.axis) !== "grid") {
      placeholder.style.width = `${Math.ceil(rect.width)}px`;
      placeholder.style.height = `${Math.ceil(rect.height)}px`;
      placeholder.style.margin = "0";
    } else {
      placeholder.style.minHeight = `${Math.ceil(rect.height)}px`;
    }
    placeholder.setAttribute("aria-hidden", "true");

    state.placeholder = placeholder;
    state.originalStyleAttr = state.item.getAttribute("style");
    state.container.insertBefore(placeholder, state.item);
    state.initialPlaceholderRect = placeholder.getBoundingClientRect();

    state.item.classList.add("sortable-floating");
    state.item.style.position = "fixed";
    state.item.style.left = "0";
    state.item.style.top = "0";
    state.item.style.margin = "0";
    state.item.style.width = `${Math.ceil(rect.width)}px`;
    state.item.style.height = `${Math.ceil(rect.height)}px`;
    state.item.style.zIndex = "9999";
    state.item.style.pointerEvents = "none";
    document.body.appendChild(state.item);
    document.body.classList.add("sorting-active");
    state.skipNextPlaceholderReposition = true;
    state.lastRepositionX = event.clientX;
    state.lastRepositionY = event.clientY;
    updatePointerSortFloatingPosition(state, event.clientX, event.clientY);
  }

  function bindPointerSortable(container, options) {
    if (!container) {
      return;
    }

    container.__kissPointerSortableOptions = options;
    if (container.__kissPointerSortableBound) {
      return;
    }

    container.__kissPointerSortableBound = true;
    container.addEventListener(
      "pointerdown",
      (event) => {
        const currentOptions = container.__kissPointerSortableOptions;
        if (!currentOptions || !currentOptions.itemSelector || !currentOptions.handleSelector) {
          return;
        }

        if (activePointerSort) {
          return;
        }

        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }

        const handle =
          event.target && typeof event.target.closest === "function"
            ? event.target.closest(currentOptions.handleSelector)
            : null;
        if (!handle || !container.contains(handle)) {
          return;
        }

        const item = handle.closest(currentOptions.itemSelector);
        if (!item || !container.contains(item)) {
          return;
        }

        const sortableItems = Array.from(container.querySelectorAll(currentOptions.itemSelector)).filter(
          (itemEl) => !itemEl.classList.contains("sortable-placeholder")
        );
        const fromIndex = sortableItems.indexOf(item);
        const canCrossContainer = Boolean(currentOptions.crossContainerSelector);
        if (fromIndex < 0 || sortableItems.length <= 0 || (!canCrossContainer && sortableItems.length <= 1)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const state = {
          container,
          originContainer: container,
          options: currentOptions,
          handle,
          item,
          pointerId: event.pointerId,
          started: false,
          fromIndex,
          startX: event.clientX,
          startY: event.clientY,
          placeholder: null,
          originalStyleAttr: null,
          pointerOffsetX: 0,
          pointerOffsetY: 0,
          onPointerMove: null,
          onPointerUp: null,
          onPointerCancel: null
        };

        state.onPointerMove = (moveEvent) => {
          if (moveEvent.pointerId !== state.pointerId) {
            return;
          }
          if (!state.started) {
            const dx = moveEvent.clientX - state.startX;
            const dy = moveEvent.clientY - state.startY;
            if (Math.hypot(dx, dy) < 6) {
              return;
            }
            startPointerSort(state, moveEvent);
          }
          moveEvent.preventDefault();
          updatePointerSortFloatingPosition(state, moveEvent.clientX, moveEvent.clientY);
          if (state.skipNextPlaceholderReposition) {
            state.skipNextPlaceholderReposition = false;
            return;
          }
          if (
            (state.options && state.options.axis) === "grid" &&
            state.initialPlaceholderRect &&
            !state.gridOriginSlotExited
          ) {
            const probeX =
              moveEvent.clientX +
              (typeof state.sortProbeOffsetX === "number" ? state.sortProbeOffsetX : 0);
            const probeY =
              moveEvent.clientY +
              (typeof state.sortProbeOffsetY === "number" ? state.sortProbeOffsetY : 0);
            const r = state.initialPlaceholderRect;
            const inset = 6;
            const stillInsideOriginSlot =
              probeX >= r.left + inset &&
              probeX <= r.right - inset &&
              probeY >= r.top + inset &&
              probeY <= r.bottom - inset;
            if (stillInsideOriginSlot) {
              return;
            }
            state.gridOriginSlotExited = true;
          }
          repositionPointerSortPlaceholder(state, moveEvent.clientX, moveEvent.clientY);
        };

        state.onPointerUp = (upEvent) => {
          if (upEvent.pointerId !== state.pointerId) {
            return;
          }
          upEvent.preventDefault();
          finishPointerSort(state, upEvent.clientX, upEvent.clientY);
        };

        state.onPointerCancel = (cancelEvent) => {
          if (cancelEvent.pointerId !== state.pointerId) {
            return;
          }
          cancelEvent.preventDefault();
          if (state.started && state.placeholder) {
            const restoreContainer = state.originContainer || state.container;
            if (state.placeholder.parentNode !== restoreContainer) {
              const restoreEndReference = getSortableEndReference(restoreContainer, state.options);
              restoreContainer.insertBefore(state.placeholder, restoreEndReference);
            }
            restoreContainer.insertBefore(state.item, state.placeholder);
          }
          cleanupActivePointerSort(state);
        };

        if (typeof handle.setPointerCapture === "function") {
          try {
            handle.setPointerCapture(event.pointerId);
          } catch (error) {
            // Pointer capture is optional and may fail for some element/browser combinations.
          }
        }

        activePointerSort = state;
        window.addEventListener("pointermove", state.onPointerMove, true);
        window.addEventListener("pointerup", state.onPointerUp, true);
        window.addEventListener("pointercancel", state.onPointerCancel, true);
      },
      true
    );
  }

  function iconSource(buttonEntry) {
    if (buttonEntry.iconData) {
      return buttonEntry.iconData;
    }

    if (buttonEntry.icon) {
      return `icons/${buttonEntry.icon}`;
    }

    return "";
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read icon file."));
      reader.readAsDataURL(file);
    });
  }

  function normalizeHexColor(value) {
    const text = (value || "").toString().trim();
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : "";
  }

  function normalizeHexColorLoose(value) {
    const text = (value || "").toString().trim();
    if (!text) {
      return "";
    }
    return normalizeHexColor(text.startsWith("#") ? text : `#${text}`);
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

  function blendHexOverHex(backgroundColor, overlayColor, alpha) {
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

  function applyAdminAddContrastTheme(entrySurfaceColor, groupSurfaceColor) {
    const entryAccent = pickHighContrastColor(entrySurfaceColor);
    const groupAccent = pickHighContrastColor(groupSurfaceColor);
    document.documentElement.style.setProperty("--admin-entry-add-accent", entryAccent);
    document.documentElement.style.setProperty("--admin-entry-add-accent-soft", hexColorToRgba(entryAccent, 0.78));
    document.documentElement.style.setProperty("--admin-entry-add-accent-hover-bg", hexColorToRgba(entryAccent, 0.1));
    document.documentElement.style.setProperty("--admin-group-add-accent", groupAccent);
    document.documentElement.style.setProperty("--admin-group-add-accent-soft", hexColorToRgba(groupAccent, 0.78));
    document.documentElement.style.setProperty("--admin-group-add-accent-hover-bg", hexColorToRgba(groupAccent, 0.1));
  }

  function applyNavActionTabContrastTheme(surfaceColor) {
    const navBg = pickHighContrastColor(surfaceColor);
    const navText = pickHighContrastColor(navBg);
    document.documentElement.style.setProperty("--dashboard-nav-tab-bg", navBg);
    document.documentElement.style.setProperty("--dashboard-nav-tab-text", navText);
    document.documentElement.style.setProperty("--dashboard-nav-tab-hover-bg", hexColorToRgba(navBg, 0.86));
    document.documentElement.style.setProperty("--dashboard-nav-tab-hover-text", navText);
  }

  function applyAdminTextContrastTheme(groupSurfaceColor, pageSurfaceColor) {
    const surfaceText = pickHighContrastColor(groupSurfaceColor);
    const panelSurface = blendHexOverHex(pageSurfaceColor, "#0f172a", 0.72) || "#0f172a";
    const panelText = pickHighContrastColor(panelSurface);
    document.documentElement.style.setProperty("--admin-surface-text-color", surfaceText);
    document.documentElement.style.setProperty("--admin-surface-text-muted", hexColorToRgba(surfaceText, 0.88));
    document.documentElement.style.setProperty("--admin-panel-text-color", panelText);
    document.documentElement.style.setProperty("--admin-panel-text-muted", hexColorToRgba(panelText, 0.88));
  }

  function updateColorSwatch(swatchEl, value, fallbackColor) {
    if (!swatchEl) {
      return;
    }
    swatchEl.style.backgroundColor = normalizeHexColor(value) || fallbackColor;
  }

  function setThemeColorControlValue(control, value) {
    if (!control) {
      return;
    }
    const normalized = normalizeHexColor(value) || control.fallback;
    if (control.codeInput) {
      control.codeInput.value = normalized;
    }
    if (control.pickerInput) {
      control.pickerInput.value = normalized;
    }
    updateColorSwatch(control.swatchEl, normalized, control.fallback);
  }

  function readThemeColorControlValue(control) {
    if (!control) {
      return "";
    }
    const codeValue = normalizeHexColorLoose(control.codeInput && control.codeInput.value);
    if (codeValue) {
      return codeValue;
    }
    return normalizeHexColor(control.pickerInput && control.pickerInput.value);
  }

  async function readClipboardText() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
      throw new Error("Clipboard paste is not available in this browser.");
    }
    return navigator.clipboard.readText();
  }

  async function pasteHexColorIntoControl(control) {
    hideMessage();
    const text = await readClipboardText();
    const normalized = normalizeHexColorLoose(text);
    if (!normalized) {
      throw new Error("Clipboard does not contain a valid 6-character hex color.");
    }
    setThemeColorControlValue(control, normalized);
    applyAdminThemePreview();
    await saveActiveDashboardSettings();
  }

  async function pasteTextIntoInput(inputEl, label) {
    hideMessage();
    const text = await readClipboardText();
    if (!inputEl) {
      return;
    }
    inputEl.value = (text || "").trim();
    if (label) {
      showMessage(`${label} pasted.`, "is-success");
    }
  }

  function handleThemeColorCodeInput(control) {
    const normalized = normalizeHexColorLoose(control.codeInput && control.codeInput.value);
    if (!normalized) {
      return;
    }
    if (control.pickerInput) {
      control.pickerInput.value = normalized;
    }
    updateColorSwatch(control.swatchEl, normalized, control.fallback);
    applyAdminThemePreview();
  }

  function commitThemeColorCodeInput(control) {
    const normalized = normalizeHexColorLoose(control.codeInput && control.codeInput.value);
    if (!normalized) {
      setThemeColorControlValue(control, control.pickerInput && control.pickerInput.value);
      return;
    }
    setThemeColorControlValue(control, normalized);
    applyAdminThemePreview();
    saveActiveDashboardSettings().catch((error) => {
      console.error(error);
      showMessage("Failed to update tab settings.", "is-danger");
    });
  }

  function applyAdminThemePreview() {
    const dashboardColor = readThemeColorControlValue(getThemeColorControl("backgroundColor"));
    const groupColor = readThemeColorControlValue(getThemeColorControl("groupBackgroundColor"));
    const pageTextColor = readThemeColorControlValue(getThemeColorControl("textColor"));
    const buttonTextColor = readThemeColorControlValue(getThemeColorControl("buttonTextColor"));
    const tabColor = readThemeColorControlValue(getThemeColorControl("tabColor"));
    const activeTabColor = readThemeColorControlValue(getThemeColorControl("activeTabColor"));
    const tabTextColor = readThemeColorControlValue(getThemeColorControl("tabTextColor"));
    const activeTabTextColor = readThemeColorControlValue(getThemeColorControl("activeTabTextColor"));
    const dashboardSurfaceColor = dashboardColor || DEFAULT_DASHBOARD_BG_COLOR;
    const groupSurfaceColor = groupColor || DEFAULT_GROUP_BOX_BG_COLOR;
    const flatGroupShell = dashboardSurfaceColor === groupSurfaceColor;

    updateColorSwatch(dashboardBgColorSwatch, dashboardColor, DEFAULT_DASHBOARD_BG_COLOR);
    updateColorSwatch(groupBgColorSwatch, groupColor, DEFAULT_GROUP_BOX_BG_COLOR);
    updateColorSwatch(pageTextColorSwatch, pageTextColor, DEFAULT_PAGE_TEXT_COLOR);
    updateColorSwatch(buttonTextColorSwatch, buttonTextColor, DEFAULT_BUTTON_TEXT_COLOR);
    updateColorSwatch(tabColorSwatch, tabColor, DEFAULT_TAB_COLOR);
    updateColorSwatch(activeTabColorSwatch, activeTabColor, DEFAULT_ACTIVE_TAB_COLOR);
    updateColorSwatch(tabTextColorSwatch, tabTextColor, DEFAULT_TAB_TEXT_COLOR);
    updateColorSwatch(activeTabTextColorSwatch, activeTabTextColor, DEFAULT_ACTIVE_TAB_TEXT_COLOR);
    document.documentElement.classList.toggle("admin-group-shell-flat", flatGroupShell);
    applyAdminTextContrastTheme(groupSurfaceColor, dashboardSurfaceColor);
    applyAdminAddContrastTheme(groupSurfaceColor, dashboardSurfaceColor);
    applyNavActionTabContrastTheme(dashboardSurfaceColor);

    if (dashboardColor) {
      document.documentElement.style.setProperty("--dashboard-page-bg", dashboardColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-page-bg");
    }

    if (groupColor) {
      document.documentElement.style.setProperty("--dashboard-group-bg", groupColor);
    } else {
      document.documentElement.style.removeProperty("--dashboard-group-bg");
    }

    if (pageTextColor) {
      document.documentElement.style.setProperty("--dashboard-text-color", pageTextColor);
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

  function normalizePreviewMode(mode) {
    return mode === "internal" ? "internal" : "external";
  }

  function updatePreviewModeButtons() {
    if (!previewModeToggle || !previewModeExternalLabel || !previewModeInternalLabel) {
      return;
    }
    const isInternal = previewMode === "internal";
    previewModeToggle.checked = isInternal;
    previewModeExternalLabel.classList.toggle("is-active", !isInternal);
    previewModeInternalLabel.classList.toggle("is-active", isInternal);
  }

  function setPreviewMode(mode) {
    previewMode = normalizePreviewMode(mode);
    DashboardCommon.setLinkMode(previewMode);
    updatePreviewModeButtons();
  }

  function showLoginView() {
    loginView.classList.remove("is-hidden");
    adminView.classList.add("is-hidden");
    loginPassword.value = "";
    authMustChangePassword = false;
    setAccountPaneOpen(false);
    applyFirstRunSetupState();
    applyLoginViewMode();
  }

  function showAdminView() {
    loginView.classList.add("is-hidden");
    adminView.classList.remove("is-hidden");
    authSetupRequired = false;
    editorPane.classList.remove("is-hidden");
    setAccountPaneOpen(false);
    applyFirstRunSetupState();
    applyLoginViewMode();
  }

  function getDashboardIndex(dashboardId) {
    return config.dashboards.findIndex((dashboard) => dashboard.id === dashboardId);
  }

  function ensureActiveDashboard() {
    if (!Array.isArray(config.dashboards) || !config.dashboards.length) {
      config.dashboards = [
        {
          id: DashboardCommon.createId("dashboard"),
          label: "Dashboard 1",
          ...buildDefaultThemeValues({ preferSavedDefaultTheme: true }),
          enableInternalLinks: false,
          showLinkModeToggle: true,
          themePresets: [],
          groups: []
        }
      ];
    }

    if (!activeDashboardId || getDashboardIndex(activeDashboardId) < 0) {
      activeDashboardId = config.dashboards[0].id;
    }

    DashboardCommon.setActiveDashboardId(activeDashboardId);
  }

  function getActiveDashboard() {
    ensureActiveDashboard();
    return config.dashboards[getDashboardIndex(activeDashboardId)];
  }

  function getNamedSavedThemePreset(presetName) {
    const target = String(presetName || "").trim().toLowerCase();
    if (!target) {
      return null;
    }
    return getNormalizedSavedThemePresets().find((preset) => {
      const name = preset && typeof preset.name === "string" ? preset.name.trim().toLowerCase() : "";
      return name === target;
    }) || null;
  }

  function getBuiltInDefaultThemePreset() {
    return getResolvedBuiltInThemePresets().find((preset) => preset && preset.id === "builtin-default-theme") || null;
  }

  function buildDefaultThemeValues(options = {}) {
    const preferSavedDefaultTheme = Boolean(options && options.preferSavedDefaultTheme);
    if (preferSavedDefaultTheme) {
      const savedDefaultTheme = getNamedSavedThemePreset("Default Theme");
      if (savedDefaultTheme && savedDefaultTheme.theme) {
        return { ...normalizeThemePresetTheme(savedDefaultTheme.theme) };
      }
    }

    const builtInDefaultTheme = getBuiltInDefaultThemePreset();
    if (builtInDefaultTheme && builtInDefaultTheme.theme) {
      return { ...normalizeThemePresetTheme(builtInDefaultTheme.theme) };
    }

    return {
      ...DEFAULT_THEME_COLOR_VALUES,
      ...DEFAULT_BUTTON_COLOR_OPTIONS
    };
  }

  function normalizeThemePresetTheme(theme) {
    const defaults = DEFAULT_BUTTON_COLOR_OPTIONS;
    return {
      backgroundColor: normalizeHexColor(theme && theme.backgroundColor) || DEFAULT_DASHBOARD_BG_COLOR,
      groupBackgroundColor: normalizeHexColor(theme && theme.groupBackgroundColor) || DEFAULT_GROUP_BOX_BG_COLOR,
      textColor: normalizeHexColor(theme && theme.textColor) || DEFAULT_PAGE_TEXT_COLOR,
      buttonTextColor: normalizeHexColor(theme && theme.buttonTextColor) || DEFAULT_BUTTON_TEXT_COLOR,
      tabColor: normalizeHexColor(theme && theme.tabColor) || DEFAULT_TAB_COLOR,
      activeTabColor: normalizeHexColor(theme && theme.activeTabColor) || DEFAULT_ACTIVE_TAB_COLOR,
      tabTextColor: normalizeHexColor(theme && theme.tabTextColor) || DEFAULT_TAB_TEXT_COLOR,
      activeTabTextColor: normalizeHexColor(theme && theme.activeTabTextColor) || DEFAULT_ACTIVE_TAB_TEXT_COLOR,
      buttonColorMode: DashboardCommon.normalizeButtonColorMode(theme && theme.buttonColorMode),
      buttonCycleHueStep: clampInteger(
        theme && theme.buttonCycleHueStep,
        1,
        180,
        defaults.buttonCycleHueStep
      ),
      buttonCycleSaturation: clampInteger(
        theme && theme.buttonCycleSaturation,
        0,
        100,
        defaults.buttonCycleSaturation
      ),
      buttonCycleLightness: clampInteger(
        theme && theme.buttonCycleLightness,
        0,
        100,
        defaults.buttonCycleLightness
      ),
      buttonSolidColor: normalizeHexColor(theme && theme.buttonSolidColor) || defaults.buttonSolidColor
    };
  }

  function readThemePresetThemeFromControls() {
    const theme = {};
    themeColorControls.forEach((control) => {
      theme[control.key] = readThemeColorControlValue(control) || control.fallback;
    });
    return normalizeThemePresetTheme({
      ...theme,
      ...readButtonColorSettingsFromControls()
    });
  }

  function applyThemePresetThemeToControls(theme) {
    const normalized = normalizeThemePresetTheme(theme);
    themeColorControls.forEach((control) => {
      setThemeColorControlValue(control, normalized[control.key]);
    });
    setButtonColorControlsFromDashboard(normalized);
    applyAdminThemePreview();
    renderGroupsEditor();
    return normalized;
  }

  function normalizeThemePresetList(source) {
    const items = Array.isArray(source) ? source : [];
    return items.map((preset, index) => {
      const presetId =
        preset && typeof preset.id === "string" && preset.id.trim()
          ? preset.id.trim()
          : `theme-preset-${index + 1}`;
      const presetName =
        preset && typeof preset.name === "string" && preset.name.trim()
          ? preset.name.trim()
          : `Theme ${index + 1}`;
      return {
        id: presetId,
        name: presetName,
        theme: normalizeThemePresetTheme(preset && preset.theme)
      };
    });
  }

  function getNormalizedSavedThemePresets() {
    const hasRootPresetProperty =
      Boolean(config) && Object.prototype.hasOwnProperty.call(config, "themePresets");
    if (hasRootPresetProperty) {
      return normalizeThemePresetList(config && config.themePresets);
    }

    const merged = [];
    const seenIds = new Set();
    const seenNames = new Set();
    if (Array.isArray(config && config.dashboards)) {
      config.dashboards.forEach((dashboard) => {
        normalizeThemePresetList(dashboard && dashboard.themePresets).forEach((preset) => {
          if (!preset) {
            return;
          }
          const normalizedId = (preset.id || "").trim().toLowerCase();
          const normalizedName = (preset.name || "").trim().toLowerCase();
          if ((normalizedId && seenIds.has(normalizedId)) || (normalizedName && seenNames.has(normalizedName))) {
            return;
          }
          if (normalizedId) {
            seenIds.add(normalizedId);
          }
          if (normalizedName) {
            seenNames.add(normalizedName);
          }
          merged.push(preset);
        });
      });
    }
    return merged;
  }

  function getResolvedBuiltInThemePresets() {
    return BUILT_IN_THEME_PRESETS.map((preset) => {
      return {
        ...preset,
        theme: normalizeThemePresetTheme(preset.theme)
      };
    });
  }

  function getNextCustomThemePresetName() {
    const existingNames = new Set(
      getNormalizedSavedThemePresets()
        .map((preset) => (preset && typeof preset.name === "string" ? preset.name.trim().toLowerCase() : ""))
        .filter(Boolean)
    );

    for (let index = 1; index < 10000; index += 1) {
      const candidate = `Custom theme ${index}`;
      if (!existingNames.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    return `Custom theme ${Date.now()}`;
  }

  function refreshThemePresetButtons() {
    const selectedValue = themePresetSelect && themePresetSelect.value ? themePresetSelect.value.trim() : "";
    const hasSelection = Boolean(selectedValue);
    const hasSavedSelection = selectedValue.startsWith("saved:");
    if (themePresetPreviewBtn) {
      themePresetPreviewBtn.disabled = !hasSelection;
    }
    if (themePresetApplyBtn) {
      themePresetApplyBtn.disabled = !hasSelection;
    }
    if (themePresetDeleteBtn) {
      themePresetDeleteBtn.disabled = !hasSavedSelection;
      themePresetDeleteBtn.title = hasSavedSelection ? "Delete selected saved theme preset" : "Select a saved preset to delete";
    }
    if (themePresetDeleteControl) {
      themePresetDeleteControl.classList.toggle("is-hidden", !hasSavedSelection);
    }
  }

  function renderThemePresetOptions() {
    if (!themePresetSelect) {
      return;
    }

    const preferredValue =
      (themePresetSelect.dataset && themePresetSelect.dataset.lastValue) || themePresetSelect.value || "";
    const builtInPresets = getResolvedBuiltInThemePresets();
    const customPresets = getNormalizedSavedThemePresets();
    const validValues = new Set();

    themePresetSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a theme preset...";
    themePresetSelect.appendChild(placeholder);
    validValues.add("");

    const builtInGroup = document.createElement("optgroup");
    builtInGroup.label = "Built-in";
    builtInPresets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = `builtin:${preset.id}`;
      option.textContent = preset.name;
      builtInGroup.appendChild(option);
      validValues.add(option.value);
    });
    themePresetSelect.appendChild(builtInGroup);

    if (customPresets.length) {
      const savedGroup = document.createElement("optgroup");
      savedGroup.label = "Saved themes";
      customPresets.forEach((preset) => {
        const option = document.createElement("option");
        option.value = `saved:${preset.id}`;
        option.textContent = preset.name;
        savedGroup.appendChild(option);
        validValues.add(option.value);
      });
      themePresetSelect.appendChild(savedGroup);
    }

    themePresetSelect.value = validValues.has(preferredValue) ? preferredValue : "";
    if (themePresetSelect.dataset) {
      themePresetSelect.dataset.lastValue = themePresetSelect.value;
    }
    refreshThemePresetButtons();
  }

  function getSelectedThemePreset() {
    if (!themePresetSelect) {
      return null;
    }
    const value = (themePresetSelect.value || "").trim();
    if (!value) {
      return null;
    }

    const separatorIndex = value.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }

    const scope = value.slice(0, separatorIndex);
    const presetId = value.slice(separatorIndex + 1);
    if (!presetId) {
      return null;
    }

    if (scope === "builtin") {
      const preset = getResolvedBuiltInThemePresets().find((item) => item.id === presetId);
      return preset ? { scope, ...preset, theme: normalizeThemePresetTheme(preset.theme) } : null;
    }

    if (scope === "saved") {
      const preset = getNormalizedSavedThemePresets().find((item) => item.id === presetId);
      return preset ? { scope, ...preset } : null;
    }

    return null;
  }

  function previewSelectedThemePreset() {
    const preset = getSelectedThemePreset();
    if (!preset) {
      showMessage("Select a theme preset first.", "is-danger");
      return;
    }
    applyThemePresetThemeToControls(preset.theme);
    if (themePresetNameInput && !themePresetNameInput.value.trim()) {
      themePresetNameInput.value = preset.name;
    }
    showMessage(`Previewing "${preset.name}". Click Load to save it to this tab.`, "is-success");
  }

  async function loadSelectedThemePreset() {
    hideMessage();
    const preset = getSelectedThemePreset();
    if (!preset) {
      showMessage("Select a theme preset first.", "is-danger");
      return;
    }
    applyThemePresetThemeToControls(preset.theme);
    if (themePresetNameInput) {
      themePresetNameInput.value = getNextCustomThemePresetName();
    }
    await saveActiveDashboardSettings({ silentSuccess: true });
  }

  async function saveCurrentThemePreset() {
    hideMessage();
    const presetName = (themePresetNameInput && themePresetNameInput.value ? themePresetNameInput.value : "").trim();
    if (!presetName) {
      showMessage("Preset name is required.", "is-danger");
      return;
    }

    const theme = readThemePresetThemeFromControls();
    const existingPresets = getNormalizedSavedThemePresets();
    const existingIndex = existingPresets.findIndex((preset) => {
      const name = preset && typeof preset.name === "string" ? preset.name.trim().toLowerCase() : "";
      return name === presetName.toLowerCase();
    });

    const presetId =
      existingIndex >= 0 &&
      existingPresets[existingIndex] &&
      typeof existingPresets[existingIndex].id === "string" &&
      existingPresets[existingIndex].id.trim()
        ? existingPresets[existingIndex].id.trim()
        : DashboardCommon.createId("theme");

    const nextPreset = {
      id: presetId,
      name: presetName,
      theme
    };

    config.themePresets = existingPresets.slice();
    if (existingIndex >= 0) {
      config.themePresets.splice(existingIndex, 1, nextPreset);
    } else {
      config.themePresets.push(nextPreset);
    }

    if (themePresetSelect && themePresetSelect.dataset) {
      themePresetSelect.dataset.lastValue = `saved:${presetId}`;
    }
    renderThemePresetOptions();
    await persistConfig(existingIndex >= 0 ? "Theme preset updated." : "Theme preset saved.");
  }

  async function deleteSelectedThemePreset() {
    hideMessage();
    const preset = getSelectedThemePreset();
    if (!preset || preset.scope !== "saved") {
      showMessage("Select a saved theme preset to delete.", "is-danger");
      return;
    }

    const existingPresets = getNormalizedSavedThemePresets();
    const nextPresets = existingPresets.filter((item) => {
      const id = item && typeof item.id === "string" ? item.id.trim() : "";
      return id !== preset.id;
    });

    if (nextPresets.length === existingPresets.length) {
      showMessage("Theme preset not found.", "is-danger");
      return;
    }

    config.themePresets = nextPresets;
    if (themePresetSelect && themePresetSelect.dataset) {
      themePresetSelect.dataset.lastValue = "";
    }
    renderThemePresetOptions();
    await persistConfig(`Theme preset "${preset.name}" deleted.`);
  }

  function isInternalLinksEnabledForDashboard(dashboard) {
    return Boolean(dashboard && dashboard.enableInternalLinks);
  }

  function isInternalLinksEnabledForActiveDashboard() {
    return isInternalLinksEnabledForDashboard(getActiveDashboard());
  }

  function refreshInternalLinksSettingsControls(dashboard, enabledOverride = null) {
    const enabled = enabledOverride === null ? isInternalLinksEnabledForDashboard(dashboard) : Boolean(enabledOverride);

    if (enableInternalLinksCheckbox) {
      enableInternalLinksCheckbox.checked = enabled;
    }

    if (showLinkToggleField) {
      showLinkToggleField.classList.toggle("is-hidden", !enabled);
    }

    if (showLinkToggleCheckbox) {
      showLinkToggleCheckbox.disabled = !enabled;
    }
  }

  function refreshButtonModalLinkFields(enabledOverride = null) {
    const internalEnabled =
      enabledOverride === null ? isInternalLinksEnabledForActiveDashboard() : Boolean(enabledOverride);

    if (entryInternalUrlColumn) {
      entryInternalUrlColumn.classList.toggle("is-hidden", !internalEnabled);
    }

    if (entryExternalUrlColumn) {
      entryExternalUrlColumn.classList.toggle("is-6", internalEnabled);
      entryExternalUrlColumn.classList.toggle("is-12", !internalEnabled);
    }

    if (entryInternalUrlInput) {
      entryInternalUrlInput.disabled = !internalEnabled;
    }

    if (entryUrlHelpText) {
      entryUrlHelpText.textContent = internalEnabled
        ? "At least one URL (external or internal) is required."
        : "External URL is required (internal links are disabled for this tab).";
    }
  }

  function refreshEntryIconFilenameFieldVisibility() {
    if (!entryIconFilenameColumn) {
      return;
    }
    const shouldShow =
      !buttonModalState.isNew ||
      Boolean((entryIconInput && entryIconInput.value && entryIconInput.value.trim()) || buttonModalState.modalIconData);
    entryIconFilenameColumn.classList.toggle("is-hidden", !shouldShow);
  }

  function getSelectedIconSearchSource() {
    const value = entryIconSourceSelect && entryIconSourceSelect.value ? entryIconSourceSelect.value : "selfhst";
    if (value === "iconify-simple") {
      return "iconify-simple";
    }
    if (value === "iconify-logos") {
      return "iconify-logos";
    }
    return "selfhst";
  }

  function getIconSearchSourceLabel(source) {
    if (source === "iconify-simple") {
      return "Iconify Simple Icons";
    }
    if (source === "iconify-logos") {
      return "Iconify Logos";
    }
    return "selfh.st/icons";
  }

  function isIconifySource(source) {
    return source === "iconify-simple" || source === "iconify-logos";
  }

  function clearIconSearchDebounce() {
    if (buttonModalState.iconSearchDebounceTimer) {
      clearTimeout(buttonModalState.iconSearchDebounceTimer);
      buttonModalState.iconSearchDebounceTimer = 0;
    }
  }

  function scheduleIconSearch(delayMs = 220) {
    clearIconSearchDebounce();
    buttonModalState.iconSearchDebounceTimer = window.setTimeout(() => {
      buttonModalState.iconSearchDebounceTimer = 0;
      runIconSearch().catch((error) => {
        console.error(error);
        setEntryIconSearchStatus("Icon search failed.", "has-text-danger");
        showMessage(error.message || "Icon search failed.", "is-danger");
      });
    }, delayMs);
  }

  function setActiveDashboard(dashboardId) {
    activeDashboardId = dashboardId;
    ensureActiveDashboard();
    setAccountPaneOpen(false);
    renderEditor();
  }

  function getGroupIndex(dashboard, groupId) {
    return dashboard.groups.findIndex((group) => group.id === groupId);
  }

  function getButtonPosition(dashboard, buttonId) {
    for (let groupIndex = 0; groupIndex < dashboard.groups.length; groupIndex += 1) {
      const buttonIndex = dashboard.groups[groupIndex].entries.findIndex((entry) => entry.id === buttonId);
      if (buttonIndex !== -1) {
        return { groupIndex, buttonIndex };
      }
    }
    return null;
  }

  function closeButtonModal() {
    clearIconSearchDebounce();
    entryModal.classList.remove("is-active");
  }

  function setEntryIconSearchStatus(text, toneClass = "muted") {
    if (!entryIconSearchStatus) {
      return;
    }
    entryIconSearchStatus.className = `help mt-2 ${toneClass}`.trim();
    entryIconSearchStatus.textContent = text || "";
  }

  function clearEntryIconSearchResults() {
    if (entryIconSearchResults) {
      entryIconSearchResults.innerHTML = "";
    }
  }

  function currentEntryIconSource() {
    if (entryClearIconData.checked) {
      return "";
    }

    if (buttonModalState.modalIconData) {
      return buttonModalState.modalIconData;
    }

    const fileName = entryIconInput.value.trim();
    if (fileName) {
      return `icons/${fileName}`;
    }

    return "";
  }

  function renderEntryIconPreview() {
    const iconSrc = currentEntryIconSource();
    entryIconPreview.innerHTML = "";

    if (!iconSrc) {
      entryIconPreview.textContent = "No icon configured";
      return;
    }

    const img = document.createElement("img");
    img.className = "icon-preview";
    img.src = iconSrc;
    img.alt = "icon preview";
    entryIconPreview.appendChild(img);
    entryIconPreview.appendChild(document.createTextNode(buttonModalState.modalIconData ? " icon embedded" : " icon path"));
  }

  function renderIconSearchResults(items) {
    clearEntryIconSearchResults();

    if (!entryIconSearchResults) {
      return;
    }

    if (!Array.isArray(items) || !items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state small";
      empty.textContent = "No icons found.";
      entryIconSearchResults.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const resultBtn = document.createElement("button");
      resultBtn.type = "button";
      resultBtn.className = "icon-search-result";
      resultBtn.title = `Use ${item.name}`;
      resultBtn.setAttribute("aria-label", `Use icon ${item.name}`);

      const media = document.createElement("span");
      media.className = "icon-search-result-media";
      if (item.previewUrl) {
        const previewImg = document.createElement("img");
        previewImg.src = item.previewUrl;
        previewImg.alt = "";
        previewImg.loading = "lazy";
        media.appendChild(previewImg);
      } else {
        media.textContent = "◻";
      }

      const meta = document.createElement("span");
      meta.className = "icon-search-result-meta";

      const nameEl = document.createElement("span");
      nameEl.className = "icon-search-result-name";
      nameEl.textContent = item.name || item.reference || "Icon";

      const subEl = document.createElement("span");
      subEl.className = "icon-search-result-sub";
      const parts = [];
      if (item.reference) {
        parts.push(item.reference);
      }
      if (item.category) {
        parts.push(item.category);
      }
      subEl.textContent = parts.join(" · ");

      meta.appendChild(nameEl);
      meta.appendChild(subEl);

      resultBtn.appendChild(media);
      resultBtn.appendChild(meta);

      resultBtn.addEventListener("click", () => {
        importIconFromCatalog(item).catch((error) => {
          console.error(error);
          setEntryIconSearchStatus("Failed to import icon.", "has-text-danger");
          showMessage(error.message || "Failed to import icon.", "is-danger");
        });
      });

      entryIconSearchResults.appendChild(resultBtn);
    });
  }

  async function runIconSearch() {
    const query = (entryIconSearchInput && entryIconSearchInput.value ? entryIconSearchInput.value : "").trim();
    const source = getSelectedIconSearchSource();
    const seq = (buttonModalState.iconSearchSeq || 0) + 1;
    buttonModalState.iconSearchSeq = seq;

    if (!query || query.length < 2) {
      clearEntryIconSearchResults();
      setEntryIconSearchStatus("Type at least 2 characters to search.", "muted");
      return;
    }

    if (entryIconSearchBtn) {
      entryIconSearchBtn.classList.add("is-loading");
      entryIconSearchBtn.disabled = true;
    }
    setEntryIconSearchStatus(`Searching "${query}" in ${getIconSearchSourceLabel(source)}...`, "muted");

    try {
      const payload = await DashboardCommon.searchIcons(query, 18, source);
      if (buttonModalState.iconSearchSeq !== seq) {
        return;
      }

      const resultSource = payload && payload.source ? payload.source : source;
      const items = Array.isArray(payload.items)
        ? payload.items.map((item) => ({ ...item, source: item && item.source ? item.source : resultSource }))
        : [];
      renderIconSearchResults(items);
      setEntryIconSearchStatus(
        items.length
          ? `Found ${items.length} icon${items.length === 1 ? "" : "s"} from ${getIconSearchSourceLabel(resultSource)}.`
          : "No icons found.",
        items.length ? "muted" : "has-text-warning"
      );
    } catch (error) {
      if (buttonModalState.iconSearchSeq !== seq) {
        return;
      }
      clearEntryIconSearchResults();
      setEntryIconSearchStatus("Icon search source unavailable.", "has-text-danger");
      showMessage(error.message || "Icon search failed.", "is-danger");
    } finally {
      if (buttonModalState.iconSearchSeq === seq && entryIconSearchBtn) {
        entryIconSearchBtn.classList.remove("is-loading");
        entryIconSearchBtn.disabled = false;
      }
    }
  }

  async function importIconFromCatalog(itemOrReference) {
    const item =
      itemOrReference && typeof itemOrReference === "object"
        ? itemOrReference
        : { reference: String(itemOrReference || ""), source: getSelectedIconSearchSource() };
    const reference = String(item.reference || "").trim();
    const source = isIconifySource(item.source) ? item.source : "selfhst";

    hideMessage();
    setEntryIconSearchStatus(`Importing "${reference}" from ${getIconSearchSourceLabel(source)}...`, "muted");

    const payload =
      isIconifySource(source)
        ? await DashboardCommon.importIconifyIcon(reference, "svg", source)
        : await DashboardCommon.importSelfhstIcon(reference, "svg");
    buttonModalState.modalIconData = payload.iconData || "";

    if (payload.icon) {
      entryIconInput.value = payload.icon;
    } else if (reference) {
      entryIconInput.value = `${reference}.svg`;
    }

    entryClearIconData.checked = false;
    entryIconUpload.value = "";
    renderEntryIconPreview();
    refreshEntryIconFilenameFieldVisibility();
    setEntryIconSearchStatus(
      `Imported ${payload.name || reference}. Click Save to store it locally in this button.`,
      "has-text-success"
    );
  }

  function readButtonModalDraft() {
    const name = entryNameInput.value.trim();
    const icon = entryIconInput.value.trim();
    const externalUrl = entryExternalUrlInput.value.trim();
    const internalUrl = entryInternalUrlInput.value.trim();
    const clearIconData = entryClearIconData.checked;
    const uploadedIcon = entryIconUpload.files && entryIconUpload.files[0];
    const hasAnyInput = Boolean(name || icon || externalUrl || internalUrl || clearIconData || uploadedIcon);

    return {
      name,
      icon,
      externalUrl,
      internalUrl,
      clearIconData,
      uploadedIcon,
      hasAnyInput
    };
  }

  function validateButtonModalDraft(draft, isNew) {
    if (isNew && !draft.hasAnyInput) {
      return "";
    }

    if (!draft.name) {
      return "Button name is required.";
    }

    if (!draft.externalUrl && !draft.internalUrl) {
      return "At least one URL (external or internal) is required.";
    }

    return "";
  }

  function openButtonModal(groupId, buttonId = "") {
    const dashboard = getActiveDashboard();
    const group = dashboard.groups.find((item) => item.id === groupId);
    if (!group) {
      showMessage("Group not found.", "is-danger");
      return;
    }

    buttonModalState.dashboardId = dashboard.id;
    buttonModalState.sourceGroupId = groupId;
    buttonModalState.buttonId = buttonId || "";
    buttonModalState.isNew = !buttonId;

    const buttonEntry = buttonId
      ? group.entries.find((item) => item.id === buttonId)
      : {
          id: DashboardCommon.createId("button"),
          name: "",
          icon: "",
          iconData: "",
          links: { external: "", internal: "" }
        };

    if (!buttonEntry) {
      showMessage("Button not found.", "is-danger");
      return;
    }

    entryModalTitle.textContent = buttonModalState.isNew ? "Add Button" : `Edit Button: ${buttonEntry.name}`;
    if (entrySaveBtn) {
      entrySaveBtn.textContent = buttonModalState.isNew ? "Add Button" : "Save";
    }
    entryNameInput.value = buttonEntry.name || "";
    entryIconInput.value = buttonEntry.icon || "";
    entryIconInput.disabled = buttonModalState.isNew;
    entryIconInput.classList.toggle("is-disabled", buttonModalState.isNew);
    if (entryIconInputHint) {
      entryIconInputHint.classList.toggle("is-hidden", !buttonModalState.isNew);
    }
    entryIconUpload.value = "";
    entryClearIconData.checked = false;
    buttonModalState.modalIconData = buttonEntry.iconData || "";
    buttonModalState.iconSearchSeq += 1;
    if (entryIconSearchInput) {
      entryIconSearchInput.value = "";
    }
    if (entryIconSourceSelect) {
      entryIconSourceSelect.value = "selfhst";
    }
    clearIconSearchDebounce();
    clearEntryIconSearchResults();
    setEntryIconSearchStatus("Type to search an icon library and import an icon (stored locally in your dashboard config).", "muted");
    entryExternalUrlInput.value =
      buttonEntry.links && typeof buttonEntry.links.external === "string" ? buttonEntry.links.external : "";
    entryInternalUrlInput.value =
      buttonEntry.links && typeof buttonEntry.links.internal === "string" ? buttonEntry.links.internal : "";
    refreshButtonModalLinkFields();

    renderEntryIconPreview();
    refreshEntryIconFilenameFieldVisibility();

    entryDeleteBtn.disabled = buttonModalState.isNew;
    entryModal.classList.add("is-active");
  }

  function closeActionModal() {
    groupActionModal.classList.remove("is-active");
    actionModalState.mode = "";
    actionModalState.dashboardId = "";
    actionModalState.groupId = "";
    actionModalState.buttonId = "";
  }

  function openAddGroupModal() {
    actionModalState.mode = "add-group";
    actionModalState.dashboardId = activeDashboardId;
    groupActionModalTitle.textContent = "Add Group";
    groupActionModalText.textContent = "Create a new group.";
    groupActionTitleField.classList.remove("is-hidden");
    groupActionTitleLabel.textContent = "Group Title";
    groupActionTitleInput.placeholder = "New Group";
    groupActionTitleInput.value = "";
    groupActionConfirmBtn.textContent = "Add Group";
    groupActionConfirmBtn.className = "button is-link";
    groupActionModal.classList.add("is-active");
    groupActionTitleInput.focus();
  }

  function openAddDashboardModal() {
    actionModalState.mode = "add-dashboard";
    groupActionModalTitle.textContent = "Add Dashboard";
    groupActionModalText.textContent = "Create a new dashboard tab.";
    groupActionTitleField.classList.remove("is-hidden");
    groupActionTitleLabel.textContent = "Tab Title";
    groupActionTitleInput.placeholder = `Dashboard ${config.dashboards.length + 1}`;
    groupActionTitleInput.value = "";
    groupActionConfirmBtn.textContent = "Add Dashboard";
    groupActionConfirmBtn.className = "button is-link";
    groupActionModal.classList.add("is-active");
    groupActionTitleInput.focus();
  }

  function openDeleteGroupModal(dashboard, group) {
    actionModalState.mode = "delete-group";
    actionModalState.dashboardId = dashboard.id;
    actionModalState.groupId = group.id;
    groupActionModalTitle.textContent = "Delete Group";
    groupActionModalText.textContent = `Delete group "${group.title}" and all buttons?`;
    groupActionTitleField.classList.add("is-hidden");
    groupActionConfirmBtn.textContent = "Delete Group";
    groupActionConfirmBtn.className = "button is-danger";
    groupActionModal.classList.add("is-active");
  }

  function openDeleteButtonModal(dashboard, group, buttonEntry) {
    actionModalState.mode = "delete-button";
    actionModalState.dashboardId = dashboard.id;
    actionModalState.groupId = group.id;
    actionModalState.buttonId = buttonEntry.id;
    groupActionModalTitle.textContent = "Delete Button";
    groupActionModalText.textContent = `Delete button "${buttonEntry.name}"?`;
    groupActionTitleField.classList.add("is-hidden");
    groupActionConfirmBtn.textContent = "Delete Button";
    groupActionConfirmBtn.className = "button is-danger";
    groupActionModal.classList.add("is-active");
  }

  function openDeleteDashboardModal(dashboard) {
    actionModalState.mode = "delete-dashboard";
    actionModalState.dashboardId = dashboard.id;
    groupActionModalTitle.textContent = "Delete Tab";
    groupActionModalText.textContent = `Delete tab "${dashboard.label}" and all groups/buttons?`;
    groupActionTitleField.classList.add("is-hidden");
    groupActionConfirmBtn.textContent = "Delete Tab";
    groupActionConfirmBtn.className = "button is-danger";
    groupActionModal.classList.add("is-active");
  }

  function openResetStarterConfigModal() {
    actionModalState.mode = "reset-starter-config";
    actionModalState.dashboardId = "";
    actionModalState.groupId = "";
    actionModalState.buttonId = "";
    groupActionModalTitle.textContent = "Reset to Starter Config";
    groupActionModalText.textContent =
      "Replace the current dashboard data with the starter config from this release? This overwrites all tabs, groups and buttons.";
    groupActionTitleField.classList.add("is-hidden");
    groupActionConfirmBtn.textContent = "Reset to Starter";
    groupActionConfirmBtn.className = "button is-warning";
    groupActionModal.classList.add("is-active");
  }

  async function persistConfig(message) {
    config = DashboardCommon.normalizeConfig(config);
    ensureActiveDashboard();
    config = await DashboardCommon.saveConfig(config);
    ensureActiveDashboard();
    renderEditor();
    if (typeof message === "string" && message.trim()) {
      showMessage(message, "is-success");
    }
  }

  function renderMainTabs() {
    mainTabsList.innerHTML = "";
    ensureActiveDashboard();

    config.dashboards.forEach((dashboard) => {
      const li = document.createElement("li");
      li.className = `${dashboard.id === activeDashboardId ? "is-active " : ""}tab-sort-item`.trim();
      li.setAttribute("data-tab-sort-item", "");
      li.setAttribute("data-dashboard-id", dashboard.id);

      const link = document.createElement("a");
      link.href = "#";
      link.setAttribute("role", "button");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveDashboard(dashboard.id);
      });

      const label = document.createElement("span");
      label.className = "tab-link-label";
      label.textContent = dashboard.label;

      const dragHandle = createDragHandleSpan("tab-drag-handle", `Drag to reorder tab ${dashboard.label}`);

      link.appendChild(dragHandle);
      link.appendChild(label);

      li.appendChild(link);
      mainTabsList.appendChild(li);
    });

    const addLi = document.createElement("li");
    addLi.className = "add-tab";
    const addLink = document.createElement("a");
    addLink.href = "#";
    addLink.textContent = "+";
    addLink.title = "Add dashboard";
    addLink.setAttribute("aria-label", "Add dashboard");
    addLink.addEventListener("click", (event) => {
      event.preventDefault();
      hideMessage();
      openAddDashboardModal();
    });
    addLi.appendChild(addLink);
    mainTabsList.appendChild(addLi);

    const navLi = document.createElement("li");
    navLi.className = "nav-action-tab";
    navLi.appendChild(
      createEditModeNavToggle(true, (checked) => {
        if (checked) {
          return;
        }
        window.location.href = "/";
      })
    );
    mainTabsList.appendChild(navLi);

    bindPointerSortable(mainTabsList, {
      itemSelector: "[data-tab-sort-item]",
      handleSelector: ".tab-drag-handle",
      axis: "horizontal",
      endBeforeSelector: ".add-tab",
      errorMessage: "Failed to reorder tabs.",
      onReorder: async (fromIndex, toIndex) => {
        if (!moveArrayItem(config.dashboards, fromIndex, toIndex)) {
          return;
        }
        await persistConfig();
      }
    });
  }

  function renderGroupButtons(dashboard, group, groupIndex, colorStart) {
    const wrapper = document.createElement("div");
    wrapper.className = "columns is-mobile is-multiline entry-grid";
    wrapper.setAttribute("data-button-sort-container", "");
    wrapper.setAttribute("data-group-id", group.id);

    let colorIndex = colorStart;

    group.entries.forEach((buttonEntry, buttonIndex) => {
      const color = DashboardCommon.getButtonColorPair(dashboard, group, colorIndex);
      colorIndex += 1;

      const col = document.createElement("div");
      col.className = "column is-half-mobile is-one-third-tablet is-one-quarter-desktop";
      col.setAttribute("data-button-sort-item", "");
      col.setAttribute("data-button-id", buttonEntry.id);

      const card = document.createElement("div");
      card.className = "entry-admin-card";

      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "button is-fullwidth entry-preview-button";
      preview.style.backgroundColor = color.base;
      preview.title = `Edit button: ${buttonEntry.name}`;
      preview.setAttribute("aria-label", `Edit button ${buttonEntry.name}`);

      preview.addEventListener("mouseenter", () => {
        preview.style.backgroundColor = color.hover;
      });

      preview.addEventListener("mouseleave", () => {
        preview.style.backgroundColor = color.base;
      });
      preview.addEventListener("click", () => openButtonModal(group.id, buttonEntry.id));

      const iconWrap = document.createElement("span");
      iconWrap.className = "icon entry-icon";
      const src = iconSource(buttonEntry);
      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = `${buttonEntry.name} icon`;
        iconWrap.appendChild(img);
      }

      const label = document.createElement("span");
      label.className = "entry-label";
      label.textContent = buttonEntry.name;

      const editHint = document.createElement("span");
      editHint.className = "entry-preview-edit-icon";
      editHint.setAttribute("aria-hidden", "true");
      editHint.textContent = "✎";

      const dragHandle = createDragHandleSpan(
        "button-drag-handle",
        `Drag to reorder button ${buttonEntry.name || "button"}`
      );

      preview.appendChild(dragHandle);
      preview.appendChild(iconWrap);
      preview.appendChild(label);
      preview.appendChild(editHint);

      card.appendChild(preview);
      col.appendChild(card);
      wrapper.appendChild(col);
    });

    const addCol = document.createElement("div");
    addCol.className = "column is-half-mobile is-one-third-tablet is-one-quarter-desktop";
    addCol.setAttribute("data-entry-add-slot", "");

    const addCard = document.createElement("div");
    addCard.className = "entry-admin-card";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "button is-fullwidth entry-add-button";
    addButton.textContent = "+";
    addButton.title = "Add button";
    addButton.setAttribute("aria-label", "Add button");
    addButton.addEventListener("click", () => openButtonModal(group.id));

    addCard.appendChild(addButton);
    addCol.appendChild(addCard);
    wrapper.appendChild(addCol);

    bindPointerSortable(wrapper, {
      itemSelector: "[data-button-sort-item]",
      handleSelector: ".button-drag-handle",
      axis: "grid",
      crossContainerSelector: "[data-button-sort-container]",
      endBeforeSelector: "[data-entry-add-slot]",
      errorMessage: "Failed to reorder buttons.",
      onReorder: async (fromIndex, toIndex) => {
        const activeDashboard = getActiveDashboard();
        if (!activeDashboard) {
          throw new Error("Dashboard not found.");
        }
        const targetGroupIndex = getGroupIndex(activeDashboard, group.id);
        if (targetGroupIndex < 0) {
          throw new Error("Group not found.");
        }
        const buttons = activeDashboard.groups[targetGroupIndex].entries;
        if (!moveArrayItem(buttons, fromIndex, toIndex)) {
          return;
        }
        await persistConfig();
      },
      onMoveBetweenContainers: async (fromIndex, toIndex, context) => {
        const activeDashboard = getActiveDashboard();
        if (!activeDashboard) {
          throw new Error("Dashboard not found.");
        }

        const fromGroupId =
          context && context.fromContainer ? String(context.fromContainer.getAttribute("data-group-id") || "") : "";
        const toGroupId =
          context && context.toContainer ? String(context.toContainer.getAttribute("data-group-id") || "") : "";
        const fromGroupIndex = getGroupIndex(activeDashboard, fromGroupId);
        const toGroupIndex = getGroupIndex(activeDashboard, toGroupId);
        if (fromGroupIndex < 0 || toGroupIndex < 0) {
          throw new Error("Group not found.");
        }

        const fromEntries = activeDashboard.groups[fromGroupIndex].entries;
        const toEntries = activeDashboard.groups[toGroupIndex].entries;
        if (!Array.isArray(fromEntries) || !Array.isArray(toEntries)) {
          throw new Error("Button list not found.");
        }

        if (fromIndex < 0 || fromIndex >= fromEntries.length) {
          throw new Error("Button not found.");
        }

        const [movedEntry] = fromEntries.splice(fromIndex, 1);
        if (!movedEntry) {
          throw new Error("Button not found.");
        }

        const insertIndex = Math.max(0, Math.min(toIndex, toEntries.length));
        toEntries.splice(insertIndex, 0, movedEntry);
        await persistConfig();
      }
    });

    return { wrapper, nextColor: colorIndex };
  }

  function createGroupButtonColorInlineControl(dashboard, group, groupIndex) {
    const wrapper = document.createElement("div");
    wrapper.className = "group-button-color-inline";

    const label = document.createElement("span");
    label.className = "group-button-color-inline-label";
    label.textContent = "Button Color";

    const pickerInput = document.createElement("input");
    pickerInput.type = "color";
    pickerInput.setAttribute("aria-label", `Button color for group ${group.title || "group"}`);

    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.maxLength = 7;
    codeInput.placeholder = DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor;
    codeInput.className = "input";
    codeInput.setAttribute("inputmode", "text");
    codeInput.setAttribute("aria-label", `Button color code for group ${group.title || "group"}`);

    const fallbackColor =
      normalizeHexColor(dashboard && dashboard.buttonSolidColor) || DEFAULT_BUTTON_COLOR_OPTIONS.buttonSolidColor;
    const getEffectiveValue = () => normalizeHexColor(group && group.buttonSolidColor) || fallbackColor;

    const setFields = (value) => {
      const normalized = normalizeHexColor(value) || fallbackColor;
      pickerInput.value = normalized;
      codeInput.value = normalized;
    };

    const persistGroupButtonColor = () => {
      persistConfig("Tab settings updated.").catch((error) => {
        console.error(error);
        showMessage("Failed to update tab settings.", "is-danger");
      });
    };

    setFields(getEffectiveValue());

    pickerInput.addEventListener("input", () => {
      const normalized = normalizeHexColor(pickerInput.value) || fallbackColor;
      group.buttonSolidColor = normalized;
      codeInput.value = normalized;
    });

    pickerInput.addEventListener("change", () => {
      const normalized = normalizeHexColor(pickerInput.value) || fallbackColor;
      group.buttonSolidColor = normalized;
      renderGroupsEditor();
      persistGroupButtonColor();
    });

    codeInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      codeInput.blur();
    });

    codeInput.addEventListener("input", () => {
      const normalized = normalizeHexColorLoose(codeInput.value);
      if (!normalized) {
        return;
      }
      pickerInput.value = normalized;
      group.buttonSolidColor = normalized;
    });

    codeInput.addEventListener("blur", () => {
      const normalized = normalizeHexColorLoose(codeInput.value);
      if (!normalized) {
        setFields(getEffectiveValue());
        return;
      }
      group.buttonSolidColor = normalized;
      setFields(normalized);
      renderGroupsEditor();
      persistGroupButtonColor();
    });

    wrapper.appendChild(label);
    wrapper.appendChild(pickerInput);
    wrapper.appendChild(codeInput);
    return wrapper;
  }

  function renderGroupsEditor() {
    groupsEditor.innerHTML = "";
    const dashboard = getActiveDashboard();
    const previewDashboard = getButtonColorPreviewDashboard(dashboard);
    const showPerGroupButtonColors =
      DashboardCommon.normalizeButtonColorMode(previewDashboard && previewDashboard.buttonColorMode) === "solid-per-group";

    if (!dashboard.groups.length) {
      bindPointerSortable(groupsEditor, {
        itemSelector: "[data-group-sort-item]",
        handleSelector: ".group-drag-handle",
        axis: "vertical",
        errorMessage: "Failed to reorder groups.",
        onReorder: async (fromIndex, toIndex) => {
          const activeDashboard = getActiveDashboard();
          if (!activeDashboard) {
            throw new Error("Dashboard not found.");
          }
          if (!moveArrayItem(activeDashboard.groups, fromIndex, toIndex)) {
            return;
          }
          await persistConfig();
        }
      });
      return;
    }

    let colorIndex = 0;

    dashboard.groups.forEach((group, groupIndex) => {
      const box = document.createElement("section");
      box.className = `box group-box${group.groupEnd ? " group-end" : ""}`;
      box.setAttribute("data-group-sort-item", "");
      box.setAttribute("data-group-id", group.id);

      const header = document.createElement("div");
      header.className = "group-head";

      const headerMain = document.createElement("div");
      headerMain.className = "group-head-main";
      const dragHandle = createDragHandleButton(
        "group-drag-handle",
        `Drag to reorder group ${group.title || "group"}`
      );

      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "input group-title-input";
      titleInput.maxLength = 80;
      titleInput.value = group.title;
      titleInput.placeholder = "Group title";
      titleInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        titleInput.blur();
      });
      titleInput.addEventListener("blur", () => {
        const trimmed = titleInput.value.trim();
        if (!trimmed) {
          titleInput.value = group.title;
          showMessage("Group title cannot be empty.", "is-danger");
          return;
        }

        if (trimmed === group.title) {
          return;
        }

        dashboard.groups[groupIndex].title = trimmed;
        persistConfig("Group updated.").catch((error) => {
          console.error(error);
          showMessage("Failed to update group title.", "is-danger");
        });
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "button is-danger is-light is-small group-delete-btn";
      deleteBtn.textContent = "Delete group";
      deleteBtn.title = "Delete group";
      deleteBtn.setAttribute("aria-label", "Delete group");
      deleteBtn.addEventListener("click", () => openDeleteGroupModal(dashboard, group));

      headerMain.appendChild(dragHandle);
      headerMain.appendChild(titleInput);
      if (showPerGroupButtonColors) {
        headerMain.appendChild(createGroupButtonColorInlineControl(previewDashboard, group, groupIndex));
      }
      headerMain.appendChild(deleteBtn);
      header.appendChild(headerMain);
      box.appendChild(header);

      const buttons = renderGroupButtons(previewDashboard, group, groupIndex, colorIndex);
      colorIndex = buttons.nextColor;
      box.appendChild(buttons.wrapper);

      groupsEditor.appendChild(box);
    });

    bindPointerSortable(groupsEditor, {
      itemSelector: "[data-group-sort-item]",
      handleSelector: ".group-drag-handle",
      axis: "vertical",
      errorMessage: "Failed to reorder groups.",
      onReorder: async (fromIndex, toIndex) => {
        const activeDashboard = getActiveDashboard();
        if (!activeDashboard) {
          throw new Error("Dashboard not found.");
        }
        if (!moveArrayItem(activeDashboard.groups, fromIndex, toIndex)) {
          return;
        }
        await persistConfig();
      }
    });
  }

  function renderEditor() {
    ensureActiveDashboard();
    const dashboard = getActiveDashboard();
    pageTitleInput.value = dashboard ? dashboard.label : "";
    refreshInternalLinksSettingsControls(dashboard);
    if (showLinkToggleCheckbox) {
      showLinkToggleCheckbox.checked = Boolean(
        dashboard && dashboard.enableInternalLinks && dashboard.showLinkModeToggle !== false
      );
    }
    setThemeColorControlValue(getThemeColorControl("backgroundColor"), normalizeHexColor(dashboard && dashboard.backgroundColor));
    setThemeColorControlValue(getThemeColorControl("groupBackgroundColor"), normalizeHexColor(dashboard && dashboard.groupBackgroundColor));
    setThemeColorControlValue(getThemeColorControl("textColor"), normalizeHexColor(dashboard && dashboard.textColor));
    setThemeColorControlValue(getThemeColorControl("buttonTextColor"), normalizeHexColor(dashboard && dashboard.buttonTextColor));
    setThemeColorControlValue(getThemeColorControl("tabColor"), normalizeHexColor(dashboard && dashboard.tabColor));
    setThemeColorControlValue(getThemeColorControl("activeTabColor"), normalizeHexColor(dashboard && dashboard.activeTabColor));
    setThemeColorControlValue(getThemeColorControl("tabTextColor"), normalizeHexColor(dashboard && dashboard.tabTextColor));
    setThemeColorControlValue(
      getThemeColorControl("activeTabTextColor"),
      normalizeHexColor(dashboard && dashboard.activeTabTextColor)
    );
    setButtonColorControlsFromDashboard(dashboard);
    renderThemePresetOptions();
    applyAdminThemePreview();
    refreshButtonModalLinkFields();
    if (deleteDashboardBtn) {
      const canDelete = config.dashboards.length > 1;
      deleteDashboardBtn.disabled = !canDelete;
      deleteDashboardBtn.title = canDelete ? "Delete current tab" : "At least one dashboard is required";
    }
    updatePreviewModeButtons();
    renderMainTabs();
    renderGroupsEditor();
    syncCurrentUsernameField();
    applyFirstRunSetupState();
  }

  async function loadConfigAndRender() {
    config = await DashboardCommon.getConfig();
    config = DashboardCommon.normalizeConfig(config);
    ensureActiveDashboard();
    renderEditor();
  }

  async function saveActiveTabTitle() {
    hideMessage();

    const tabTitle = pageTitleInput.value.trim();
    if (!tabTitle) {
      showMessage("Tab title cannot be empty.", "is-danger");
      const activeDashboard = getActiveDashboard();
      if (activeDashboard) {
        pageTitleInput.value = activeDashboard.label;
      }
      return;
    }

    const dashboard = getActiveDashboard();
    if (!dashboard) {
      showMessage("Dashboard not found.", "is-danger");
      return;
    }

    if (dashboard.label === tabTitle) {
      return;
    }

    dashboard.label = tabTitle;
    await persistConfig("Tab title updated.");
  }

  async function saveActiveDashboardSettings(options = {}) {
    hideMessage();
    const silentSuccess = Boolean(options && options.silentSuccess);

    const dashboard = getActiveDashboard();
    if (!dashboard) {
      showMessage("Dashboard not found.", "is-danger");
      return;
    }

    const nextDashboardBg = readThemeColorControlValue(getThemeColorControl("backgroundColor"));
    const nextGroupBg = readThemeColorControlValue(getThemeColorControl("groupBackgroundColor"));
    const nextTextColor = readThemeColorControlValue(getThemeColorControl("textColor"));
    const nextButtonTextColor = readThemeColorControlValue(getThemeColorControl("buttonTextColor"));
    const nextTabColor = readThemeColorControlValue(getThemeColorControl("tabColor"));
    const nextActiveTabColor = readThemeColorControlValue(getThemeColorControl("activeTabColor"));
    const nextTabTextColor = readThemeColorControlValue(getThemeColorControl("tabTextColor"));
    const nextActiveTabTextColor = readThemeColorControlValue(getThemeColorControl("activeTabTextColor"));
    const nextButtonColorSettings = readButtonColorSettingsFromControls();
    const nextEnableInternalLinks = enableInternalLinksCheckbox ? enableInternalLinksCheckbox.checked : false;
    const previousShowLinkToggle = Boolean(dashboard.showLinkModeToggle !== false);
    const nextShowLinkToggle = showLinkToggleCheckbox ? showLinkToggleCheckbox.checked : previousShowLinkToggle;

    const changed =
      Boolean(dashboard.enableInternalLinks) !== Boolean(nextEnableInternalLinks) ||
      Boolean(dashboard.showLinkModeToggle !== false) !== Boolean(nextShowLinkToggle) ||
      normalizeHexColor(dashboard.textColor) !== nextTextColor ||
      normalizeHexColor(dashboard.buttonTextColor) !== nextButtonTextColor ||
      normalizeHexColor(dashboard.tabColor) !== nextTabColor ||
      normalizeHexColor(dashboard.activeTabColor) !== nextActiveTabColor ||
      normalizeHexColor(dashboard.tabTextColor) !== nextTabTextColor ||
      normalizeHexColor(dashboard.activeTabTextColor) !== nextActiveTabTextColor ||
      normalizeHexColor(dashboard.backgroundColor) !== nextDashboardBg ||
      normalizeHexColor(dashboard.groupBackgroundColor) !== nextGroupBg ||
      DashboardCommon.normalizeButtonColorMode(dashboard.buttonColorMode) !== nextButtonColorSettings.buttonColorMode ||
      clampInteger(dashboard.buttonCycleHueStep, 1, 180, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleHueStep) !==
        nextButtonColorSettings.buttonCycleHueStep ||
      clampInteger(dashboard.buttonCycleSaturation, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleSaturation) !==
        nextButtonColorSettings.buttonCycleSaturation ||
      clampInteger(dashboard.buttonCycleLightness, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleLightness) !==
        nextButtonColorSettings.buttonCycleLightness ||
      normalizeHexColor(dashboard.buttonSolidColor) !== nextButtonColorSettings.buttonSolidColor;

    if (!changed) {
      return;
    }

    dashboard.enableInternalLinks = Boolean(nextEnableInternalLinks);
    dashboard.showLinkModeToggle = Boolean(nextShowLinkToggle);
    dashboard.textColor = nextTextColor;
    dashboard.buttonTextColor = nextButtonTextColor;
    dashboard.tabColor = nextTabColor;
    dashboard.activeTabColor = nextActiveTabColor;
    dashboard.tabTextColor = nextTabTextColor;
    dashboard.activeTabTextColor = nextActiveTabTextColor;
    dashboard.backgroundColor = nextDashboardBg;
    dashboard.groupBackgroundColor = nextGroupBg;
    dashboard.buttonColorMode = nextButtonColorSettings.buttonColorMode;
    dashboard.buttonCycleHueStep = nextButtonColorSettings.buttonCycleHueStep;
    dashboard.buttonCycleSaturation = nextButtonColorSettings.buttonCycleSaturation;
    dashboard.buttonCycleLightness = nextButtonColorSettings.buttonCycleLightness;
    dashboard.buttonSolidColor = nextButtonColorSettings.buttonSolidColor;
    await persistConfig(silentSuccess ? "" : "Tab settings updated.");
  }

  async function autoSaveButtonFromModal(showErrors = true) {
    const dashboardIndex = getDashboardIndex(buttonModalState.dashboardId);
    if (dashboardIndex < 0) {
      if (showErrors) {
        showMessage("Dashboard not found.", "is-danger");
      }
      return "error";
    }
    const dashboard = config.dashboards[dashboardIndex];

    const groupIndex = getGroupIndex(dashboard, buttonModalState.sourceGroupId);
    if (groupIndex < 0) {
      if (showErrors) {
        showMessage("Group not found.", "is-danger");
      }
      return "error";
    }

    const draft = readButtonModalDraft();

    if (buttonModalState.isNew && !draft.hasAnyInput) {
      return "unchanged";
    }

    const validationError = validateButtonModalDraft(draft, buttonModalState.isNew);
    if (validationError) {
      if (showErrors) {
        showMessage(validationError, "is-danger");
      }
      return "invalid";
    }

    let buttonEntry;
    let isNew = false;

    if (buttonModalState.isNew) {
      buttonEntry = {
        id: DashboardCommon.createId("button"),
        name: "",
        icon: "",
        iconData: "",
        links: { external: "", internal: "" }
      };
      isNew = true;
    } else {
      const position = getButtonPosition(dashboard, buttonModalState.buttonId);
      if (!position) {
        if (showErrors) {
          showMessage("Button not found.", "is-danger");
        }
        return "error";
      }
      buttonEntry = dashboard.groups[position.groupIndex].entries[position.buttonIndex];
    }

    const previousName = buttonEntry.name || "";
    const previousIcon = buttonEntry.icon || "";
    const previousIconData = buttonEntry.iconData || "";
    const previousExternal =
      buttonEntry.links && typeof buttonEntry.links.external === "string" ? buttonEntry.links.external : "";
    const previousInternal =
      buttonEntry.links && typeof buttonEntry.links.internal === "string" ? buttonEntry.links.internal : "";

    buttonEntry.name = draft.name;
    buttonEntry.icon = draft.icon;
    buttonEntry.links = buttonEntry.links && typeof buttonEntry.links === "object" ? buttonEntry.links : {};
    buttonEntry.links.external = draft.externalUrl;
    buttonEntry.links.internal = draft.internalUrl;

    if (draft.clearIconData) {
      buttonEntry.iconData = "";
    } else if (draft.uploadedIcon) {
      try {
        buttonEntry.iconData = await readFileAsDataUrl(draft.uploadedIcon);
        if (!buttonEntry.icon) {
          buttonEntry.icon = draft.uploadedIcon.name;
        }
      } catch (error) {
        console.error(error);
        if (showErrors) {
          showMessage("Failed to read uploaded icon.", "is-danger");
        }
        return "error";
      }
    } else {
      buttonEntry.iconData = buttonModalState.modalIconData || "";
    }

    const changed =
      isNew ||
      previousName !== buttonEntry.name ||
      previousIcon !== buttonEntry.icon ||
      previousIconData !== (buttonEntry.iconData || "") ||
      previousExternal !== buttonEntry.links.external ||
      previousInternal !== buttonEntry.links.internal ||
      draft.clearIconData ||
      Boolean(draft.uploadedIcon);

    if (!changed) {
      return "unchanged";
    }

    if (isNew) {
      dashboard.groups[groupIndex].entries.push(buttonEntry);
      buttonModalState.isNew = false;
      buttonModalState.buttonId = buttonEntry.id;
      entryDeleteBtn.disabled = false;
      entryIconInput.disabled = false;
      entryIconInput.classList.remove("is-disabled");
      if (entryIconInputHint) {
        entryIconInputHint.classList.add("is-hidden");
      }
    }

    entryIconUpload.value = "";
    entryClearIconData.checked = false;
    buttonModalState.modalIconData = buttonEntry.iconData || "";
    renderEntryIconPreview();
    refreshEntryIconFilenameFieldVisibility();
    await persistConfig(isNew ? "Button added." : "Button updated.");
    entryModalTitle.textContent = `Edit Button: ${buttonEntry.name}`;
    return "saved";
  }

  pageTitleInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    pageTitleInput.blur();
  });

  pageTitleInput.addEventListener("blur", () => {
    saveActiveTabTitle().catch((error) => {
      console.error(error);
      showMessage("Failed to update tab title.", "is-danger");
    });
  });

  themeColorControls.forEach((control) => {
    if (control.swatchEl && control.pickerInput) {
      control.swatchEl.addEventListener("click", () => {
        control.pickerInput.click();
      });
    }

    if (control.pickerInput) {
      control.pickerInput.addEventListener("input", () => {
        setThemeColorControlValue(control, control.pickerInput.value);
        applyAdminThemePreview();
      });
      control.pickerInput.addEventListener("change", () => {
        setThemeColorControlValue(control, control.pickerInput.value);
        applyAdminThemePreview();
        saveActiveDashboardSettings().catch((error) => {
          console.error(error);
          showMessage("Failed to update tab settings.", "is-danger");
        });
      });
    }

    if (control.codeInput) {
      control.codeInput.addEventListener("input", () => {
        handleThemeColorCodeInput(control);
      });
      control.codeInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        control.codeInput.blur();
      });
      control.codeInput.addEventListener("blur", () => {
        commitThemeColorCodeInput(control);
      });
    }

    if (control.pasteBtn) {
      control.pasteBtn.addEventListener("click", () => {
        pasteHexColorIntoControl(control).catch((error) => {
          console.error(error);
          showMessage(error.message || "Failed to paste color.", "is-danger");
        });
      });
    }
  });

  if (buttonSolidColorControl.swatchEl && buttonSolidColorControl.pickerInput) {
    buttonSolidColorControl.swatchEl.addEventListener("click", () => {
      buttonSolidColorControl.pickerInput.click();
    });
  }

  if (buttonSolidColorControl.pickerInput) {
    buttonSolidColorControl.pickerInput.addEventListener("input", () => {
      setThemeColorControlValue(buttonSolidColorControl, buttonSolidColorControl.pickerInput.value);
      renderGroupsEditor();
    });
    buttonSolidColorControl.pickerInput.addEventListener("change", () => {
      setThemeColorControlValue(buttonSolidColorControl, buttonSolidColorControl.pickerInput.value);
      renderGroupsEditor();
      saveActiveDashboardSettings().catch((error) => {
        console.error(error);
        showMessage("Failed to update tab settings.", "is-danger");
      });
    });
  }

  if (buttonSolidColorControl.codeInput) {
    buttonSolidColorControl.codeInput.addEventListener("input", () => {
      handleThemeColorCodeInput(buttonSolidColorControl);
      renderGroupsEditor();
    });
    buttonSolidColorControl.codeInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      buttonSolidColorControl.codeInput.blur();
    });
    buttonSolidColorControl.codeInput.addEventListener("blur", () => {
      commitThemeColorCodeInput(buttonSolidColorControl);
      renderGroupsEditor();
    });
  }

  if (buttonSolidColorControl.pasteBtn) {
    buttonSolidColorControl.pasteBtn.addEventListener("click", () => {
      pasteHexColorIntoControl(buttonSolidColorControl)
        .then(() => {
          renderGroupsEditor();
        })
        .catch((error) => {
          console.error(error);
          showMessage(error.message || "Failed to paste color.", "is-danger");
        });
    });
  }

  const buttonCycleNumericInputs = [buttonCycleHueStepInput, buttonCycleSaturationInput, buttonCycleLightnessInput].filter(Boolean);
  buttonCycleNumericInputs.forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      input.blur();
    });
    input.addEventListener("input", () => {
      renderGroupsEditor();
    });
    input.addEventListener("change", () => {
      renderGroupsEditor();
      saveActiveDashboardSettings().catch((error) => {
        console.error(error);
        showMessage("Failed to update tab settings.", "is-danger");
      });
    });
    input.addEventListener("blur", () => {
      if (input === buttonCycleHueStepInput) {
        input.value = String(clampInteger(input.value, 1, 180, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleHueStep));
      } else if (input === buttonCycleSaturationInput) {
        input.value = String(clampInteger(input.value, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleSaturation));
      } else if (input === buttonCycleLightnessInput) {
        input.value = String(clampInteger(input.value, 0, 100, DEFAULT_BUTTON_COLOR_OPTIONS.buttonCycleLightness));
      }
    });
  });

  if (buttonColorModeSelect) {
    buttonColorModeSelect.addEventListener("change", () => {
      refreshButtonColorModeControlsUI();
      renderGroupsEditor();
      saveActiveDashboardSettings().catch((error) => {
        console.error(error);
        showMessage("Failed to update tab settings.", "is-danger");
      });
    });
  }

  if (liveColorEditorToggleBtn && liveColorEditorPanel) {
    updateThemeEditorToggleButtonLabel();
    liveColorEditorToggleBtn.setAttribute(
      "aria-expanded",
      liveColorEditorPanel.classList.contains("is-hidden") ? "false" : "true"
    );
    liveColorEditorToggleBtn.addEventListener("click", () => {
      const isHidden = liveColorEditorPanel.classList.toggle("is-hidden");
      liveColorEditorToggleBtn.setAttribute("aria-expanded", isHidden ? "false" : "true");
      updateThemeEditorToggleButtonLabel();
    });
  }

  if (resetThemeColorsBtn) {
    resetThemeColorsBtn.addEventListener("click", () => {
      Object.entries(buildDefaultThemeValues()).forEach(([key, value]) => {
        const control = getThemeColorControl(key);
        if (control) {
          setThemeColorControlValue(control, value);
        }
      });
      applyAdminThemePreview();
      saveActiveDashboardSettings().catch((error) => {
        console.error(error);
        showMessage("Failed to reset tab colors.", "is-danger");
      });
    });
  }

  if (themePresetSelect) {
    themePresetSelect.addEventListener("change", () => {
      if (themePresetSelect.dataset) {
        themePresetSelect.dataset.lastValue = themePresetSelect.value || "";
      }
      const preset = getSelectedThemePreset();
      if (preset && themePresetNameInput) {
        themePresetNameInput.value = getNextCustomThemePresetName();
      }
      refreshThemePresetButtons();
      if (!preset) {
        return;
      }
      loadSelectedThemePreset().catch((error) => {
        console.error(error);
        showMessage("Failed to load theme preset.", "is-danger");
      });
    });
  }

  if (themePresetPreviewBtn) {
    themePresetPreviewBtn.addEventListener("click", () => {
      previewSelectedThemePreset();
    });
  }

  if (themePresetApplyBtn) {
    themePresetApplyBtn.addEventListener("click", () => {
      loadSelectedThemePreset().catch((error) => {
        console.error(error);
        showMessage("Failed to load theme preset.", "is-danger");
      });
    });
  }

  if (themePresetDeleteBtn) {
    themePresetDeleteBtn.addEventListener("click", () => {
      deleteSelectedThemePreset().catch((error) => {
        console.error(error);
        showMessage("Failed to delete theme preset.", "is-danger");
      });
    });
  }

  if (themePresetSaveBtn) {
    themePresetSaveBtn.addEventListener("click", () => {
      saveCurrentThemePreset().catch((error) => {
        console.error(error);
        showMessage("Failed to save theme preset.", "is-danger");
      });
    });
  }

  if (themePresetNameInput) {
    themePresetNameInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      if (themePresetSaveBtn) {
        themePresetSaveBtn.click();
      }
    });
  }

  if (showLinkToggleCheckbox) {
    showLinkToggleCheckbox.addEventListener("change", () => {
      saveActiveDashboardSettings().catch((error) => {
        console.error(error);
        showMessage("Failed to update tab settings.", "is-danger");
      });
    });
  }

  if (enableInternalLinksCheckbox) {
    enableInternalLinksCheckbox.addEventListener("change", () => {
      if (enableInternalLinksCheckbox.checked && showLinkToggleCheckbox && !showLinkToggleCheckbox.checked) {
        showLinkToggleCheckbox.checked = true;
      }
      refreshInternalLinksSettingsControls(getActiveDashboard(), enableInternalLinksCheckbox.checked);
      refreshButtonModalLinkFields(enableInternalLinksCheckbox.checked);
      saveActiveDashboardSettings().catch((error) => {
        console.error(error);
        showMessage("Failed to update tab settings.", "is-danger");
      });
    });
  }

  if (previewModeToggle) {
    previewModeToggle.addEventListener("change", () => {
      setPreviewMode(previewModeToggle.checked ? "internal" : "external");
      renderGroupsEditor();
    });
  }

  accountLinkBtn.addEventListener("click", () => {
    setAccountPaneOpen(!accountPaneOpen);
  });

  accountCloseBtn.addEventListener("click", () => {
    setAccountPaneOpen(false);
  });

  accountPane.querySelector(".modal-background").addEventListener("click", () => {
    setAccountPaneOpen(false);
  });

  deleteDashboardBtn.addEventListener("click", () => {
    hideMessage();

    if (config.dashboards.length <= 1) {
      showMessage("At least one dashboard is required.", "is-danger");
      return;
    }

    const dashboard = getActiveDashboard();
    if (!dashboard) {
      showMessage("Dashboard not found.", "is-danger");
      return;
    }

    openDeleteDashboardModal(dashboard);
  });

  if (resetStarterConfigBtn) {
    resetStarterConfigBtn.addEventListener("click", () => {
      hideMessage();
      openResetStarterConfigModal();
    });
  }

  addGroupBtn.addEventListener("click", () => {
    hideMessage();
    openAddGroupModal();
  });

  if (entryIconSearchBtn) {
    entryIconSearchBtn.addEventListener("click", () => {
      runIconSearch().catch((error) => {
        console.error(error);
        setEntryIconSearchStatus("Icon search failed.", "has-text-danger");
        showMessage(error.message || "Icon search failed.", "is-danger");
      });
    });
  }

  if (entryIconSearchInput) {
    entryIconSearchInput.addEventListener("input", () => {
      scheduleIconSearch();
    });
    entryIconSearchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      clearIconSearchDebounce();
      runIconSearch().catch((error) => {
        console.error(error);
        setEntryIconSearchStatus("Icon search failed.", "has-text-danger");
        showMessage(error.message || "Icon search failed.", "is-danger");
      });
    });
  }

  if (entryIconSourceSelect) {
    entryIconSourceSelect.addEventListener("change", () => {
      clearEntryIconSearchResults();
      setEntryIconSearchStatus(
        `Selected ${getIconSearchSourceLabel(getSelectedIconSearchSource())}. Type to search and import an icon (stored locally in your dashboard config).`,
        "muted"
      );
      if (entryIconSearchInput && entryIconSearchInput.value.trim().length >= 2) {
        scheduleIconSearch(100);
      }
    });
  }

  entrySaveBtn.addEventListener("click", () => {
    const wasNewBeforeSave = buttonModalState.isNew;
    autoSaveButtonFromModal(true)
      .then((result) => {
        if (result === "saved" && wasNewBeforeSave) {
          closeButtonModal();
          return;
        }
        if (result === "unchanged" && !wasNewBeforeSave) {
          closeButtonModal();
        }
      })
      .catch((error) => {
        console.error(error);
        showMessage("Failed to save button.", "is-danger");
      });
  });

  entryCloseBtn.addEventListener("click", () => {
    closeButtonModal();
  });

  if (entryCancelBtn) {
    entryCancelBtn.addEventListener("click", () => {
      closeButtonModal();
    });
  }

  if (entryExternalUrlPasteBtn) {
    entryExternalUrlPasteBtn.addEventListener("click", () => {
      pasteTextIntoInput(entryExternalUrlInput, "External URL").catch((error) => {
        console.error(error);
        showMessage(error.message || "Failed to paste URL.", "is-danger");
      });
    });
  }

  if (entryInternalUrlPasteBtn) {
    entryInternalUrlPasteBtn.addEventListener("click", () => {
      pasteTextIntoInput(entryInternalUrlInput, "Internal URL").catch((error) => {
        console.error(error);
        showMessage(error.message || "Failed to paste URL.", "is-danger");
      });
    });
  }

  entryModal.querySelector(".modal-background").addEventListener("click", () => {
    closeButtonModal();
  });

  [entryNameInput, entryIconInput, entryExternalUrlInput, entryInternalUrlInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      input.blur();
    });

    input.addEventListener("blur", () => {
      if (input === entryIconInput) {
        renderEntryIconPreview();
        refreshEntryIconFilenameFieldVisibility();
      }
    });
  });

  entryIconInput.addEventListener("input", () => {
    renderEntryIconPreview();
    refreshEntryIconFilenameFieldVisibility();
  });

  entryClearIconData.addEventListener("change", () => {
    renderEntryIconPreview();
    refreshEntryIconFilenameFieldVisibility();
  });

  entryIconUpload.addEventListener("change", () => {
    const file = entryIconUpload.files && entryIconUpload.files[0];
    if (!file) {
      renderEntryIconPreview();
      refreshEntryIconFilenameFieldVisibility();
      return;
    }

    if (!buttonModalState.isNew && !entryIconInput.value.trim()) {
      entryIconInput.value = file.name;
    }

    readFileAsDataUrl(file)
      .then((dataUrl) => {
        buttonModalState.modalIconData = dataUrl;
        entryClearIconData.checked = false;
        renderEntryIconPreview();
        refreshEntryIconFilenameFieldVisibility();
      })
      .catch((error) => {
        console.error(error);
        showMessage("Failed to preview uploaded icon.", "is-danger");
      });
  });

  groupActionCancelBtn.addEventListener("click", () => {
    closeActionModal();
  });

  groupActionModal.querySelector(".modal-background").addEventListener("click", () => {
    closeActionModal();
  });

  groupActionTitleInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    groupActionConfirmBtn.click();
  });

  groupActionConfirmBtn.addEventListener("click", async () => {
    hideMessage();

    if (actionModalState.mode === "reset-starter-config") {
      const previousConfig = DashboardCommon.clone(config);
      const previousActiveDashboardId = activeDashboardId;
      try {
        const starterConfig = await DashboardCommon.fetchDefaultConfig();
        config = DashboardCommon.clone(starterConfig);
        ensureActiveDashboard();
        closeActionModal();
        await persistConfig("Starter config restored.");
      } catch (error) {
        config = previousConfig;
        activeDashboardId = previousActiveDashboardId;
        ensureActiveDashboard();
        renderEditor();
        console.error(error);
        showMessage(error.message || "Failed to reset to starter config.", "is-danger");
      }
      return;
    }

    if (actionModalState.mode === "add-dashboard") {
      const label = groupActionTitleInput.value.trim();
      if (!label) {
        showMessage("Tab title cannot be empty.", "is-danger");
        return;
      }

      const dashboard = {
        id: DashboardCommon.createId("dashboard"),
        label,
        ...buildDefaultThemeValues({ preferSavedDefaultTheme: true }),
        enableInternalLinks: false,
        showLinkModeToggle: true,
        themePresets: [],
        groups: []
      };

      config.dashboards.push(dashboard);
      activeDashboardId = dashboard.id;
      closeActionModal();
      await persistConfig("Dashboard added.");
      return;
    }

    if (actionModalState.mode === "add-group") {
      const title = groupActionTitleInput.value.trim();
      if (!title) {
        showMessage("Group title cannot be empty.", "is-danger");
        return;
      }

      const dashboardIndex = getDashboardIndex(actionModalState.dashboardId);
      if (dashboardIndex < 0) {
        closeActionModal();
        showMessage("Dashboard not found.", "is-danger");
        return;
      }

      config.dashboards[dashboardIndex].groups.push({
        id: DashboardCommon.createId("group"),
        title,
        groupEnd: true,
        entries: []
      });

      closeActionModal();
      await persistConfig("Group added.");
      return;
    }

    if (actionModalState.mode === "delete-group") {
      const dashboardIndex = getDashboardIndex(actionModalState.dashboardId);
      if (dashboardIndex < 0) {
        closeActionModal();
        showMessage("Dashboard not found.", "is-danger");
        return;
      }

      const dashboard = config.dashboards[dashboardIndex];
      const groupIndex = getGroupIndex(dashboard, actionModalState.groupId);
      if (groupIndex < 0) {
        closeActionModal();
        showMessage("Group not found.", "is-danger");
        return;
      }

      dashboard.groups.splice(groupIndex, 1);
      closeActionModal();
      await persistConfig("Group deleted.");
      return;
    }

    if (actionModalState.mode === "delete-button") {
      const dashboardIndex = getDashboardIndex(actionModalState.dashboardId);
      if (dashboardIndex < 0) {
        closeActionModal();
        showMessage("Dashboard not found.", "is-danger");
        return;
      }

      const dashboard = config.dashboards[dashboardIndex];
      const groupIndex = getGroupIndex(dashboard, actionModalState.groupId);
      if (groupIndex < 0) {
        closeActionModal();
        showMessage("Group not found.", "is-danger");
        return;
      }

      const group = dashboard.groups[groupIndex];
      const buttonIndex = group.entries.findIndex((entry) => entry.id === actionModalState.buttonId);
      if (buttonIndex < 0) {
        closeActionModal();
        showMessage("Button not found.", "is-danger");
        return;
      }

      group.entries.splice(buttonIndex, 1);
      closeButtonModal();
      closeActionModal();
      await persistConfig("Button deleted.");
      return;
    }

    if (actionModalState.mode === "delete-dashboard") {
      if (config.dashboards.length <= 1) {
        closeActionModal();
        showMessage("At least one dashboard is required.", "is-danger");
        return;
      }

      const dashboardIndex = getDashboardIndex(actionModalState.dashboardId);
      if (dashboardIndex < 0) {
        closeActionModal();
        showMessage("Dashboard not found.", "is-danger");
        return;
      }

      config.dashboards.splice(dashboardIndex, 1);
      if (activeDashboardId === actionModalState.dashboardId) {
        activeDashboardId = config.dashboards[0].id;
      }

      closeActionModal();
      await persistConfig("Dashboard deleted.");
    }
  });

  entryDeleteBtn.addEventListener("click", () => {
    if (buttonModalState.isNew || !buttonModalState.buttonId) {
      return;
    }

    const dashboardIndex = getDashboardIndex(buttonModalState.dashboardId);
    if (dashboardIndex < 0) {
      showMessage("Dashboard not found.", "is-danger");
      return;
    }

    const dashboard = config.dashboards[dashboardIndex];
    const groupIndex = getGroupIndex(dashboard, buttonModalState.sourceGroupId);
    if (groupIndex < 0) {
      showMessage("Group not found.", "is-danger");
      return;
    }

    const group = dashboard.groups[groupIndex];
    const buttonEntry = group.entries.find((entry) => entry.id === buttonModalState.buttonId);
    if (!buttonEntry) {
      showMessage("Button not found.", "is-danger");
      return;
    }

    openDeleteButtonModal(dashboard, group, buttonEntry);
  });

  usernameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const currentPassword = usernameCurrentPasswordInput.value;
    const requestedUsername = newUsernameInput.value.trim();

    if (!requestedUsername) {
      showMessage("New username is required.", "is-danger");
      return;
    }

    if (requestedUsername.length < 3) {
      showMessage("Username must be at least 3 characters.", "is-danger");
      return;
    }

    if (!currentPassword) {
      showMessage("Current password is required.", "is-danger");
      return;
    }

    if (requestedUsername === authUser) {
      showMessage("Username unchanged.", "is-success");
      return;
    }

    try {
      const result = await DashboardCommon.changeUsername(currentPassword, requestedUsername);
      authUser = result.username || requestedUsername;
      syncCurrentUsernameField();
      newUsernameInput.value = "";
      usernameCurrentPasswordInput.value = "";
      showMessage("Username changed.", "is-success");
    } catch (error) {
      showMessage(error.message || "Failed to change username.", "is-danger");
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!currentPassword || !newPassword) {
      showMessage("Current and new password are required.", "is-danger");
      return;
    }

    if (newPassword.length < 4) {
      showMessage("New password must be at least 4 characters.", "is-danger");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("New password confirmation does not match.", "is-danger");
      return;
    }

    try {
      const result = await DashboardCommon.changePassword(currentPassword, newPassword);
      authMustChangePassword = Boolean(result && result.mustChangePassword);
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
      applyFirstRunSetupState();
      if (!authMustChangePassword) {
        setAccountPaneOpen(false);
      }
      showMessage("Password changed.", "is-success");
    } catch (error) {
      showMessage(error.message || "Failed to change password.", "is-danger");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    hideMessage();

    try {
      await DashboardCommon.logout();
    } catch (error) {
      console.warn(error);
    }

    authUser = "";
    showLoginView();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (!username || !password) {
      showMessage("Username and password are required.", "is-danger");
      return;
    }

    try {
      const result = await DashboardCommon.login(username, password);
      authUser = result.username || username;
      authSetupRequired = false;
      authMustChangePassword = Boolean(result && result.mustChangePassword);
      showAdminView();
      await loadConfigAndRender();
      if (authMustChangePassword) {
        setAccountPaneOpen(true);
        showMessage("First-time setup: change the account password before editing the dashboard.", "is-warning");
      }
    } catch (error) {
      if (error && error.status === 409 && error.payload && error.payload.setupRequired) {
        authSetupRequired = true;
        showLoginView();
        showMessage("Create the first admin account to continue.", "is-warning");
        return;
      }
      showMessage(error.message || "Login failed.", "is-danger");
    }
  });

  if (bootstrapForm) {
    bootstrapForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage();

      const username = bootstrapUsername.value.trim();
      const password = bootstrapPassword.value;
      const confirmPassword = bootstrapConfirmPassword.value;

      if (!username || !password) {
        showMessage("Username and password are required.", "is-danger");
        return;
      }

      if (password.length < 4) {
        showMessage("Password must be at least 4 characters.", "is-danger");
        return;
      }

      if (password !== confirmPassword) {
        showMessage("Password confirmation does not match.", "is-danger");
        return;
      }

      try {
        const result = await DashboardCommon.bootstrapAdmin(username, password);
        authUser = result.username || username;
        authSetupRequired = false;
        authMustChangePassword = false;
        bootstrapPassword.value = "";
        bootstrapConfirmPassword.value = "";
        showAdminView();
        await loadConfigAndRender();
        showMessage("Admin account created.", "is-success");
      } catch (error) {
        if (error && error.status === 409 && error.payload && error.payload.setupRequired === false) {
          authSetupRequired = false;
          showLoginView();
          showMessage("An admin account already exists. Please log in.", "is-warning");
          return;
        }
        if (error && error.status === 409) {
          authSetupRequired = false;
          showLoginView();
        }
        showMessage(error.message || "Failed to create admin account.", "is-danger");
      }
    });
  }

  async function boot() {
    normalizeEditorUrlBarPath();
    hideMessage();
    setPreviewMode(previewMode);

    try {
      const status = await DashboardCommon.getAuthStatus();
      if (!status.authenticated) {
        authSetupRequired = Boolean(status && status.setupRequired);
        showLoginView();
        if (authSetupRequired) {
          showMessage("Create the first admin account to continue.", "is-warning");
        }
        return;
      }

      authUser = status.username || "admin";
      authSetupRequired = false;
      authMustChangePassword = Boolean(status && status.mustChangePassword);
      showAdminView();
      await loadConfigAndRender();
      if (authMustChangePassword) {
        setAccountPaneOpen(true);
        showMessage("First-time setup: change the account password before editing the dashboard.", "is-warning");
      }
    } catch (error) {
      console.error(error);
      showLoginView();
      showMessage("Admin API unavailable. Check backend service.", "is-danger");
    }
  }

  boot();
})();
