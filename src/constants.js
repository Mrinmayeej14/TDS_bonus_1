/**
 * LeafAI - Constants and Defaults (ES Modules)
 * Refactored for readability and consistency. No logic or names changed.
 */

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

export const DEFAULTS = {
  llm: {
    provider: 'aipipe',
    apiKey: '',
    model: 'default',
    maxTokens: 2000,
    temperature: 0.7,
  },
  ui: {
    theme: 'auto',
    animationsEnabled: true,
    soundEnabled: false,
    fontSize: 'medium',
  },
  voice: {
    enabled: false,
    outputEnabled: false,
    language: 'en-US',
    speechRate: 1.0,
  },
  advanced: {
    autoSave: true,
    analyticsEnabled: false,
    maxHistory: 100,
  },
};

// -----------------------------------------------------------------------------
// Tools
// -----------------------------------------------------------------------------

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          results: { type: 'integer', default: 5 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_code',
      description: 'Execute JavaScript code safely',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'process_file',
      description: 'Process and analyze uploaded files',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
          operation: { type: 'string', default: 'analyze' },
        },
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
        properties: {
          data: { type: 'string' },
          type: { type: 'string', default: 'line' },
          title: { type: 'string' },
        },
        required: ['data'],
      },
    },
  },
];

// -----------------------------------------------------------------------------
// UI Strings
// -----------------------------------------------------------------------------

export const UI_STRINGS = {
  welcome: 'Welcome to LeafAI! How can I assist you?',
};
