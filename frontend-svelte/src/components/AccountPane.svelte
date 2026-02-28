<script>
  import { createEventDispatcher } from 'svelte';
  import { StartpageCommon } from '../lib/startpage-common.js';

  export let open = false;
  export let authUser = '';
  export let authMustChangePassword = false;
  export let showMessage = () => {};

  const dispatch = createEventDispatcher();

  let usernameNew = '';
  let usernameCurrentPassword = '';
  let passwordCurrent = '';
  let passwordNew = '';
  let passwordConfirm = '';

  async function updateUsernameSubmit(event) {
    event?.preventDefault?.();
    showMessage('', 'is-success');
    const requestedUsername = usernameNew.trim();
    if (!requestedUsername) {
      showMessage('New username is required.', 'is-danger');
      return;
    }
    if (requestedUsername.length < 3) {
      showMessage('Username must be at least 3 characters.', 'is-danger');
      return;
    }
    if (!usernameCurrentPassword) {
      showMessage('Current password is required.', 'is-danger');
      return;
    }
    if (requestedUsername === authUser) {
      showMessage('Username unchanged.', 'is-success');
      return;
    }
    try {
      const result = await StartpageCommon.changeUsername(usernameCurrentPassword, requestedUsername);
      usernameNew = '';
      usernameCurrentPassword = '';
      dispatch('usernamechanged', { user: result?.username || requestedUsername });
      showMessage('Username changed.', 'is-success');
    } catch (error) {
      showMessage(error.message || 'Failed to change username.', 'is-danger');
    }
  }

  async function updatePasswordSubmit(event) {
    event?.preventDefault?.();
    showMessage('', 'is-success');
    if (!passwordCurrent || !passwordNew) {
      showMessage('Current and new password are required.', 'is-danger');
      return;
    }
    if (passwordNew.length < 4) {
      showMessage('New password must be at least 4 characters.', 'is-danger');
      return;
    }
    if (passwordNew !== passwordConfirm) {
      showMessage('New password confirmation does not match.', 'is-danger');
      return;
    }
    try {
      const result = await StartpageCommon.changePassword(passwordCurrent, passwordNew);
      passwordCurrent = '';
      passwordNew = '';
      passwordConfirm = '';
      dispatch('passwordchanged', { mustChangePassword: Boolean(result?.mustChangePassword) });
      showMessage('Password changed.', 'is-success');
    } catch (error) {
      showMessage(error.message || 'Failed to change password.', 'is-danger');
    }
  }
</script>

<div id="accountPane" class={`modal ${open ? 'is-active' : ''}`.trim()}>
  <button type="button" class="modal-background" aria-label="Close dialog" on:click={() => dispatch('close')}></button>
  <div class="modal-card">
    <header class="modal-card-head">
      <div class="account-modal-head">
        <p class="modal-card-title">Account</p>
        <div class="account-modal-head-actions">
          <button id="accountCloseBtn" class="button icon-action" type="button" title="Close" aria-label="Close" on:click={() => dispatch('close')}>✕</button>
        </div>
      </div>
    </header>
    <section class="modal-card-body">
      <p class="muted mb-4">Update username and password.</p>
      <div id="accountSetupNotice" class={`notification is-warning is-light ${authMustChangePassword ? '' : 'is-hidden'}`.trim()}>
        First-time setup: change the account password before using the editor.
      </div>

      <form id="usernameForm" class="mb-5" on:submit={updateUsernameSubmit}>
        <div class="field">
          <label class="label" for="currentUsername">Current Username</label>
          <div class="control"><input id="currentUsername" class="input" type="text" readonly value={authUser || 'admin'} /></div>
        </div>
        <div class="field">
          <label class="label" for="newUsername">New Username</label>
          <div class="control"><input id="newUsername" class="input" type="text" minlength="3" maxlength="40" required bind:value={usernameNew} /></div>
        </div>
        <div class="field">
          <label class="label" for="usernameCurrentPassword">Current Password</label>
          <div class="control"><input id="usernameCurrentPassword" class="input" type="password" required bind:value={usernameCurrentPassword} /></div>
        </div>
        <button class="button is-link" type="submit">Update Username</button>
      </form>

      <h3 class="title is-6">Change Password</h3>
      <form id="passwordForm" on:submit={updatePasswordSubmit}>
        <div class="field">
          <label class="label" for="currentPassword">Current Password</label>
          <div class="control"><input id="currentPassword" class="input" type="password" required bind:value={passwordCurrent} /></div>
        </div>
        <div class="field">
          <label class="label" for="newPassword">New Password</label>
          <div class="control"><input id="newPassword" class="input" type="password" minlength="4" required bind:value={passwordNew} /></div>
        </div>
        <div class="field">
          <label class="label" for="confirmPassword">Confirm New Password</label>
          <div class="control"><input id="confirmPassword" class="input" type="password" minlength="4" required bind:value={passwordConfirm} /></div>
        </div>
        <button class="button is-link" type="submit">Update Password</button>
      </form>
    </section>
  </div>
</div>
