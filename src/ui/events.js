/**
 * ui/events.js
 * Centralized event wiring for the app instance.
 * No behavior changes vs original agent.js wiring.
 */
import { preventDefaults } from '../utils/helpers.js';

/**
 * Wire all core UI events except drag-and-drop and context menu.
 * @param {Object} app
 */
export function wireEvents(app) {
  try {
    // Send button + composer
    app.elements.sendButton?.addEventListener('click', () => app.sendMessage());
    app.elements.userInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        app.sendMessage();
      }
    });

    // Toolbar buttons
    document.getElementById('voice-input')?.addEventListener('click', () => app.toggleVoiceInput());
    document.getElementById('attach-file')?.addEventListener('click', () => document.getElementById('file-input')?.click());
    document.getElementById('file-input')?.addEventListener('change', (e) => app.handleFileSelection(e));

    // Top bar
    document.getElementById('voice-toggle')?.addEventListener('click', () => app.toggleVoiceInput());
    document.getElementById('theme-toggle')?.addEventListener('click', () => app.toggleTheme());
    document.getElementById('fullscreen-toggle')?.addEventListener('click', () => app.toggleFullscreen());
    document.getElementById('settings-toggle')?.addEventListener('click', () => app.openSettings());

    // Sidebar header + actions
    document.getElementById('new-chat')?.addEventListener('click', () => app.createNewConversation());
    document.getElementById('clear-chat')?.addEventListener('click', () => app.clearConversationMessages());
    document.getElementById('export-chat')?.addEventListener('click', () => app.exportConversation());
    document.getElementById('share-chat')?.addEventListener('click', () =>
      app.showToast('info', 'Not Implemented', 'Share feature is coming soon.')
    );

    // Perf panel
    document.getElementById('toggle-perf')?.addEventListener('click', () => app.togglePerformanceMonitor());

    // Settings modal buttons
    document.getElementById('close-settings')?.addEventListener('click', () => app.closeSettings());
    document.getElementById('save-settings')?.addEventListener('click', () => app.saveAndApplySettings());

    // Settings fields
    document.querySelector('.toggle-visibility')?.addEventListener('click', (e) => app.toggleApiKeyVisibility(e));
    document.getElementById('llm-provider')?.addEventListener('change', () => app.updateModelOptions());
    document.getElementById('api-key')?.addEventListener('input', app.debouncedUpdateModelOptions);
    document.getElementById('clear-all-data')?.addEventListener('click', () => app.clearAllData());

    // Settings tabs
    document.querySelectorAll('.tab-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => app.switchSettingsTab(e.target.dataset.tab))
    );

    // Range inputs live value
    ['temperature', 'speech-rate'].forEach((id) => {
      const input = document.getElementById(id);
      if (input)
        input.addEventListener('input', () => {
          const valueSpan = input.parentNode.querySelector('.range-value');
          if (valueSpan) valueSpan.textContent = id === 'speech-rate' ? `${input.value}x` : input.value;
        });
    });

    // Quick actions
    document.querySelectorAll('.quick-action').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt || btn.textContent;
        if (prompt) {
          app.elements.userInput.value = prompt;
          app.updateCharCount();
          app.sendMessage();
        }
      });
    });

    // Char count
    app.elements.userInput?.addEventListener('input', () => app.updateCharCount());

    // Context menu actions (click handlers)
    app.elements.contextMenu?.querySelectorAll('.context-item').forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        app.handleContextAction(action);
        app.hideContextMenu();
      });
    });

    // Sidebar toggle + responsive
    app.elements.sidebarToggle?.addEventListener('click', () => {
      app.state.ui.sidebarOpen = !app.state.ui.sidebarOpen;
      app.updateSidebarState();
    });

    window.addEventListener('resize', () => app.updateSidebarState());
    app.updateSidebarState();

    // Command bar submit
    app.elements.commandInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = e.currentTarget.value.trim();
        if (!val) return;
        if (app.elements.userInput) {
          app.elements.userInput.value = val;
          app.updateCharCount();
        }
        e.currentTarget.value = '';
        app.sendMessage();
      }
    });
  } catch (e) {
    console.warn('Error wiring events', e);
  }
}

/**
 * Drag & Drop listeners
 * @param {Object} app
 */
export function wireDragAndDrop(app) {
  const dropZone = app.elements.fileDropZone;
  const container = app.elements.messagesContainer;
  if (!container) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) =>
    container.addEventListener(evt, preventDefaults, false)
  );
  ['dragenter', 'dragover'].forEach((evt) =>
    container.addEventListener(
      evt,
      () => dropZone?.classList.add('active'),
      false
    )
  );
  ['dragleave', 'drop'].forEach((evt) =>
    container.addEventListener(
      evt,
      () => dropZone?.classList.remove('active'),
      false
    )
  );

  container.addEventListener(
    'drop',
    (e) => {
      if (!e.dataTransfer) return;
      app.handleFiles(Array.from(e.dataTransfer.files));
    },
    false
  );

  dropZone?.addEventListener('click', () => document.getElementById('file-input')?.click());
}

/**
 * Context menu wiring
 * @param {Object} app
 */
export function wireContextMenu(app) {
  if (!app.elements.messages) return;

  app.elements.messages.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const messageElement = e.target.closest('.message');
    if (messageElement) app.showContextMenu(e.clientX, e.clientY, messageElement);
  });

  document.addEventListener('click', (e) => {
    const menu = app.elements.contextMenu;
    if (!menu) return;
    if (!menu.contains(e.target)) menu.classList.remove('active');
  });
}
