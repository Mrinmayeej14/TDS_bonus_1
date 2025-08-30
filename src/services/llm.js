/**
 * services/llm.js
 * Extracted LLM network calls and response parsing.
 * No behavior changes from original agent.js implementations.
 */

/**
 * Call the configured LLM provider.
 * @param {Object} conversation - { id, title, messages: [...] }
 * @param {Object} settings - full settings object, expects settings.llm { provider, apiKey, model, maxTokens, temperature }
 * @returns {Promise<any>} provider response JSON
 */
export async function callLLM(conversation, settings) {
  // Build messages in provider-agnostic shape (OpenAI chat style)
  const messagesForApi = (conversation.messages || [])
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'system',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        };
      }
      return {
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      };
    })
    .filter((m) => !!m.content);

  const { provider, apiKey, model, maxTokens, temperature } = (settings && settings.llm) || {};
  if (!provider) throw new Error('No LLM provider configured.');

  // Demo mode fallback
  if (!apiKey) {
    // return a local mock response
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
      // maps to Google Generative API
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      // google uses API key in query string; keep content
      body = {
        messages: messagesForApi.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          content: m.content,
        })),
        temperature,
        maxOutputTokens: maxTokens,
      };
      break;

    case 'aipipe':
      // AI Pipe acts as a proxy. We'll send to its OpenRouter-compatible endpoint by default.
      // AI Pipe docs: https://aipipe.org/ — supports endpoints like /openrouter/v1/chat/completions and /openai/v1/...
      apiUrl = 'https://aipipe.org/openrouter/v1/chat/completions';
      headers.Authorization = `Bearer ${apiKey}`;
      body = {
        model: model || 'openai/gpt-4o-mini', // fallback
        messages: messagesForApi.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
      };
      break;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  // POST request with simple error handling
  try {
    const resp = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      // attempt to parse error body
      let errText = `${resp.status} ${resp.statusText}`;
      try {
        const errJson = await resp.json();
        errText = errJson.error?.message || JSON.stringify(errJson);
      } catch (_) {}
      throw new Error(
        `Model not supported for your API key — change model in settings. (Status: ${resp.status}, Details: ${errText})`
      );
    }
    const data = await resp.json();
    return data;
  } catch (err) {
    // bubble up to caller
    throw new Error(err.message || 'Network error');
  }
}

/**
 * Parse the provider response into a normalized shape { content, tool_calls? }
 * @param {any} data
 * @param {string} provider
 * @returns {{ content: string } | any}
 */
export function parseAPIResponse(data, provider) {
  try {
    switch (provider) {
      case 'openai':
      case 'aipipe':
        // OpenAI-style responses (or AI Pipe proxying OpenAI/OpenRouter)
        if (data.choices && data.choices.length > 0) {
          return data.choices[0].message || { content: data.choices[0].text || '' };
        }
        // openrouter style sometimes returns 'content' or 'candidates'
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
    // Keep behavior identical to original (throw on parse errors)
    throw new Error('Could not parse the API response.');
  }
}
