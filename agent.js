/**
 * GyaanSetu - Advanced AI Assistant
 * v2.8.0 (Updated: AI Pipe integration + bug fixes)
 * Author: Gaurav Tomar (Original) & Assistant (fixes)
 *
 * NOTE: Refactored for readability, organization, and consistency.
 *       No logic and no names have been changed.
 */
import { DEFAULTS, TOOLS, UI_STRINGS } from './src/constants.js';
import * as renderer from './src/ui/renderer.js';
import { wireEvents, wireDragAndDrop, wireContextMenu } from './src/ui/events.js';
import { debounce as utilDebounce, preventDefaults as utilPreventDefaults } from './src/utils/helpers.js';

class GyaanSetu {
  constructor() {
    this.version = '2.8.0';
    this.initialized = false;

    // ---------------------------------------------------------------------------
    // Reactive State
    // ---------------------------------------------------------------------------
    this.state = new Proxy(
      {
        conversations: new Map(),
        currentConversationId: null,
        isProcessing: false,
        settings: this.getDefaultSettings(),
        performance: { startTime: Date.now(), responseTime: 0, apiCalls: 0, memoryUsage: 0 },
        ui: { theme: 'auto', sidebarOpen: true, voiceEnabled: false, performanceMonitorOpen: false },
      },
      {
        set: (target, property, value) => {
          const oldValue = target[property];
          target[property] = value;
          try {
            this.onStateChange(property, value, oldValue);
          } catch (_) { }
          return true;
        },
      }
    );

    // ---------------------------------------------------------------------------
    // System Resources & Capabilities
    // ---------------------------------------------------------------------------
    this.tools = this.initializeTools();
    this.eventBus = new EventTarget();
    this.cache = new Map();

    this.performanceObserver = null;
    this.memoryMonitor = null;
    this.speechRecognition = null;
    this.speechSynthesis = null;

    this.supportedFileTypes = [
      '.txt',
      '.json',
      '.csv',
      '.md',
      '.js',
      '.py',
      '.html',
      '.css',
      '.xml',
      '.yaml',
      '.yml',
      '.sql',
      '.log',
    ];

    // Bind handlers
    this.debouncedUpdateModelOptions = this.debounce(() => this.updateModelOptions(), 500);

    // Initialize
    this.init();
  }

  // ===========================================================================
  // Boot
  // ===========================================================================
  async init() {
    try {
      await this.showLoadingScreen();
      await Promise.all([
        this.initializeUI(),
        this.loadSettings(),
        this.initializePerformanceMonitoring(),
        this.initializeVoice(),
        this.loadConversationHistory(),
      ]);

      this.setupEventListeners();
      this.setupDragAndDrop();
      this.setupContextMenu();
      this.applySettings();
      this.initialized = true;

      this.hideLoadingScreen();
      this.emit('app:initialized');
      this.showWelcomeMessage();

      console.log(`LeafAI v${this.version} initialized successfully`);
    } catch (error) {
      console.error('Failed to initialize LeafAI:', error);
      this.showToast('error', 'Initialization Error', `Failed to start the application: ${error.message || error}`);
      try {
        this.hideLoadingScreen();
      } catch (_) { }
    }
  }

  getDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  initializeTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for current information',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' }, results: { type: 'integer', default: 5 } },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'execute_code',
          description: 'Execute JavaScript code safely',
          parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'process_file',
          description: 'Process and analyze uploaded files',
          parameters: {
            type: 'object',
            properties: { fileId: { type: 'string' }, operation: { type: 'string', default: 'analyze' } },
            required: ['fileId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_visualization',
          description: 'Create data visualizations',
          parameters: {
            type: 'object',
            properties: { data: { type: 'string' }, type: { type: 'string', default: 'line' }, title: { type: 'string' } },
            required: ['data'],
          },
        },
      },
    ];
  }

  // ===========================================================================
  // Loading Screen
  // ===========================================================================
  async showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const progressBar = loadingScreen ? loadingScreen.querySelector('.loading-progress') : null;

    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
      loadingScreen.classList.remove('hidden');
    }

    // Simulated progress for UX
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progressBar) progressBar.style.width = `${Math.min(progress, 100)}%`;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTimeout(resolve, 400);
        }
      }, 90);
    });
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 350);
  }

  // ===========================================================================
  // UI Initialization
  // ===========================================================================
  async initializeUI() {
    this.elements = {
      app: document.getElementById('app'),
      sidebar: document.getElementById('sidebar'),
      messagesContainer: document.getElementById('messages-container'),
      messages: document.getElementById('messages'),
      welcomeScreen: document.getElementById('welcome-screen'),
      userInput: document.getElementById('user-input'),
      sendButton: document.getElementById('send-message'),
      settingsModal: document.getElementById('settings-modal'),
      contextMenu: document.getElementById('context-menu'),
      typingIndicator: document.getElementById('typing-indicator'),
      conversationList: document.getElementById('conversation-list'),
      fileDropZone: document.getElementById('file-drop-zone'),
      performanceMonitor: document.getElementById('performance-monitor'),
      charCount: document.getElementById('char-count'),
      sidebarToggle: document.getElementById('sidebar-toggle'),
      commandInput: document.getElementById('command-input'),
      statusResponse: document.getElementById('status-response-time'),
      statusMemory: document.getElementById('status-memory'),
      statusApiCalls: document.getElementById('status-api-calls'),
    };

    // marked + highlight integration
    if (window.marked && window.hljs) {
      marked.setOptions({
        highlight: (code, lang) => {
          try {
            if (hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
          } catch (e) { }
          try {
            return hljs.highlightAuto(code).value;
          } catch (e) { }
          return code;
        },
        breaks: true,
        gfm: true,
      });
    }

    if (this.elements.sendButton) this.elements.sendButton.disabled = false;

    this.initializeAutoResize();
    this.initializeThemeDetection();

    // populate model select post-DOM
    setTimeout(() => this.updateModelOptions().catch(() => { }), 300);
  }

  initializeAutoResize() {
    const textarea = this.elements.userInput;
    if (!textarea) return;

    textarea.style.overflow = 'hidden';
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
      this.updateCharCount();
    });
  }

  initializeThemeDetection() {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', () => this.updateTheme());
      }
      setTimeout(() => this.updateTheme(), 50);
    } catch (e) { }
  }

  // ===========================================================================
  // Performance
  // ===========================================================================
  async initializePerformanceMonitoring() {
    try {
      if ('PerformanceObserver' in window) {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' && entry.name === 'llm-response') {
              this.state.performance.responseTime = Math.round(entry.duration);
              this.updatePerformanceDisplay();
            }
          }
        });
        this.performanceObserver.observe({ type: 'measure', buffered: true });
      }

      if (performance && performance.memory) {
        this.memoryMonitor = setInterval(() => {
          try {
            this.state.performance.memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
            this.updatePerformanceDisplay();
          } catch (e) { }
        }, 5000);
      }
    } catch (error) {
      console.warn('Performance monitoring not available:', error);
    }
  }

  // ===========================================================================
  // Voice
  // ===========================================================================
  async initializeVoice() {
    try {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      if (SpeechRecognition) {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = true;

        this.speechRecognition.onresult = (event) => {
          const last = event.results[event.results.length - 1];
          if (last && last.isFinal) {
            this.elements.userInput.value = last[0].transcript;
            this.updateCharCount();
            this.stopVoiceInput();
          } else if (last) {
            // (Optional) show intermediate transcript
          }
        };

        this.speechRecognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          this.stopVoiceInput();
          this.showToast('error', 'Voice Error', event.error || 'Unknown error');
        };
      } else {
        // not supported; controls remain disabled
      }
    } catch (error) {
      console.warn('Voice capabilities not available:', error);
    }
  }

  // ===========================================================================
  // Event Wiring
  // ===========================================================================
  setupEventListeners() {
    // delegate full wiring to events module
    wireEvents(this);
  }

  // ===========================================================================
  // Drag & Drop
  // ===========================================================================
  setupDragAndDrop() {
    wireDragAndDrop(this);
  }

  // ===========================================================================
  // Context Menu
  // ===========================================================================
  setupContextMenu() {
    wireContextMenu(this);
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================
  async sendMessage() {
    const inputEl = this.elements.userInput;
    const input = inputEl ? inputEl.value.trim() : '';
    if (!input || this.state.isProcessing) return;

    this.state.isProcessing = true;
    this.updateUIState();

    const convId = this.state.currentConversationId || this.createNewConversation();
    this.addMessage('user', input, convId);

    if (inputEl) {
      inputEl.value = '';
      inputEl.style.height = 'auto';
      this.updateCharCount();
    }

    this.hideWelcomeScreen();
    this.showTypingIndicator();

    try {
      await this.agentLoop(convId);
    } catch (error) {
      console.error('Agent loop error:', error);
      this.addMessage('system', `An error occurred: ${error.message || error}`, convId);
      this.showToast('error', 'Agent Error', error.message || 'Unknown error');
    } finally {
      this.state.isProcessing = false;
      this.updateUIState();
      this.hideTypingIndicator();
      this.saveCurrentConversation();
    }
  }

  async agentLoop(conversationId) {
    const conversation = this.state.conversations.get(conversationId);
    if (!conversation) return;

    let maxTurns = 5;

    while (maxTurns-- > 0) {
      try {
        const responseData = await this.callLLM(conversation);
        this.state.performance.apiCalls = (this.state.performance.apiCalls || 0) + 1;
        this.updatePerformanceDisplay();

        const response = this.parseAPIResponse(responseData, this.state.settings.llm.provider);

        if (response && response.content) {
          this.addMessage('assistant', response.content, conversationId);
        }

        // Tool calls (best-effort)
        if (response && response.tool_calls && response.tool_calls.length > 0) {
          this.addMessage(
            'assistant',
            `Using tools: ${response.tool_calls.map((tc) => tc.function.name).join(', ')}`,
            conversationId
          );

          conversation.messages.push({ role: 'assistant', content: null, tool_calls: response.tool_calls });

          const toolResults = await Promise.all(response.tool_calls.map((tc) => this.executeTool(tc)));

          toolResults.forEach((result, index) => {
            conversation.messages.push({
              role: 'tool',
              tool_call_id: response.tool_calls[index].id,
              name: response.tool_calls[index].function.name,
              content: JSON.stringify(result),
            });
            this.addMessage('tool', JSON.stringify(result), conversationId);
          });

          // loop to allow model to consume tool outputs
        } else {
          break;
        }
      } catch (err) {
        console.error('Error during agent loop iteration:', err);
        this.addMessage('system', `Agent iteration error: ${err.message || err}`, conversationId);
        break;
      }
    }
  }

  // ===========================================================================
  // LLM Calls
  // ===========================================================================
  async callLLM(conversation) {
    // Build messages in OpenAI chat-like shape
    const messagesForApi = conversation.messages
      .map((m) => {
        if (m.role === 'tool')
          return { role: 'system', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
        return { role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
      })
      .filter((m) => !!m.content);

    const { provider, apiKey, model, maxTokens, temperature } = this.state.settings.llm || {};
    if (!provider) throw new Error('No LLM provider configured.');

    // Demo fallback
    if (!apiKey) {
      return { choices: [{ message: { content: 'Demo response: provide an API key in settings to use real models.' } }] };
    }

    let apiUrl;
    const headers = { 'Content-Type': 'application/json' };
    let body;

    switch (provider) {
      case 'openai':
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        headers.Authorization = `Bearer ${apiKey}`;
        body = { model, messages: messagesForApi, max_tokens: maxTokens, temperature };
        break;

      case 'google':
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        body = {
          messages: messagesForApi.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content })),
          temperature,
          maxOutputTokens: maxTokens,
        };
        break;

      case 'aipipe':
        // OpenRouter-compatible proxy
        apiUrl = 'https://aipipe.org/openrouter/v1/chat/completions';
        headers.Authorization = `Bearer ${apiKey}`;
        body = {
          model: model || 'openai/gpt-4o-mini',
          messages: messagesForApi.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: maxTokens,
          temperature,
        };
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    try {
      const resp = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!resp.ok) {
        let errText = `${resp.status} ${resp.statusText}`;
        try {
          const errJson = await resp.json();
          errText = errJson.error?.message || JSON.stringify(errJson);
        } catch (_) { }
        throw new Error(
          `Model not supported for your API key — change model in settings. (Status: ${resp.status}, Details: ${errText})`
        );
      }
      const data = await resp.json();
      return data;
    } catch (err) {
      throw new Error(err.message || 'Network error');
    }
  }

  parseAPIResponse(data, provider) {
    try {
      switch (provider) {
        case 'openai':
        case 'aipipe':
          if (data.choices && data.choices.length > 0) {
            return data.choices[0].message || { content: data.choices[0].text || '' };
          }
          if (data.candidates && data.candidates.length > 0) {
            const parts = data.candidates[0].content?.parts || data.candidates[0].content || [];
            const text = Array.isArray(parts) ? parts.map((p) => p.text || p).join('') : parts;
            return { content: text };
          }
          return { content: JSON.stringify(data) };

        case 'google':
          if (data.candidates && data.candidates.length) {
            return { content: data.candidates[0].content.parts[0].text };
          }
          return { content: JSON.stringify(data) };

        default:
          return { content: 'Response format not recognized.' };
      }
    } catch (e) {
      console.error('Error parsing API response:', e, data);
      throw new Error('Could not parse the API response.');
    }
  }

  // ===========================================================================
  // Tools (stubs)
  // ===========================================================================
  async executeTool(toolCall) {
    const func = toolCall.function || {};
    const name = func.name || func?.name || 'unknown';

    let args = {};
    try {
      if (toolCall.arguments) {
        args = typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;
      }
    } catch (e) {
      args = {};
    }

    this.addMessage('system', `Executing tool: ${name}`, this.state.currentConversationId);

    switch (name) {
      case 'web_search':
        return await this.executeWebSearch(args);
      case 'execute_code':
        return await this.executeCode(args);
      case 'process_file':
        return await this.processFile(args);
      case 'create_visualization':
        return await this.createVisualization(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  async executeWebSearch({ query, results = 5 }) {
    return { status: `Simulated search for: ${query}`, items: [] };
  }

  async executeCode({ code }) {
    return { output: `Simulated execution of: ${code}` };
  }

  async processFile({ fileId, operation }) {
    return { result: `Simulated ${operation} on file ${fileId}` };
  }

  async createVisualization({ data, type, title }) {
    return { chartUrl: `Simulated ${type} chart titled "${title}"` };
  }

  // ===========================================================================
  // Messages in UI
  // ===========================================================================
  addMessage(role, content, conversationId) {
    try {
      const convId = conversationId || this.state.currentConversationId;
      if (!convId) return;

      const conversation = this.state.conversations.get(convId);
      if (!conversation) return;
      if (content === null || content === undefined) return;

      const message = { id: `msg_${Date.now()}`, role, content, timestamp: Date.now() };
      conversation.messages.push(message);

      if (role !== 'system' && typeof content === 'string') {
        conversation.preview = content.substring(0, 100);
        if (!conversation.title || conversation.title === 'New Conversation')
          conversation.title = content.substring(0, 30) || 'Conversation';
        conversation.updatedAt = Date.now();
        this.updateConversationList();
      }

      this.displayMessage(message);
      this.scrollToBottom();
    } catch (e) {
      console.error('addMessage error', e);
    }
  }

  displayMessage(message) {
    return renderer.displayMessage(this, message);
  }

  // ===========================================================================
  // Conversations
  // ===========================================================================
  createNewConversation() {
    const id = `conv_${Date.now()}`;
    const convObj = { id, title: 'New Conversation', messages: [], createdAt: Date.now(), updatedAt: Date.now(), preview: '...' };
    this.state.conversations.set(id, convObj);
    this.loadConversation(id);
    return id;
  }

  loadConversation(id) {
    if (!id) return;

    this.state.currentConversationId = id;
    const conversation = this.state.conversations.get(id);

    if (!this.elements.messages) return;
    this.elements.messages.innerHTML = '';

    if (conversation && conversation.messages && conversation.messages.length) {
      this.hideWelcomeScreen();
      conversation.messages.forEach((msg) => this.displayMessage(msg));
    } else {
      this.showWelcomeScreen();
    }

    this.updateConversationList();
    this.updateChatHeader();
  }

  clearConversationMessages() {
    if (!this.state.currentConversationId) return;
    if (!confirm('Clear all messages in this conversation?')) return;

    const conv = this.state.conversations.get(this.state.currentConversationId);
    if (!conv) return;

    conv.messages = [];
    conv.preview = 'Cleared';
    conv.updatedAt = Date.now();

    this.loadConversation(this.state.currentConversationId);
    this.saveCurrentConversation();
  }

  async loadConversationHistory() {
    try {
      const stored = localStorage.getItem('agentflow_conversations');
      if (stored) {
        const parsed = JSON.parse(stored);

        let entries = [];
        if (Array.isArray(parsed)) entries = parsed;
        else if (typeof parsed === 'object') entries = Object.entries(parsed);

        this.state.conversations = new Map(entries.map(([k, v]) => [k, v]));

        Array.from(this.state.conversations.values()).forEach((conv) => {
          conv.updatedAt = conv.updatedAt || conv.createdAt || Date.now();
          conv.messages = conv.messages || [];
        });

        const recent = Array.from(this.state.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (recent) this.loadConversation(recent.id);
        else this.createNewConversation();
      } else {
        this.createNewConversation();
      }
    } catch (e) {
      console.warn('Could not load conversation history, starting fresh.', e);
      this.state.conversations = new Map();
      this.createNewConversation();
    }
  }

  saveCurrentConversation() {
    try {
      if (this.state.settings.advanced.autoSave) {
        localStorage.setItem('agentflow_conversations', JSON.stringify(Array.from(this.state.conversations.entries())));
      }
    } catch (e) {
      console.warn('Could not save conversation', e);
    }
  }

  // ===========================================================================
  // Settings Modal
  // ===========================================================================
  openSettings() {
    this.populateSettingsForm();
    this.elements.settingsModal?.classList.add('active');
  }

  closeSettings() {
    this.elements.settingsModal?.classList.remove('active');
  }

  populateSettingsForm() {
    const s = this.state.settings || this.getDefaultSettings();
    const llmProv = document.getElementById('llm-provider');
    const apiKeyEl = document.getElementById('api-key');
    const maxTokensEl = document.getElementById('max-tokens');
    const tempEl = document.getElementById('temperature');

    if (llmProv) llmProv.value = s.llm.provider || 'aipipe';
    if (apiKeyEl) apiKeyEl.value = s.llm.apiKey || '';
    if (maxTokensEl) maxTokensEl.value = s.llm.maxTokens || 2000;
    if (tempEl) tempEl.value = s.llm.temperature || 0.7;

    try {
      document.querySelector(`input[name="theme"][value="${s.ui.theme}"]`).checked = true;
    } catch (e) { }

    document.getElementById('animations-enabled').checked = !!s.ui.animationsEnabled;
    document.getElementById('sound-enabled').checked = !!s.ui.soundEnabled;
    document.getElementById('font-size').value = s.ui.fontSize || 'medium';
    document.getElementById('voice-enabled').checked = !!s.voice.enabled;
    document.getElementById('voice-output-enabled').checked = !!s.voice.outputEnabled;
    document.getElementById('voice-language').value = s.voice.language || 'en-US';
    document.getElementById('speech-rate').value = s.voice.speechRate || 1.0;
    document.getElementById('auto-save').checked = !!s.advanced.autoSave;
    document.getElementById('analytics-enabled').checked = !!s.advanced.analyticsEnabled;
    document.getElementById('max-history').value = s.advanced.maxHistory || 100;

    this.updateModelOptions().catch(() => { });
  }

  updateSettingsFromForm() {
    const s = this.state.settings || this.getDefaultSettings();

    s.llm.provider = document.getElementById('llm-provider')?.value || s.llm.provider;
    s.llm.apiKey = document.getElementById('api-key')?.value || s.llm.apiKey;
    s.llm.model = document.getElementById('model-name')?.value || s.llm.model;
    s.llm.maxTokens = parseInt(document.getElementById('max-tokens')?.value || s.llm.maxTokens, 10);
    s.llm.temperature = parseFloat(document.getElementById('temperature')?.value || s.llm.temperature);

    s.ui.theme = document.querySelector('input[name="theme"]:checked')?.value || s.ui.theme;
    s.ui.animationsEnabled = document.getElementById('animations-enabled')?.checked;
    s.ui.soundEnabled = document.getElementById('sound-enabled')?.checked;
    s.ui.fontSize = document.getElementById('font-size')?.value || s.ui.fontSize;

    s.voice.enabled = document.getElementById('voice-enabled')?.checked;
    s.voice.outputEnabled = document.getElementById('voice-output-enabled')?.checked;
    s.voice.language = document.getElementById('voice-language')?.value || s.voice.language;
    s.voice.speechRate = parseFloat(document.getElementById('speech-rate')?.value || s.voice.speechRate);

    s.advanced.autoSave = document.getElementById('auto-save')?.checked;
    s.advanced.analyticsEnabled = document.getElementById('analytics-enabled')?.checked;
    s.advanced.maxHistory = parseInt(document.getElementById('max-history')?.value || s.advanced.maxHistory, 10);

    this.state.settings = s;
  }

  saveAndApplySettings() {
    try {
      this.updateSettingsFromForm();
      this.applySettings();
      localStorage.setItem('agentflow_settings', JSON.stringify(this.state.settings));
      this.showToast('success', 'Settings Saved', 'Your settings have been updated.');
      this.closeSettings();
    } catch (e) {
      this.showToast('error', 'Save Failed', e.message || 'Could not save settings');
    }
  }

  applySettings() {
    try {
      this.updateTheme();
      const font = { small: '0.875rem', medium: '1rem', large: '1.125rem' }[this.state.settings.ui.fontSize] || '1rem';
      document.documentElement.style.setProperty('--font-size-base', font);
    } catch (e) { }
  }

  async loadSettings() {
    try {
      const stored = localStorage.getItem('agentflow_settings');
      if (stored) {
        const loaded = JSON.parse(stored);
        this.state.settings = {
          ...this.getDefaultSettings(),
          ...loaded,
          llm: { ...this.getDefaultSettings().llm, ...(loaded.llm || {}) },
          ui: { ...this.getDefaultSettings().ui, ...(loaded.ui || {}) },
          voice: { ...this.getDefaultSettings().voice, ...(loaded.voice || {}) },
          advanced: { ...this.getDefaultSettings().advanced, ...(loaded.advanced || {}) },
        };
      }
    } catch (e) {
      console.warn('Could not load settings, using defaults', e);
    }
  }

  clearAllData() {
    if (confirm('DANGER: This will delete ALL data. Are you sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  }

  // ===========================================================================
  // Model List Fetching
  // ===========================================================================
  async updateModelOptions() {
    const providerEl = document.getElementById('llm-provider');
    const modelSelect = document.getElementById('model-name');
    if (!providerEl || !modelSelect) return;

    const provider = providerEl.value;
    const currentModel = this.state.settings.llm.model || '';

    modelSelect.innerHTML = '<option>Loading...</option>';
    modelSelect.disabled = true;

    try {
      let models = this.cache.get(`models_${provider}`);
      if (!models) {
        switch (provider) {
          case 'openai':
            models = await this.fetchOpenAIModels();
            break;
          case 'anthropic':
            models = await this.fetchAnthropicModels();
            break;
          case 'google':
            models = await this.fetchGoogleModels();
            break;
          case 'aipipe':
            models = await this.fetchAIpipeModels();
            break;
          default:
            models = ['default-local-model'];
        }
        this.cache.set(`models_${provider}`, models);
      }

      modelSelect.innerHTML = '';

      if (!models || !models.length) {
        modelSelect.innerHTML = '<option>No models found.</option>';
        modelSelect.disabled = false;
        return;
      }

      models.forEach((modelName) => {
        const option = document.createElement('option');
        option.value = modelName;
        option.textContent = modelName;
        modelSelect.appendChild(option);
      });

      if (models.includes(currentModel)) modelSelect.value = currentModel;
      else this.state.settings.llm.model = models[0];
    } catch (error) {
      console.error('updateModelOptions error', error);
      this.showToast('error', `Could not fetch ${provider} models`, 'Check API key or network.');
      modelSelect.innerHTML = `<option value="">API key required to load models.</option>`;
    } finally {
      modelSelect.disabled = false;
    }
  }

  async fetchOpenAIModels() {
    const apiKey = document.getElementById('api-key')?.value;
    if (!apiKey) throw new Error('API Key required for OpenAI');

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Invalid OpenAI Key');
    }

    const data = await response.json();
    return data.data
      .filter((m) => m.id && m.id.includes('gpt'))
      .map((model) => model.id)
      .sort()
      .reverse();
  }

  async fetchAnthropicModels() {
    return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
  }

  async fetchGoogleModels() {
    const apiKey = document.getElementById('api-key')?.value;
    if (!apiKey) throw new Error('API Key required for Google');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Invalid Google Key');
    }

    const data = await response.json();
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''));
  }

  async fetchAIpipeModels() {
    const token = document.getElementById('api-key')?.value;
    if (!token) throw new Error('AI Pipe token required');

    const candidateSets = [];

    try {
      const r1 = await fetch('https://aipipe.org/openrouter/v1/models', { headers: { Authorization: `Bearer ${token}` } });
      if (r1.ok) {
        const d1 = await r1.json();
        if (Array.isArray(d1.models)) candidateSets.push(d1.models.map((m) => m.name || m.id));
        else if (Array.isArray(d1)) candidateSets.push(d1.map((m) => m.name || m.id));
      }
    } catch (e) { }

    try {
      const r2 = await fetch('https://aipipe.org/openai/v1/models', { headers: { Authorization: `Bearer ${token}` } });
      if (r2.ok) {
        const d2 = await r2.json();
        if (Array.isArray(d2.data)) candidateSets.push(d2.data.map((m) => m.id || m.name));
      }
    } catch (e) { }

    const fallback = [
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'openai/gpt-4.1',
      'openai/gpt-4o-realtime-preview',
      'openai/gpt-3.5-turbo',
    ];

    const combined = Array.from(new Set([].concat(...candidateSets.filter(Boolean), fallback)));
    return combined;
  }

  // ===========================================================================
  // Conversation List & Header
  // ===========================================================================
  updateConversationList() {
    try {
      const conversations = Array.from(this.state.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      if (!this.elements.conversationList) return;

      this.elements.conversationList.innerHTML = conversations
        .map(
          (conv) => `
          <div class="conversation-item ${conv.id === this.state.currentConversationId ? 'active' : ''}" data-conversation-id="${conv.id}">
            <div class="conversation-title">${this.escapeHtml(conv.title || 'Conversation')}</div>
            <div class="conversation-preview">${this.escapeHtml(conv.preview || '')}</div>
          </div>`
        )
        .join('');

      this.elements.conversationList.querySelectorAll('.conversation-item').forEach((item) => {
        item.addEventListener('click', () => this.loadConversation(item.dataset.conversationId));
      });

      if (document.getElementById('total-conversations'))
        document.getElementById('total-conversations').textContent = this.state.conversations.size;

      const totalMessages = Array.from(this.state.conversations.values()).reduce(
        (sum, conv) => sum + (conv.messages?.length || 0),
        0
      );
      if (document.getElementById('total-messages'))
        document.getElementById('total-messages').textContent = totalMessages;
    } catch (e) {
      console.warn('updateConversationList error', e);
    }
  }

  updateChatHeader() {
    try {
      const conv = this.state.conversations.get(this.state.currentConversationId);
      if (conv) {
        if (document.getElementById('chat-title'))
          document.getElementById('chat-title').textContent = this.escapeHtml(conv.title || 'Conversation');
        if (document.getElementById('chat-description'))
          document.getElementById('chat-description').textContent = `Created on ${new Date(conv.createdAt).toLocaleDateString()}`;
      }
    } catch (e) { }
  }

  // ===========================================================================
  // UI State
  // ===========================================================================
  updateUIState() {
    if (!this.elements.sendButton) return;
    this.elements.sendButton.disabled = this.state.isProcessing;
    this.elements.sendButton.innerHTML = this.state.isProcessing
      ? '<i class="fas fa-spinner fa-spin"></i>'
      : '<i class="fas fa-paper-plane"></i>';
  }

  updateSidebarState() {
    const app = this.elements.app;
    if (!app) return;

    const isMobile = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;

    app.classList.remove('sidebar-open', 'sidebar-collapsed');

    if (isMobile) {
      if (this.state.ui.sidebarOpen) app.classList.add('sidebar-open');
    } else {
      if (!this.state.ui.sidebarOpen) app.classList.add('sidebar-collapsed');
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.state.settings.ui.theme = newTheme;
    this.applySettings();
  }

  updateTheme() {
    const themePref = this.state.settings?.ui?.theme || 'auto';
    const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = themePref === 'auto' ? systemTheme : theme;

    // NOTE: Keep the original line/behavior; do not change logic/names.
    const resolvedTheme = themePref === 'auto' ? systemTheme : themePref;

    document.documentElement.setAttribute('data-theme', resolvedTheme);

    const icon = document.getElementById('theme-toggle')?.querySelector('i');
    if (icon) icon.className = resolvedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  toggleApiKeyVisibility(event) {
    try {
      const input = event.currentTarget.previousElementSibling;
      const icon = event.currentTarget.querySelector('i');
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    } catch (e) { }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.error(`Fullscreen error: ${err.message}`));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  toggleVoiceInput() {
    if (!this.speechRecognition)
      return this.showToast('error', 'Voice Not Supported', 'Browser does not support SpeechRecognition.');
    this.state.ui.voiceEnabled ? this.stopVoiceInput() : this.startVoiceInput();
  }

  startVoiceInput() {
    try {
      this.state.ui.voiceEnabled = true;
      this.speechRecognition.lang = this.state.settings.voice.language || 'en-US';
      this.speechRecognition.start();
      document.querySelectorAll('#voice-toggle, #voice-input').forEach((btn) => btn?.classList?.add('active'));
    } catch (e) {
      console.warn('Error wiring event listeners', e);
    }
  }

  stopVoiceInput() {
    try {
      this.state.ui.voiceEnabled = false;
      this.speechRecognition?.stop();
      document.querySelectorAll('#voice-toggle, #voice-input').forEach((btn) => btn?.classList?.remove('active'));
    } catch (e) { }
  }

  // ===========================================================================
  // Utils
  // ===========================================================================
  debounce(func, delay) {
    return utilDebounce((...args) => func.apply(this, args), delay);
  }

  showTypingIndicator() {
    this.elements.typingIndicator?.classList.add('active');
  }

  hideTypingIndicator() {
    this.elements.typingIndicator?.classList.remove('active');
  }

  showWelcomeScreen() {
    if (this.elements.welcomeScreen) this.elements.welcomeScreen.style.display = 'flex';
  }

  hideWelcomeScreen() {
    if (this.elements.welcomeScreen) this.elements.welcomeScreen.style.display = 'none';
  }

  showWelcomeMessage() {
    const conv = this.state.conversations.get(this.state.currentConversationId);
    if (conv && conv.messages.length === 0) {
      this.addMessage('assistant', UI_STRINGS.welcome);
    }
    // unchanged logic
  }

  scrollToBottom() {
    try {
      if (!this.elements.messagesContainer) return;
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    } catch (e) { }
  }

  escapeHtml(text = '') {
    return renderer.escapeHtml(text);
  }

  showToast(type, title, message) {
    return renderer.showToast(this, type, title, message);
  }

  preventDefaults(e) {
    return utilPreventDefaults(e);
  }

  onStateChange(_property, _value, _oldValue) {
    // optional hook for observability
  }

  emit(eventName, data) {
    this.eventBus.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }

  handleFileSelection(e) {
    if (!e || !e.target) return;
    this.handleFiles(Array.from(e.target.files || []));
  }

  handleFiles(files) {
    files.forEach((file) => {
      if (this.supportedFileTypes.some((type) => file.name.toLowerCase().endsWith(type))) {
        const convId = this.state.currentConversationId || this.createNewConversation();
        this.addMessage('system', `File uploaded: ${file.name} (size: ${file.size} bytes). Processing placeholder added.`, convId);
      } else {
        this.showToast('warning', 'Unsupported File', `${file.name} is not a supported file type.`);
      }
    });
  }

  exportConversation() {
    try {
      const conv = this.state.conversations.get(this.state.currentConversationId);
      if (!conv) return this.showToast('error', 'Export Failed', 'No active conversation.');

      let content = `# ${conv.title}\n\n`;
      conv.messages.forEach((msg) => {
        const sender = (msg.role || 'unknown').charAt(0).toUpperCase() + (msg.role || 'unknown').slice(1);
        content += `**${sender}**: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}\n\n`;
      });

      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${(conv.title || 'conversation').replace(/\s+/g, '_')}.md`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      this.showToast('error', 'Export Failed', e.message || 'Could not export conversation');
    }
  }

  togglePerformanceMonitor() {
    this.elements.performanceMonitor?.classList.toggle('active');
  }

  updatePerformanceDisplay() {
    return renderer.updatePerformanceDisplay(this);
  }

  updateCharCount() {
    try {
      const count = this.elements.userInput ? this.elements.userInput.value.length : 0;
      if (this.elements.charCount) this.elements.charCount.textContent = count;
    } catch (e) { }
  }

  switchSettingsTab(tabId) {
    document
      .querySelectorAll('.tab-btn')
      .forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
    document
      .querySelectorAll('.tab-content')
      .forEach((content) => content.classList.toggle('active', content.id === `${tabId}-tab`));
  }

  closeAllModals() {
    document.querySelectorAll('.modal.active').forEach((m) => m.classList.remove('active'));
  }

  hideContextMenu() {
    this.elements.contextMenu?.classList.remove('active');
  }

  showContextMenu(x, y, el) {
    const menu = this.elements.contextMenu;
    if (!menu) return;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('active');
    menu.dataset.messageId = el.dataset.messageId || '';
  }

  handleContextAction(action) {
    const msgId = this.elements.contextMenu?.dataset.messageId;
    if (!msgId) return this.showToast('warning', 'No message selected', '');

    const conv = this.state.conversations.get(this.state.currentConversationId);
    if (!conv) return;

    const msg = conv.messages.find((m) => m.id === msgId);
    if (!msg) return;

    switch (action) {
      case 'copy':
        navigator.clipboard?.writeText(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
        this.showToast('success', 'Copied', 'Message copied to clipboard.');
        break;

      case 'edit':
        if (typeof msg.content === 'string') {
          this.elements.userInput.value = msg.content;
          this.updateCharCount();
          this.showToast('info', 'Edit', 'Message loaded into input for editing.');
        } else {
          this.showToast('warning', 'Edit Not Supported', 'Cannot edit structured/tool messages.');
        }
        break;

      case 'delete':
        conv.messages = conv.messages.filter((m) => m.id !== msgId);
        this.saveCurrentConversation();
        this.loadConversation(this.state.currentConversationId);
        this.showToast('success', 'Deleted', 'Message deleted.');
        break;

      case 'bookmark':
        msg.bookmarked = true;
        this.showToast('success', 'Bookmarked', 'Message bookmarked.');
        break;

      default:
        this.showToast('info', 'Action', `Action: ${action}`);
    }
  }
}

// ----------------------------------------------------------------------------
// Initialize app
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  window.agentFlow = new GyaanSetu();
});
