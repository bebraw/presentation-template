const defaultProvider = process.env.STUDIO_LLM_PROVIDER || "openai";
const defaultGenerationMode = process.env.STUDIO_IDEATE_MODE || "auto";

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return provider || "openai";
}

function normalizeBaseUrl(value, fallback) {
  const raw = String(value || fallback || "").trim();
  if (!raw) {
    return "";
  }

  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function getProviderSettings(provider) {
  switch (provider) {
    case "openai":
      return {
        apiKey: process.env.OPENAI_API_KEY || "",
        baseUrl: "https://api.openai.com/v1",
        configuredReason: "Set OPENAI_API_KEY to enable the OpenAI provider.",
        configured: Boolean(process.env.OPENAI_API_KEY || ""),
        model: process.env.STUDIO_LLM_MODEL || process.env.OPENAI_MODEL || "gpt-5.2"
      };
    case "lmstudio": {
      const model = process.env.STUDIO_LLM_MODEL || process.env.LMSTUDIO_MODEL || process.env.OPENAI_MODEL || "";
      return {
        apiKey: process.env.LMSTUDIO_API_KEY || "",
        baseUrl: normalizeBaseUrl(
          process.env.STUDIO_LLM_BASE_URL || process.env.LMSTUDIO_BASE_URL,
          "http://127.0.0.1:1234/v1"
        ),
        configuredReason: "Set LMSTUDIO_MODEL or STUDIO_LLM_MODEL to the loaded LM Studio model identifier.",
        configured: Boolean(model),
        model
      };
    }
    default:
      return {
        apiKey: "",
        baseUrl: "",
        configuredReason: `Unsupported LLM provider "${provider}".`,
        configured: false,
        model: ""
      };
  }
}

function getLlmConfig() {
  const provider = normalizeProvider(process.env.STUDIO_LLM_PROVIDER || defaultProvider);
  const settings = getProviderSettings(provider);

  return {
    available: settings.configured,
    baseUrl: settings.baseUrl,
    configured: settings.configured,
    configuredReason: settings.configuredReason,
    defaultGenerationMode: process.env.STUDIO_IDEATE_MODE || defaultGenerationMode,
    model: settings.model,
    provider
  };
}

function getLlmStatus() {
  const config = getLlmConfig();
  return {
    available: config.configured,
    baseUrl: config.baseUrl,
    configuredReason: config.configuredReason,
    defaultGenerationMode: config.defaultGenerationMode,
    model: config.model,
    provider: config.provider
  };
}

function extractResponseOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const texts = [];
  const output = Array.isArray(payload.output) ? payload.output : [];

  output.forEach((item) => {
    if (!item || item.type !== "message" || !Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (contentItem && contentItem.type === "output_text" && typeof contentItem.text === "string") {
        texts.push(contentItem.text);
      }
    });
  });

  return texts.join("\n").trim();
}

function extractChatCompletionText(payload) {
  const content = payload
    && Array.isArray(payload.choices)
    && payload.choices[0]
    && payload.choices[0].message
    ? payload.choices[0].message.content
    : null;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item) {
          return "";
        }

        if (typeof item.text === "string") {
          return item.text;
        }

        if (typeof item.content === "string") {
          return item.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function parseStructuredText(text, options, config, payload) {
  if (!text) {
    throw new Error(`${config.provider} response did not contain structured text output`);
  }

  try {
    return {
      data: JSON.parse(text),
      model: payload.model || options.model || config.model,
      provider: config.provider,
      responseId: payload.id || null
    };
  } catch (error) {
    throw new Error(`${config.provider} response was not valid JSON: ${error.message}`);
  }
}

async function createOpenAiStructuredResponse(config, options) {
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: options.developerPrompt,
              type: "input_text"
            }
          ],
          role: "developer"
        },
        {
          content: [
            {
              text: options.userPrompt,
              type: "input_text"
            }
          ],
          role: "user"
        }
      ],
      max_output_tokens: options.maxOutputTokens || 2600,
      model: options.model || config.model,
      store: false,
      text: {
        format: {
          name: options.schemaName,
          schema: options.schema,
          strict: true,
          type: "json_schema"
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parseStructuredText(extractResponseOutputText(payload), options, config, payload);
}

async function createLmStudioStructuredResponse(config, options) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (process.env.LMSTUDIO_API_KEY) {
    headers.Authorization = `Bearer ${process.env.LMSTUDIO_API_KEY}`;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      max_tokens: options.maxOutputTokens || 2600,
      messages: [
        {
          content: options.developerPrompt,
          role: "system"
        },
        {
          content: options.userPrompt,
          role: "user"
        }
      ],
      model: options.model || config.model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          schema: options.schema,
          strict: true
        }
      },
      stream: false,
      temperature: 0
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : `LM Studio request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parseStructuredText(extractChatCompletionText(payload), options, config, payload);
}

async function createStructuredResponse(options) {
  const config = getLlmConfig();
  if (!config.configured) {
    throw new Error(`LLM generation is not configured. ${config.configuredReason}`);
  }

  switch (config.provider) {
    case "openai":
      return createOpenAiStructuredResponse(config, options);
    case "lmstudio":
      return createLmStudioStructuredResponse(config, options);
    default:
      throw new Error(`Unsupported LLM provider "${config.provider}"`);
  }
}

module.exports = {
  createStructuredResponse,
  getLlmConfig,
  getLlmStatus
};
