/**
 * ui/renderer.js
 * Extracted UI rendering helpers from agent.js with no behavior changes.
 */

/**
 * Escape HTML utility (used by renderer only)
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render a message into the DOM (replicates original agent.js behavior)
 * @param {Object} app - the GyaanSetu app instance (for refs/state)
 * @param {Object} message - { id, role, content, ... }
 */
export function displayMessage(app, message) {
  try {
    if (!app.elements.messages) return;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;
    messageEl.dataset.messageId = message.id;

    const senderName = { user: 'You', assistant: 'LeafAI', system: 'System', tool: 'Tool' }[message.role] || message.role;
    const avatarIcon = { user: 'fa-user', assistant: 'fa-robot', system: 'fa-cog', tool: 'fa-wrench' }[message.role] || 'fa-comment';

    let processedContent = '';
    if (typeof message.content === 'string' && window.marked) {
      try {
        processedContent = marked.parse(message.content);
      } catch (e) {
        processedContent = `<p>${escapeHtml(message.content)}</p>`;
      }
    } else if (typeof message.content === 'string') {
      processedContent = `<p>${escapeHtml(message.content)}</p>`;
    } else {
      processedContent = `<pre><code>${escapeHtml(JSON.stringify(message.content, null, 2))}</code></pre>`;
    }

    messageEl.innerHTML = `
      <div class="message-header">
        <div class="message-avatar ${message.role}">
          <i class="fas ${avatarIcon}"></i>
        </div>
        <div class="message-info">
          <div class="message-sender">${escapeHtml(senderName)}</div>
        </div>
      </div>
      <div class="message-content">${processedContent}</div>
    `;

    app.elements.messages.appendChild(messageEl);

    if (window.hljs) {
      messageEl.querySelectorAll('pre code').forEach((block) => {
        try {
          hljs.highlightElement(block);
        } catch (e) {}
      });
    }
  } catch (e) {
    console.error('displayMessage error', e);
  }
}

/**
 * Update performance figures in both floating panel and status bar
 * @param {Object} app
 */
export function updatePerformanceDisplay(app) {
  try {
    const rt = `${app.state.performance.responseTime}ms`;
    const mem = `${app.state.performance.memoryUsage}MB`;
    const calls = app.state.performance.apiCalls || 0;

    const rtEl = document.getElementById('response-time');
    const memEl = document.getElementById('memory-usage');
    const callsEl = document.getElementById('api-calls');

    if (rtEl) rtEl.textContent = rt;
    if (memEl) memEl.textContent = mem;
    if (callsEl) callsEl.textContent = calls;

    if (app.elements?.statusResponse) app.elements.statusResponse.textContent = rt;
    if (app.elements?.statusMemory) app.elements.statusMemory.textContent = mem;
    if (app.elements?.statusApiCalls) app.elements.statusApiCalls.textContent = calls;
  } catch (e) {}
}

/**
 * Show toast message (replicates original agent.js behavior)
 * @param {Object} app
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} title
 * @param {string} message
 */
export function showToast(app, type, title, message) {
  try {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon =
      {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
      }[type] || 'fa-info-circle';

    toast.innerHTML = `
      <div class="toast-icon"><i class="fas ${icon}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector('.toast-close').onclick = () => toast.remove();

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  } catch (e) {}
}
