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
    You manage a team of cognitive sub-agents (Summarizer, Insight, Zettelkasten, Librarian).
    Your goal is to orchestrate their outputs into a single, perfectly formatted Markdown document.
    Do not add conversational filler. Output ONLY the final Markdown.`,

  /**
   * Orchestrates the agents to process the content.
   */
  async runProcessing(content, config) {
    // Defaults
    const model = config.modelName || 'gpt-4o-mini';
    const language = config.targetLanguage || 'English';

    // Prepare API URL
    let baseUrl = config.baseUrl.replace(/\/+$/, '');
    if (!baseUrl.includes('/chat/completions')) {
      if (!baseUrl.includes('/v1')) baseUrl += '/v1';
      baseUrl += '/chat/completions';
    }

    // 2. Assembly of the Composite Prompt
    // We inject the specific instructions for each agent here.
    const prompt = `
        SOURCE MATERIAL:
        Title: ${content.title}
        URL: ${content.url}
        Content: ${content.content.substring(0, 15000)} ... [truncated]
        
        ---
        
        EXECUTE AGENT DIRECTIVES:
        
        ${AGENT_DIRECTIVES.summarizer(language)}
        
        ${AGENT_DIRECTIVES.insight(language)}
        
        ${AGENT_DIRECTIVES.zettelkasten(language)}
        
        ${AGENT_DIRECTIVES.librarian(language)}
        
        ---
        
        FINAL OUTPUT FORMAT (STRICT MARKDOWN):
        
        # {Title Suggested by Librarian Agent}
        
        > **Canonical Insight:** {Output from Insight Agent}
        
        ## Executive Summary
        {Output from Summarizer Agent}
        
        ## Atomic Concepts (Zettelkasten)
        {Output from Zettelkasten Agent}
        
        ## Metadata
        - **Source:** [${content.title}](${content.url})
        - **Date:** {Date from Librarian}
        - **Tags:** {Tags from Librarian}
        `;

    // 3. API Execution
    try {
      console.log(`[Vogsphere] Connecting to: ${baseUrl} with model: ${model}`);

      let body, method = 'POST';
      const headers = {
        'Content-Type': 'application/json'
      };

      if (config.providerPreset === 'claude') {
        // Anthropic Adapter
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';

        body = JSON.stringify({
          model: model,
          system: this.systemPrompt,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.3
        });
      } else {
        // Standard OpenAI / Ollama Adapter
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

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

      const response = await fetch(baseUrl, {
        method: method,
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

      // Handle standard OpenAI format or Ollama/LiteLLM variations
      // Handle standard OpenAI format or Ollama/LiteLLM variations
      if (data.choices && data.choices.length > 0) return data.choices[0].message.content;
      if (data.message) return data.message.content;

      // Handle Anthropic Format
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        return data.content[0].text;
      }

      throw new Error("Invalid response structure from provider.");

    } catch (error) {
      console.error("Vogsphere Core Error:", error);
      throw error;
    }
  }
};