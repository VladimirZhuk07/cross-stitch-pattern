// A toggle button that folds a panel: the settings form and the legend on phones, and the
// side panels on wider screens (see ./side-panels.js).
// The open/closed state lives in the button's aria-expanded attribute and CSS decides what it
// means (see styles/main.css). For the phone toggles no other module needs the state, so it is
// not part of the app store, and every page load starts with the value in index.html. In the
// compact layout a panel whose toggle says aria-expanded="false" hides its .collapsible__body;
// on wider screens the phone toggle is hidden and the body is shown.

/**
 * Makes toggle (a <button aria-controls="…">) flip its aria-expanded between "true" and
 * "false" on every click. A native button also fires click for Enter and Space, so the
 * keyboard works without extra code. A missing aria-expanded counts as "false".
 * toggle    the button element
 * onToggle  optional function called after every flip with the new state (true = expanded),
 *           e.g. to remember it
 */
export function setupCollapsible(toggle, onToggle) {
  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isExpanded));
    if (onToggle) {
      onToggle(!isExpanded);
    }
  });
}
