import { Agents } from './agents.js';
import { downloadMarkdown } from './utils.js';

// Default configurations
const DEFAULTS = {
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ollama: { url: 'http://localhost:11434/v1', model: 'llama3' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-1.5-flash' },
  grok: { url: 'https://api.x.ai/v1', model: 'grok-beta' },
  claude: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20240620' },
  custom: { url: '', model: '' }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const data = await chrome.storage.local.get([
    'apiKey', 'baseUrl', 'modelName', 'targetLanguage', 'providerPreset'
  ]);

  if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
  if (data.targetLanguage) document.getElementById('targetLanguage').value = data.targetLanguage;

  // Handle Legacy/Deprecated Presets
  let currentPreset = data.providerPreset || 'ollama';
  if (!DEFAULTS[currentPreset]) {
    // If the saved preset (e.g., 'litellm') no longer exists in DEFAULTS, force reset to 'ollama'
    currentPreset = 'ollama';
    console.log('[Vogsphere] Migrating legacy preset to Ollama default.');

    // Apply defaults immediately
    document.getElementById('baseUrl').value = DEFAULTS.ollama.url;
    document.getElementById('modelName').value = DEFAULTS.ollama.model;
    document.getElementById('providerPreset').value = 'ollama';

    // Save the migration
    chrome.storage.local.set({
      providerPreset: 'ollama',
      baseUrl: DEFAULTS.ollama.url,
      modelName: DEFAULTS.ollama.model
    });
  } else {
    // Load normally
    document.getElementById('providerPreset').value = currentPreset;
    if (data.baseUrl) document.getElementById('baseUrl').value = data.baseUrl;
    if (data.modelName) document.getElementById('modelName').value = data.modelName;
  }

  // Preset Change Handler
  document.getElementById('providerPreset').addEventListener('change', (e) => {
    const type = e.target.value;
    if (DEFAULTS[type]) {
      document.getElementById('baseUrl').value = DEFAULTS[type].url;
      document.getElementById('modelName').value = DEFAULTS[type].model;
    }
  });

  // Toggle Settings
  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.toggle('hidden');
  });

  // Save Settings
  document.getElementById('saveSettings').addEventListener('click', () => {
    const config = {
      apiKey: document.getElementById('apiKey').value,
      baseUrl: document.getElementById('baseUrl').value,
      modelName: document.getElementById('modelName').value,
      targetLanguage: document.getElementById('targetLanguage').value,
      providerPreset: document.getElementById('providerPreset').value
    };

    chrome.storage.local.set(config, () => {
      const status = document.getElementById('status');
      status.innerText = "Settings saved successfully.";
      setTimeout(() => status.innerText = "", 2000);
      document.getElementById('settingsPanel').classList.add('hidden');
    });
  });

  // Process Button
  document.getElementById('btnProcess').addEventListener('click', processCurrentTab);

  // Download & Copy Buttons (Same as before)
  document.getElementById('btnDownload').addEventListener('click', () => {
    const content = document.getElementById('markdownOutput').value;
    const titleMatch = content.match(/^#\s+(.+)/);
    const filename = titleMatch ? titleMatch[1] : 'vogsphere_note';
    downloadMarkdown(content, filename);
  });

  document.getElementById('btnCopy').addEventListener('click', () => {
    const copyText = document.getElementById("markdownOutput");
    copyText.select();
    navigator.clipboard.writeText(copyText.value).then(() => {
      document.getElementById('status').innerText = "Copied to clipboard!";
    }).catch(err => {
      document.getElementById('status').innerText = "Failed to copy: " + err;
    });
  });
});

async function processCurrentTab() {
  const statusDiv = document.getElementById('status');
  const resultArea = document.getElementById('resultArea');

  try {
    statusDiv.innerText = "Initializing extraction sequence...";
    resultArea.classList.add('hidden');

    // Load complete config
    const config = await chrome.storage.local.get([
      'apiKey', 'baseUrl', 'modelName', 'targetLanguage'
    ]);

    if (!config.baseUrl) throw new Error("Base URL is required.");

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    statusDiv.innerText = "Injecting Vogon probes...";

    // Inject Readability
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js']
    });

    // Inject Extractor
    const [executionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content.js']
    });

    const extractedData = executionResult.result;

    if (!extractedData || extractedData.error) {
      throw new Error(extractedData?.error || "Extraction failed.");
    }

    statusDiv.innerText = `Processing with ${config.modelName || 'LLM'}...`;

    // Call Agent with expanded config
    const markdownResult = await Agents.runProcessing(
      extractedData,
      config
    );

    document.getElementById('markdownOutput').value = markdownResult;
    resultArea.classList.remove('hidden');
    statusDiv.innerText = "Processing complete.";

  } catch (error) {
    statusDiv.innerText = `Error: ${error.message}`;
    console.error(error);
  }
}