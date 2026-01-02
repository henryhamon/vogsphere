# 🪐 Vogsphere: The Bureaucratic Second Brain

> *"Resistance is futile. Your chaotic web browsing will be processed, summarized, and filed."*

**Vogsphere** is a Chrome Extension designed to serve as a rigorous "Second Brain" ingestion tool. It runs entirely in your browser (client-side), extracting messy web content and submitting it to a council of AI Agents that return strictly formatted **Zettelkasten** notes for **Obsidian**.

Designed for users of **Gemini**, **Claude**, **Grok**, **Ollama**, and **OpenAI**.

## ✨ Features

* **Side Panel Interface**: Stays open while you browse, allowing for continuous research without context switching.
* **Distraction-Free Extraction**: Uses a custom implementation of Mozilla's `Readability.js` to strip ads, popups, and clutter.
* **Multi-Profile Management**: Create, save, and switch between multiple configuration profiles (e.g., "Work - Azure", "Personal - Ollama").
* **Universal LLM Support**:
    * 🏠 **Local**: Connect to **Ollama** directly.
    * 🌐 **Cloud**: Native support for **Azure OpenAI**, **OpenAI**, **Gemini**, **Claude**, and **Grok**.

* **Multi-Agent Architecture**: Five specialized "cognitive agents" run in parallel to process information:
    1. **Summarizer Agent**: Generates accessible academic abstracts.
    2. **Insight Agent**: Extracts the single "Canonical Insight" and nuances.
    3. **Research Specialist**: Produces a standalone, deep-dive academic article.
    4. **Zettelkasten Agent**: Atomizes concepts for modular knowledge.
    5. **Librarian Agent**: Handles taxonomy, tagging, and filename generation.


* **Polyglot Output**: Configure the agents to write notes in English, Portuguese, Spanish, German, etc., regardless of the source text language.

## 📂 Project Structure

```text
vogsphere/
├── manifest.json       # V3 Configuration
├── src/
│   ├── agents.js       # The cognitive prompts and logic
│   ├── background.js   # Service worker
│   ├── content.js      # DOM extractor
│   ├── sidepanel.js    # Main UI Logic
│   └── utils.js        # Helpers
└── lib/
    └── Readability.js  # (Required dependency)

```

## 🛠️ Installation

### Prerequisites

* Google Chrome (or Chromium-based browser like Brave/Edge).

### Step 1: Clone the Repository

```bash
git clone https://github.com/henryhamon/vogsphere.git
cd vogsphere

```

### Step 2: Download Dependency

Due to licensing and modularity, `Readability.js` is not bundled. You must download it manually.

1. Download the standalone script: [Mozilla Readability.js](https://www.google.com/search?q=https://raw.githubusercontent.com/mozilla/readability/master/Readability.js).
2. Save it strictly to: `vogsphere/lib/Readability.js`.

### Step 3: Load into Chrome

1. Open `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the `vogsphere` folder.

## ⚙️ Configuration

### 1. Profile Management
Vogsphere now supports multiple profiles. Use the top bar to:
* **Select**: Switch between saved configurations.
* **+ (New)**: Create a new profile (starts with OpenAI defaults).
* **- (Delete)**: Remove the current profile.
* **Save**: Persist your changes to the active profile.

### 2. Provider Settings
The settings form adjusts dynamically based on your specific provider:

| Provider | Required Fields | URL Pattern (Auto-Generated) |
| --- | --- | --- |
| **OpenAI** | API Key, Model | `https://api.openai.com/v1` |
| **Azure OpenAI** | Endpoint, Deployment, API Version, Key | `https://{resource}.openai.azure.com/...` |
| **Ollama** | Base URL, Model | `http://localhost:11434/v1` |
| **Gemini** | API Key, Model | `https://generativelanguage.googleapis.../openai` |
| **Anthropic** | API Key, Model | `https://api.anthropic.com/v1/messages` |
| **Custom** | Base URL, Model, Key | Flexible (e.g. `https://my-api.com/v1` or full path) |

> **Tip:** You can edit settings and click "Process" immediately to test changes. Saving is only required to persist the profile for later.

### 3. Agent Preferences

* **Output Language**: Select the language you want your notes to be written in (e.g., Portuguese). The agents will translate and adapt the analysis automatically.

## 🧠 How It Works (The Agent Chain)

Vogsphere doesn't just "summarize". It passes the content through a prompt chain defined in `src/agents.js`:

1. **Extraction**: `content.js` cleans the DOM.
2. **Directives**: The system constructs a composite prompt containing instructions for all 5 agents.
3. **Processing**: The LLM processes the directives in a single pass (to save latency/tokens).
4. **Formatting**: The result is returned as a Markdown block ready to be pasted into Obsidian.

## 📝 Example Output

```markdown
# The_Future_of_AI_Agents

> **Canonical Insight:** The shift from chat-based interfaces to **agentic workflows** represents the next evolution in AI, moving from passive response to active problem solving.

## Executive Summary
This article argues that Large Language Models are transitioning into operating systems for autonomous agents. It highlights that current architectures are limited by context windows, but new memory frameworks allow for persistent tasks.

## Comprehensive Research Analysis
**The Evolution of Agentic Systems**

The study posits a fundamental shift in AI interaction paradigms... [Deep dive content] ... The methodology employed involves a comparative analysis of zero-shot performance versus chain-of-thought prompting in agentic frameworks.

## Atomic Concepts (Zettelkasten)
- Agentic workflows reduce human-in-the-loop latency.
- Memory persistence is the bottleneck for long-horizon tasks.
- Tool-use capability distinguishes Chatbots from Agents.

## Metadata
- **Source:** [TechCrunch Article](https://...)
- **Date:** 2024-05-20
- **Tags:** #vogsphere #ai_agents #automation

```

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/AmazingAgent`).
3. Commit your changes.
4. Open a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.


---

> *"Space is big. You just won't believe how vastly, hugely, mind-bogglingly big it is. I mean, you may think it's a long way down the road to the chemist's, but that's just peanuts to space."*


## 🛸 Credits

This project was built as a **vibecoding** test using **[Antigravity](https://antigravity.google)**, Google's advanced agentic IDE, and powered by **[Gemini 3 Pro](https://deepmind.google/technologies/gemini/Pro)**.

Conducted by **Henry Hamon** ([@henryhamon](https://github.com/henryhamon)).