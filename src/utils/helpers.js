/**
 * utils/helpers.js
 * Small shared utilities extracted from agent.js
 * No behavior changes.
 */

/**
 * Debounce utility
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Prevent default + stop propagation safely
 * @param {Event} e
 */
export function preventDefaults(e) {
  try {
    e.preventDefault();
    e.stopPropagation();
  } catch (_) {}
}
