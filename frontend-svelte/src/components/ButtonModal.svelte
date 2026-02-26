<script>
  import { createEventDispatcher } from 'svelte';
  import { DashboardCommon, readFileAsDataUrl } from '../lib/dashboard-common.js';

  export let open = false;
  export let isNew = false;
  export let groupId = '';
  export let buttonId = '';
  export let initialData = { name: '', icon: '', externalUrl: '', internalUrl: '', iconData: '' };
  export let internalLinksEnabled = false;
  export let showMessage = () => {};

  const dispatch = createEventDispatcher();

  let name = '';
  let icon = '';
  let externalUrl = '';
  let internalUrl = '';
  let iconData = '';
  let clearIconData = false;
  let uploadedFileName = '';
  let uploadEl;

  let iconSource = 'selfhst';
  let searchQuery = '';
  let searchResults = [];
  let searchStatus = 'Type to search an icon library and import an icon (stored locally in your dashboard config).';
  let searchStatusTone = 'muted';
  let searchLoading = false;
  let searchTimer = null;
  let searchSeq = 0;

  $: if (open) initDraft();

  $: previewSrc = clearIconData ? '' : (iconData || (icon.trim() ? 'icons/' + icon.trim() : ''));
  $: iconFilenameVisible = !isNew || Boolean(icon.trim() || iconData);

  function initDraft() {
    name = initialData.name || '';
    icon = initialData.icon || '';
    externalUrl = initialData.externalUrl || '';
    internalUrl = initialData.internalUrl || '';
    iconData = initialData.iconData || '';
    clearIconData = false;
    uploadedFileName = '';
    iconSource = 'selfhst';
    searchQuery = '';
    searchResults = [];
    searchStatusTone = 'muted';
    searchStatus = 'Type to search an icon library and import an icon (stored locally in your dashboard config).';
    searchLoading = false;
    searchSeq += 1;
    clearSearchTimer();
    if (uploadEl) uploadEl.value = '';
  }

  function clearSearchTimer() {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
  }

  function scheduleSearch(delayMs = 220) {
    clearSearchTimer();
    searchTimer = setTimeout(() => {
      searchTimer = null;
      runSearch().catch((error) => {
        console.error(error);
        searchStatusTone = 'has-text-danger';
        searchStatus = 'Icon search failed.';
        showMessage(error.message || 'Icon search failed.', 'is-danger');
      });
    }, delayMs);
  }

  async function runSearch() {
    const query = (searchQuery || '').trim();
    const source = iconSource || 'selfhst';
    const seq = searchSeq + 1;
    searchSeq = seq;

    if (!query || query.length < 2) {
      searchResults = [];
      searchStatusTone = 'muted';
      searchStatus = 'Type at least 2 characters to search.';
      return;
    }

    searchLoading = true;
    searchStatusTone = 'muted';
    searchStatus = `Searching "${query}" in ${iconSearchSourceLabel(source)}...`;
    try {
      const payload = await DashboardCommon.searchIcons(query, 18, source);
      if (searchSeq !== seq) return;
      const resultSource = payload?.source || source;
      const items = Array.isArray(payload?.items)
        ? payload.items.map((item) => ({ ...item, source: item?.source || resultSource }))
        : [];
      searchResults = items;
      searchStatusTone = items.length ? 'muted' : 'has-text-warning';
      searchStatus = items.length
        ? `Found ${items.length} icon${items.length === 1 ? '' : 's'} from ${iconSearchSourceLabel(resultSource)}.`
        : 'No icons found.';
    } catch (error) {
      if (searchSeq !== seq) return;
      searchResults = [];
      searchStatusTone = 'has-text-danger';
      searchStatus = 'Icon search source unavailable.';
      throw error;
    } finally {
      if (searchSeq === seq) {
        searchLoading = false;
      }
    }
  }

  async function importIcon(item) {
    const reference = String(item?.reference || '').trim();
    const source = isIconifySource(item?.source) ? item.source : 'selfhst';
    searchStatusTone = 'muted';
    searchStatus = `Importing "${reference}" from ${iconSearchSourceLabel(source)}...`;

    const payload = isIconifySource(source)
      ? await DashboardCommon.importIconifyIcon(reference, 'svg', source)
      : await DashboardCommon.importSelfhstIcon(reference, 'svg');

    iconData = payload?.iconData || '';
    if (payload?.icon) {
      icon = payload.icon;
    } else if (reference) {
      icon = `${reference}.svg`;
    }
    clearIconData = false;
    if (uploadEl) uploadEl.value = '';
    uploadedFileName = '';
    searchStatusTone = 'has-text-success';
    searchStatus = `Imported ${payload?.name || reference}. Click Save to store it locally in this button.`;
  }

  async function handleUploadChange(event) {
    const file = event.currentTarget?.files?.[0] || null;
    if (!file) {
      uploadedFileName = '';
      return;
    }
    uploadedFileName = file.name;
    if (!isNew && !icon.trim()) {
      icon = file.name;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      iconData = dataUrl;
      clearIconData = false;
    } catch (error) {
      console.error(error);
      showMessage('Failed to preview uploaded icon.', 'is-danger');
    }
  }

  async function pasteText(callback, label) {
    if (!navigator.clipboard?.readText) {
      showMessage('Clipboard paste is not available in this browser.', 'is-danger');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      callback((text || '').trim());
      if (label) showMessage(`${label} pasted.`, 'is-success');
    } catch (error) {
      console.error(error);
      showMessage(error.message || 'Failed to paste.', 'is-danger');
    }
  }

  function iconSearchSourceLabel(source) {
    if (source === 'iconify-simple') return 'Iconify Simple Icons';
    if (source === 'iconify-logos') return 'Iconify Logos';
    return 'selfh.st/icons';
  }

  function isIconifySource(source) {
    return source === 'iconify-simple' || source === 'iconify-logos';
  }

  function handleClose() {
    clearSearchTimer();
    dispatch('close');
  }

  function handleSave() {
    const hasAnyInput = Boolean(
      name.trim() || icon.trim() || externalUrl.trim() || internalUrl.trim() || clearIconData || uploadedFileName
    );
    if (isNew && !hasAnyInput) {
      dispatch('close');
      return;
    }
    if (!name.trim()) {
      showMessage('Button name is required.', 'is-danger');
      return;
    }
    if (!externalUrl.trim() && !internalUrl.trim()) {
      showMessage('At least one URL (external or internal) is required.', 'is-danger');
      return;
    }
    const finalIcon = icon.trim() || (uploadedFileName && !icon.trim() ? uploadedFileName : '');
    dispatch('save', {
      isNew,
      groupId,
      buttonId,
      name: name.trim(),
      icon: finalIcon,
      externalUrl: externalUrl.trim(),
      internalUrl: internalUrl.trim(),
      iconData: clearIconData ? '' : iconData,
      clearIconData
    });
  }

  function handleDelete() {
    dispatch('deleterequest', { groupId, buttonId, buttonName: name });
  }
</script>

<div id="entryModal" class={`modal ${open ? 'is-active' : ''}`.trim()}>
  <button type="button" class="modal-background" aria-label="Close dialog" on:click={handleClose}></button>
  <div class="modal-card">
    <header class="modal-card-head">
      <div class="entry-modal-head">
        <p id="entryModalTitle" class="modal-card-title">{isNew ? 'Add Button' : `Edit Button: ${name || ''}`}</p>
        <div class="entry-modal-head-actions">
          <button id="entryCloseBtn" class="button icon-action" type="button" title="Close" aria-label="Close" on:click={handleClose}>✕</button>
        </div>
      </div>
    </header>
    <section class="modal-card-body">
      <div class="columns is-multiline">
        <div class="column is-12">
          <label class="label" for="entryNameInput">Button Name</label>
          <input id="entryNameInput" class="input" type="text" maxlength="80" required bind:value={name} />
        </div>

        <div id="entryExternalUrlColumn" class={`column ${internalLinksEnabled ? 'is-6' : 'is-12'}`}>
          <label class="label" for="entryExternalUrlInput">External URL</label>
          <div class="field has-addons url-input-row">
            <p class="control is-expanded"><input id="entryExternalUrlInput" class="input" type="url" placeholder="https://example.com" bind:value={externalUrl} /></p>
            <p class="control"><button id="entryExternalUrlPasteBtn" class="input-icon-btn paste-btn" type="button" title="Paste URL" aria-label="Paste URL" on:click={() => pasteText((text) => (externalUrl = text), 'External URL')}>📋</button></p>
          </div>
        </div>

        <div id="entryInternalUrlColumn" class={`column is-6 ${internalLinksEnabled ? '' : 'is-hidden'}`.trim()}>
          <label class="label" for="entryInternalUrlInput">Internal URL</label>
          <div class="field has-addons url-input-row">
            <p class="control is-expanded"><input id="entryInternalUrlInput" class="input" type="url" placeholder="http://192.168.x.x:port" bind:value={internalUrl} disabled={!internalLinksEnabled} /></p>
            <p class="control"><button id="entryInternalUrlPasteBtn" class="input-icon-btn paste-btn" type="button" title="Paste URL" aria-label="Paste URL" on:click={() => pasteText((text) => (internalUrl = text), 'Internal URL')}>📋</button></p>
          </div>
        </div>

        <div id="entryUrlHelpColumn" class="column is-12">
          <p id="entryUrlHelpText" class="help">
            {internalLinksEnabled ? 'At least one URL (external or internal) is required.' : 'External URL is required (internal links are disabled for this tab).'}
          </p>
        </div>

        <div id="entryIconFilenameColumn" class={`column is-6 ${iconFilenameVisible ? '' : 'is-hidden'}`.trim()}>
          <label class="label" for="entryIconInput">Icon Filename</label>
          <input id="entryIconInput" class="input" type="text" maxlength="120" placeholder="example.svg" bind:value={icon} disabled={isNew} class:is-disabled={isNew} />
          <p id="entryIconInputHint" class={`help mt-2 ${isNew ? '' : 'is-hidden'}`.trim()}>Available after the button is saved.</p>
          <p id="entryIconPreview" class="help mt-2">
            {#if previewSrc}
              <img class="icon-preview" src={previewSrc} alt="icon preview" /> {iconData ? 'icon embedded' : 'icon path'}
            {:else}
              No icon configured
            {/if}
          </p>
        </div>

        <div class="column is-6">
          <label class="label" for="entryIconUpload">Upload Icon</label>
          <input id="entryIconUpload" class="input" type="file" accept="image/*" bind:this={uploadEl} on:change={handleUploadChange} />
          <label class="checkbox mt-2">
            <input id="entryClearIconData" type="checkbox" bind:checked={clearIconData} />
            Clear embedded uploaded icon
          </label>
        </div>

        <div class="column is-12">
          <label class="label" for="entryIconSourceSelect">Search Icon Library</label>
          <div class="field mb-2">
            <div class="control">
              <div class="select is-fullwidth">
                <select id="entryIconSourceSelect" bind:value={iconSource} on:change={() => {
                  searchResults = [];
                  searchStatusTone = 'muted';
                  searchStatus = `Selected ${iconSearchSourceLabel(iconSource)}. Type to search and import an icon (stored locally in your dashboard config).`;
                  if (searchQuery.trim().length >= 2) scheduleSearch(100);
                }}>
                  <option value="selfhst">selfh.st/icons</option>
                  <option value="iconify-simple">Iconify (Simple Icons)</option>
                  <option value="iconify-logos">Iconify (Logos)</option>
                </select>
              </div>
            </div>
          </div>
          <div class="icon-search-controls">
            <div class="control is-expanded">
              <input id="entryIconSearchInput" class="input" type="search" maxlength="80" placeholder="Search service icon (e.g. grafana, proxmox, adguard)" bind:value={searchQuery} on:input={() => scheduleSearch(220)} />
            </div>
          </div>
          <p class="help mt-2">Search a selected icon library and import a result. The selected icon is embedded locally in your dashboard config.</p>
          <p id="entryIconSearchStatus" class={`help mt-2 ${searchStatusTone}`.trim()}>{searchStatus}</p>
          <div id="entryIconSearchResults" class="icon-search-results">
            {#if searchResults.length}
              {#each searchResults as item}
                <button type="button" class="icon-search-result" title={`Use ${item.name}`} aria-label={`Use icon ${item.name}`} on:click={() => importIcon(item).catch((error) => { console.error(error); searchStatusTone = 'has-text-danger'; searchStatus = 'Failed to import icon.'; showMessage(error.message || 'Failed to import icon.', 'is-danger'); })}>
                  <span class="icon-search-result-media">
                    {#if item.previewUrl}
                      <img src={item.previewUrl} alt="" loading="lazy" />
                    {:else}
                      ◻
                    {/if}
                  </span>
                  <span class="icon-search-result-meta">
                    <span class="icon-search-result-name">{item.name || item.reference || 'Icon'}</span>
                    <span class="icon-search-result-sub">{[item.reference, item.category].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              {/each}
            {:else if searchQuery.trim().length >= 2 && !searchLoading && searchStatus.includes('No icons')}
              <div class="empty-state small">No icons found.</div>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <footer class="modal-card-foot entry-modal-footer">
      <div class="entry-modal-footer-top">
        <button id="entryDeleteBtn" class="button is-danger is-light entry-modal-delete-btn" type="button" disabled={isNew} on:click={handleDelete}>Delete</button>
        <button id="entryCancelBtn" class="button" type="button" on:click={handleClose}>Cancel</button>
      </div>
      <div class="entry-modal-footer-bottom">
        <button id="entrySaveBtn" class="button is-link" type="button" on:click={handleSave}>{isNew ? 'Add Button' : 'Save'}</button>
      </div>
    </footer>
  </div>
</div>
