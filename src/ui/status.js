// Shows state.status in the status line under the frame.

/**
 * Renders the status message into [data-role="status"] and keeps it up to date.
 * Error messages get the status--error style; while kind is 'loading' the workspace
 * ([data-role="workspace"]) is marked aria-busy.
 * root   element (or document) containing the status output
 * store  the app store from ./store.js
 */
export function setupStatus(root, store) {
  const output = root.querySelector('[data-role="status"]');
  const workspace = root.querySelector('[data-role="workspace"]');

  function render(status) {
    output.textContent = status.text;
    output.classList.toggle('status--error', status.kind === 'error');
    workspace.setAttribute('aria-busy', String(status.kind === 'loading'));
  }

  render(store.getState().status);
  store.subscribe((state, previous) => {
    if (state.status !== previous.status) {
      render(state.status);
    }
  });
}
