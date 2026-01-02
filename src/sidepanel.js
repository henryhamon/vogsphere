import { Agents } from './agents.js';
import { downloadMarkdown } from './utils.js';

// Default Field Configurations
// Defines which fields are visible for each provider
const PROVIDER_FIELDS = {
  openai: ['fieldBaseUrl', 'fieldModel', 'fieldApiKey'],
  azure: ['fieldBaseUrl', 'fieldDeployment', 'fieldApiVersion', 'fieldApiKey'],
  ollama: ['fieldBaseUrl', 'fieldModel'],
  gemini: ['fieldApiKey', 'fieldModel'],
  grok: ['fieldApiKey', 'fieldModel'],
  claude: ['fieldApiKey', 'fieldModel'],
  custom: ['fieldBaseUrl', 'fieldModel', 'fieldApiKey']
};

const DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  azure: { baseUrl: '', deployment: '', apiVersion: '2023-05-15', model: '' }, // Model often not needed for Azure if deployment implies it, but can be useful for metadata
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-1.5-flash' },
  grok: { baseUrl: 'https://api.x.ai/v1', model: 'grok-beta' },
  claude: { baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20240620' },
  custom: { baseUrl: '', model: '' }
};

let profiles = [];
let activeProfileId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initializeStorage();
  renderProfiles();
  loadActiveProfile();
  attachEventListeners();
});

async function initializeStorage() {
  const data = await chrome.storage.local.get(['profiles', 'activeProfileId', 'apiKey', 'baseUrl']);

  if (!data.profiles || data.profiles.length === 0) {
    // Migration Logic
    console.log("Initializing profiles or migrating legacy settings...");
    const legacyProfile = {
      id: crypto.randomUUID(),
      name: "Default Profile",
      provider: data.providerPreset || 'ollama',
      fields: {
        baseUrl: data.baseUrl || DEFAULTS.ollama.baseUrl,
        apiKey: data.apiKey || '',
        model: data.modelName || DEFAULTS.ollama.model,
        apiVersion: '',
        deployment: ''
      },
      language: data.targetLanguage || 'English'
    };

    profiles = [legacyProfile];
    activeProfileId = legacyProfile.id;

    await saveState();

    // Clean up legacy keys
    await chrome.storage.local.remove(['apiKey', 'baseUrl', 'modelName', 'providerPreset']);
  } else {
    profiles = data.profiles;
    activeProfileId = data.activeProfileId || profiles[0].id; // Fallback
  }
}

function getActiveProfile() {
  return profiles.find(p => p.id === activeProfileId) || profiles[0];
}

function renderProfiles() {
  const selector = document.getElementById('profileSelector');
  selector.innerHTML = '';
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    selector.appendChild(opt);
  });
  selector.value = activeProfileId;
}

function loadActiveProfile() {
  const profile = getActiveProfile();
  if (!profile) return;

  activeProfileId = profile.id;

  // Set Profile Name
  document.getElementById('profileName').value = profile.name;

  // Set Provider
  const provider = profile.provider || 'openai';
  document.getElementById('provider').value = provider;

  // Update Visibility First
  updateFormVisibility(provider);

  // Set Fields
  document.getElementById('baseUrl').value = profile.fields.baseUrl || '';
  document.getElementById('apiKey').value = profile.fields.apiKey || '';
  document.getElementById('modelName').value = profile.fields.model || '';
  document.getElementById('deploymentName').value = profile.fields.deployment || '';
  document.getElementById('apiVersion').value = profile.fields.apiVersion || '';

  // Set Language
  document.getElementById('targetLanguage').value = profile.language || 'English';
}

function updateFormVisibility(provider) {
  // Hide all dynamic fields first
  ['fieldBaseUrl', 'fieldDeployment', 'fieldApiVersion', 'fieldModel', 'fieldApiKey'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  // Show relevant fields
  const fieldsToShow = PROVIDER_FIELDS[provider] || PROVIDER_FIELDS['custom'];
  fieldsToShow.forEach(id => {
    document.getElementById(id).classList.remove('hidden');
  });

  // If selecting a provider, pre-fill defaults if empty and suggested
  if (DEFAULTS[provider]) {
    const savedBase = document.getElementById('baseUrl').value;
    // Only overwrite if it looks like we switched to a standard provider that has a fixed URL
    if (provider !== 'custom' && provider !== 'azure') {
      // Logic to auto-fill could be annoying if user has custom tweaks, 
      // so we only do it if the field is empty or was using another default.
      // For now, let's just leave it manual or user selects.
      // Actually, helpful behavior: if switching provider, load default for that provider?
      // No, this happens on 'change'.
    }
  }
}

async function saveCurrentProfileFromForm() {
  const profileIndex = profiles.findIndex(p => p.id === activeProfileId);
  if (profileIndex === -1) return;

  const provider = document.getElementById('provider').value;

  profiles[profileIndex] = {
    id: activeProfileId,
    name: document.getElementById('profileName').value,
    provider: provider,
    fields: {
      baseUrl: document.getElementById('baseUrl').value,
      apiKey: document.getElementById('apiKey').value,
      model: document.getElementById('modelName').value,
      deployment: document.getElementById('deploymentName').value,
      apiVersion: document.getElementById('apiVersion').value,
    },
    language: document.getElementById('targetLanguage').value
  };

  await saveState();
  renderProfiles(); // Update name in list
  showStatus("Profile saved!");
}

async function saveState() {
  await chrome.storage.local.set({
    profiles: profiles,
    activeProfileId: activeProfileId
  });
}

function showStatus(msg) {
  const status = document.getElementById('status');
  status.innerText = msg;
  setTimeout(() => status.innerText = "", 2000);
}

function attachEventListeners() {
  // Toggle Settings
  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.toggle('hidden');
  });

  // Profile Selector
  document.getElementById('profileSelector').addEventListener('change', (e) => {
    activeProfileId = e.target.value;
    loadActiveProfile();
    chrome.storage.local.set({ activeProfileId });
  });

  // New Profile
  document.getElementById('btnNewProfile').addEventListener('click', async () => {
    const newId = crypto.randomUUID();
    const newProfile = {
      id: newId,
      name: "New Profile",
      provider: "openai",
      fields: {
        baseUrl: DEFAULTS.openai.baseUrl,
        model: DEFAULTS.openai.model,
        apiKey: "",
        deployment: "",
        apiVersion: ""
      },
      language: "English"
    };
    profiles.push(newProfile);
    activeProfileId = newId;
    await saveState();
    renderProfiles();
    loadActiveProfile();
  });

  // Delete Profile
  document.getElementById('btnDeleteProfile').addEventListener('click', async () => {
    if (profiles.length <= 1) {
      showStatus("Cannot delete the last profile.");
      return;
    }
    if (!confirm("Are you sure you want to delete this profile?")) return;

    profiles = profiles.filter(p => p.id !== activeProfileId);
    activeProfileId = profiles[0].id;
    await saveState();
    renderProfiles();
    loadActiveProfile();
  });

  // Provider Change
  document.getElementById('provider').addEventListener('change', (e) => {
    const provider = e.target.value;
    updateFormVisibility(provider);

    // Auto-fill defaults for convenience
    if (DEFAULTS[provider]) {
      if (provider !== 'azure') {
        document.getElementById('baseUrl').value = DEFAULTS[provider].baseUrl;
        document.getElementById('modelName').value = DEFAULTS[provider].model;
      } else {
        // Clear Base URL for Azure as it is user-specific? Or keep empty.
        document.getElementById('baseUrl').value = '';
      }
    }
  });

  // Save Button
  document.getElementById('saveProfile').addEventListener('click', () => {
    saveCurrentProfileFromForm();
    document.getElementById('settingsPanel').classList.add('hidden');
  });

  // Process Logic & Copy/Download (Same as before)
  document.getElementById('btnProcess').addEventListener('click', processCurrentTab);

  document.getElementById('btnDownload').addEventListener('click', () => {
    const content = document.getElementById('markdownOutput').value;
    const titleMatch = content.match(/^#\s+(.+)/);
    const filename = titleMatch ? titleMatch[1] : 'vogsphere_note';
    downloadMarkdown(content, filename);
  });

  document.getElementById('btnCopy').addEventListener('click', () => {
    const copyText = document.getElementById("markdownOutput");
    copyText.select();
    navigator.clipboard.writeText(copyText.value)
      .then(() => showStatus("Copied to clipboard!"))
      .catch(err => showStatus("Failed to copy: " + err));
  });
}

async function processCurrentTab() {
  const statusDiv = document.getElementById('status');
  const resultArea = document.getElementById('resultArea');

  try {
    const profile = getActiveProfile();
    // Validate Current Profile
    if (!profile) throw new Error("No active profile found.");

    // Specific validations
    if (profile.provider === 'azure') {
      if (!profile.fields.baseUrl) throw new Error("Azure Endpoint (Base URL) is required.");
      if (!profile.fields.deployment) throw new Error("Azure Deployment Name is required.");
      if (!profile.fields.apiVersion) throw new Error("Azure API Version is required.");
      if (!profile.fields.apiKey) throw new Error("Azure API Key is required.");
    } else if (profile.provider !== 'ollama') {
      // Most others need API Key
      if (!profile.fields.apiKey && profile.provider !== 'custom') throw new Error("API Key is required.");
    }

    statusDiv.innerText = "Initializing extraction sequence...";
    resultArea.classList.add('hidden');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    statusDiv.innerText = "Injecting Vogon probes...";

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js']
    });

    const [executionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content.js']
    });

    const extractedData = executionResult.result;

    if (!extractedData || extractedData.error) {
      throw new Error(extractedData?.error || "Extraction failed.");
    }

    statusDiv.innerText = `Processing with ${profile.name}...`;

    const markdownResult = await Agents.runProcessing(
      extractedData,
      profile
    );

    document.getElementById('markdownOutput').value = markdownResult;
    resultArea.classList.remove('hidden');
    statusDiv.innerText = "Processing complete.";

  } catch (error) {
    statusDiv.innerText = `Error: ${error.message}`;
    console.error(error);
  }
}