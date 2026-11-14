// A toggle button that folds a panel (the settings form, the legend) on phones.
// The open/closed state lives only in the button's aria-expanded attribute: no other module
// needs it, so it is not part of the app store, and every page load starts with the value in
// index.html. CSS decides what that state means: in the compact layout a panel whose toggle
// says aria-expanded="false" hides its .collapsible__body; on wider screens the toggle is
// hidden and the body is always shown (see styles/main.css).

/**
 * Makes toggle (a <button class="collapsible__toggle" aria-controls="…">) flip its
 * aria-expanded between "true" and "false" on every click. A native button also fires click
 * for Enter and Space, so the keyboard works without extra code. A missing aria-expanded
 * counts as "false".
 * toggle  the button element
 */
export function setupCollapsible(toggle) {
  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isExpanded));
  });
}
