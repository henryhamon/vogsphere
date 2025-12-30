import { Agents } from './agents.js';
import { downloadMarkdown } from './utils.js';

// Default configurations
const DEFAULTS = {
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ollama: { url: 'http://localhost:11434/v1', model: 'llama3' },
  litellm: { url: 'http://localhost:4000', model: 'gpt-3.5-turbo' }, // LiteLLM default port
  custom: { url: '', model: '' }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const data = await chrome.storage.local.get([
    'apiKey', 'baseUrl', 'modelName', 'targetLanguage', 'providerPreset'
  ]);

  if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
  if (data.baseUrl) document.getElementById('baseUrl').value = data.baseUrl;
  if (data.modelName) document.getElementById('modelName').value = data.modelName;
  if (data.targetLanguage) document.getElementById('targetLanguage').value = data.targetLanguage;
  if (data.providerPreset) document.getElementById('providerPreset').value = data.providerPreset;

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