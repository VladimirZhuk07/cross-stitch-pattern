// Shows state.status in the status line under the frame.

/**
 * Renders the status message into [data-role="status"] and keeps it up to date.
 * Error messages get the status--error style. The workspace ([data-role="workspace"]) is
 * marked aria-busy while an image loads (status kind 'loading') or a pattern is generated
 * (generation kind 'running'); this module is the only writer of that attribute.
 * root   element (or document) containing the status output
 * store  the app store from ./store.js
 */
export function setupStatus(root, store) {
  const output = root.querySelector('[data-role="status"]');
  const workspace = root.querySelector('[data-role="workspace"]');

  function render(state) {
    const { status, generation } = state;
    output.textContent = status.text;
    output.classList.toggle('status--error', status.kind === 'error');
    const isBusy = status.kind === 'loading' || generation.kind === 'running';
    workspace.setAttribute('aria-busy', String(isBusy));
  }

  render(store.getState());
  store.subscribe((state, previous) => {
    if (state.status !== previous.status || state.generation !== previous.generation) {
      render(state);
    }
  });
}
