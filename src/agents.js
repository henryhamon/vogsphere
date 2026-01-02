/**
 * Vogsphere Agent Definitions
 * This file contains the prompt logic for the specific cognitive agents.
 */

// 1. Definition of Agent Behaviors (The "Brains")
const AGENT_DIRECTIVES = {
  /**
   * Summarizer Agent: Focuses on compression and academic accessibility.
   */
  summarizer: (language) => `
    [AGENT: SUMMARIZER]
    Task: Create a summary that is academic in tone yet accessible to a general audience.
    Constraint: Strictly limit the summary to a maximum of 3 sentences.
    Output Language: ${language}.
    `,

  /**
   * Insight Agent: Focuses on extracting the core novelty or concept.
   */
  insight: (language) => `
    [AGENT: INSIGHT]
    Task: Identify the "Canonical Insight" — the single most critical, novel, or useful idea in the text.
    Sub-task: Identify 2 nuances or variations of this insight.
    Formatting: You MUST use **bold** for key terms and concepts within the text.
    Output Language: ${language}.
    `,

  /**
   * Research Specialist Agent: Focuses on deep academic synthesis.
   */
  research_specialist: (language) => `
    [AGENT: RESEARCH SPECIALIST]
    Task: Act as an academic research specialist. Prepare an article that synthesizes the main ideas and findings, raises questions, presents evidence, methodologies, results, and implications of the study.
    Requirement: Include key terms and conecpts, as well as provide the necessary context or background information.
    Constraint: The article should function as a standalone text, offering readers a comprehensive understanding of the study’s importance without requiring them to read the full document.
    Output Language: ${language}.
    `,

  /**
   * Zettelkasten Agent: Focuses on atomicity and modular knowledge.
   */
  zettelkasten: (language) => `
    [AGENT: ZETTELKASTEN]
    Task: Extract "Atomic Ideas" from the content.
    Definition: An atomic idea is a single, self-contained concept that can be understood without the rest of the text.
    Format: A bulleted list.
    Output Language: ${language}.
    `,

  /**
   * Librarian Agent: Focuses on taxonomy, metadata, and file organization.
   */
  librarian: (language) => `
    [AGENT: LIBRARIAN]
    Task 1: Generate 3-5 relevant hashtags (starting with #vogsphere).
    Task 2: Suggest a concise filename for this note (no spaces, use underscores).
    Task 3: Identify the publication date (or use today's date if not found).
    Output Language: ${language} (except for filename, which should be safe-string).
    `
};

export const Agents = {
  // System Prompt: Defines the overarching persona and output format rules
  systemPrompt: `You are Vogsphere, a distributed bureaucratic intelligence running inside a browser. 
    You manage a team of cognitive sub-agents (Summarizer, Insight, Zettelkasten, Librarian, Research Specialist).
    Your goal is to orchestrate their outputs into a single, perfectly formatted Markdown document.
    Do not add conversational filler. Output ONLY the final Markdown.`,

  /**
   * Orchestrates the agents to process the content.
   */
  async runProcessing(content, profile) {
    // Extract Configuration
    const { fields, provider, language } = profile;
    const model = fields.model || 'gpt-4o-mini';

    // Config Extraction
    let baseUrl = fields.baseUrl || '';
    let apiKey = fields.apiKey || '';

    // Azure Specifics
    const deployment = fields.deployment;
    const apiVersion = fields.apiVersion;

    // URL Construction & Header Preparation
    let url = '';
    const headers = {
      'Content-Type': 'application/json'
    };

    if (provider === 'azure') {
      // Azure OpenAI Construction
      // Expected Base URL: https://{resource}.openai.azure.com/
      // Target: https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}

      // Clean trailing slash
      baseUrl = baseUrl.replace(/\/+$/, '');
      if (!baseUrl.startsWith('http')) {
        // Assume user provided resource name only
        baseUrl = `https://${baseUrl}.openai.azure.com`;
      }

      url = `${baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
      headers['api-key'] = apiKey;

    } else if (provider === 'claude') {
      // Anthropic
      url = baseUrl; // usually https://api.anthropic.com/v1/messages
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';

    } else {
      // Standard OpenAI / Ollama / Gemini / Grok
      // Normalize URL to /chat/completions if not present
      baseUrl = baseUrl.replace(/\/+$/, '');
      if (!baseUrl.includes('/chat/completions')) {
        // If it's just the root (e.g. https://api.openai.com/v1), add endpoint
        if (!baseUrl.includes('/v1') && provider !== 'ollama') baseUrl += '/v1'; // Ollama often has v1 included or not

        // For Ollama, often http://localhost:11434/v1/chat/completions
        url = `${baseUrl}/chat/completions`;
      } else {
        url = baseUrl;
      }

      // Auth Header (Skip for Ollama if key is empty)
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    // 2. Assembly of the Composite Prompt
    const prompt = `
        SOURCE MATERIAL:
        Title: ${content.title}
        URL: ${content.url}
        Content: ${content.content.substring(0, 15000)} ... [truncated]
        
        ---
        
        EXECUTE AGENT DIRECTIVES:
        
        ${AGENT_DIRECTIVES.summarizer(language)}
        
        ${AGENT_DIRECTIVES.insight(language)}

        ${AGENT_DIRECTIVES.research_specialist(language)}
        
        ${AGENT_DIRECTIVES.zettelkasten(language)}
        
        ${AGENT_DIRECTIVES.librarian(language)}
        
        ---
        
        FINAL OUTPUT FORMAT (STRICT MARKDOWN):
        
        # {Title Suggested by Librarian Agent}
        
        > **Canonical Insight:** {Output from Insight Agent}
        
        ## Executive Summary
        {Output from Summarizer Agent}

        ## Comprehensive Research Analysis
        {Output from Research Specialist Agent}
        
        ## Atomic Concepts (Zettelkasten)
        {Output from Zettelkasten Agent}
        
        ## Metadata
        - **Source:** [${content.title}](${content.url})
        - **Date:** {Date from Librarian}
        - **Tags:** {Tags from Librarian}
        `;

    // 3. API Execution
    try {
      console.log(`[Vogsphere] Connecting to: ${url} (Provider: ${provider})`);

      let body;

      if (provider === 'claude') {
        body = JSON.stringify({
          model: model,
          system: this.systemPrompt,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.3
        });
      } else {
        // Standard Body
        body = JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: this.systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          stream: false
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: body
      });

      if (!response.ok) {
        let errText = "";
        try {
          errText = await response.text();
        } catch (e) {
          errText = "Could not read error body";
        }
        throw new Error(`Agent Connection Error (${response.status} ${response.statusText}): ${errText}`);
      }

      const data = await response.json();

      // Handle Response Formats
      if (data.choices && data.choices.length > 0) return data.choices[0].message.content;
      if (data.message) return data.message.content; // Ollama common
      if (data.content && Array.isArray(data.content)) return data.content[0].text; // Anthropic

      throw new Error("Invalid response structure from provider.");

    } catch (error) {
      console.error("Vogsphere Core Error:", error);
      throw error;
    }
  }
};