<script>
  import { createEventDispatcher } from 'svelte';
  import { DashboardCommon } from '../lib/dashboard-common.js';

  export let authSetupRequired = false;
  export let showMessage = () => {};

  const dispatch = createEventDispatcher();

  let loginUsername = '';
  let loginPassword = '';
  let bootstrapUsername = '';
  let bootstrapPassword = '';
  let bootstrapConfirmPassword = '';

  async function loginSubmit(event) {
    event?.preventDefault?.();
    showMessage('', 'is-success');
    const username = loginUsername.trim();
    const password = loginPassword;
    if (!username || !password) {
      showMessage('Username and password are required.', 'is-danger');
      return;
    }
    try {
      const result = await DashboardCommon.login(username, password);
      loginPassword = '';
      dispatch('loginsuccess', {
        user: result?.username || username,
        mustChangePassword: Boolean(result?.mustChangePassword)
      });
    } catch (error) {
      if (error?.status === 409 && error?.payload?.setupRequired) {
        authSetupRequired = true;
        showMessage('Create the first admin account to continue.', 'is-warning');
        return;
      }
      showMessage(error.message || 'Login failed.', 'is-danger');
    }
  }

  async function bootstrapSubmit(event) {
    event?.preventDefault?.();
    showMessage('', 'is-success');
    const username = bootstrapUsername.trim();
    const password = bootstrapPassword;
    const confirmPassword = bootstrapConfirmPassword;
    if (!username || !password) {
      showMessage('Username and password are required.', 'is-danger');
      return;
    }
    if (password.length < 4) {
      showMessage('Password must be at least 4 characters.', 'is-danger');
      return;
    }
    if (password !== confirmPassword) {
      showMessage('Password confirmation does not match.', 'is-danger');
      return;
    }
    try {
      const result = await DashboardCommon.bootstrapAdmin(username, password);
      bootstrapPassword = '';
      bootstrapConfirmPassword = '';
      dispatch('loginsuccess', {
        user: result?.username || username,
        mustChangePassword: false
      });
    } catch (error) {
      if (error?.status === 409 && error?.payload?.setupRequired === false) {
        authSetupRequired = false;
        showMessage('An admin account already exists. Please log in.', 'is-warning');
        return;
      }
      if (error?.status === 409) {
        authSetupRequired = false;
      }
      showMessage(error.message || 'Failed to create admin account.', 'is-danger');
    }
  }
</script>

<div id="loginView" class="box login-box">
  <h1 id="loginViewTitle" class="title is-4 mb-2">{authSetupRequired ? 'First-Time Setup' : 'KISS this dashboard Admin'}</h1>
  <p id="loginViewIntro" class="muted mb-4">
    {authSetupRequired ? 'Create the first admin account for KISS this dashboard.' : 'Log in to manage your dashboard.'}
  </p>

  <form id="loginForm" class:is-hidden={authSetupRequired} on:submit={loginSubmit}>
    <div class="field">
      <label class="label" for="loginUsername">Username</label>
      <div class="control">
        <input id="loginUsername" class="input" type="text" placeholder="admin" required bind:value={loginUsername} />
      </div>
    </div>
    <div class="field">
      <label class="label" for="loginPassword">Password</label>
      <div class="control">
        <input id="loginPassword" class="input" type="password" placeholder="••••••" required bind:value={loginPassword} />
      </div>
    </div>
    <button class="button is-link" type="submit">Log In</button>
  </form>

  <form id="bootstrapForm" class:is-hidden={!authSetupRequired} on:submit={bootstrapSubmit}>
    <div class="field">
      <label class="label" for="bootstrapUsername">Create Username</label>
      <div class="control">
        <input id="bootstrapUsername" class="input" type="text" minlength="3" maxlength="40" required bind:value={bootstrapUsername} />
      </div>
    </div>
    <div class="field">
      <label class="label" for="bootstrapPassword">Create Password</label>
      <div class="control">
        <input id="bootstrapPassword" class="input" type="password" minlength="4" required bind:value={bootstrapPassword} />
      </div>
    </div>
    <div class="field">
      <label class="label" for="bootstrapConfirmPassword">Confirm Password</label>
      <div class="control">
        <input id="bootstrapConfirmPassword" class="input" type="password" minlength="4" required bind:value={bootstrapConfirmPassword} />
      </div>
    </div>
    <button class="button is-link" type="submit">Create Admin Account</button>
  </form>
</div>
