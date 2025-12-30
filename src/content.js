(function () {
  try {
    // Check if Readability was loaded (injected by sidepanel.js)
    if (typeof Readability === 'undefined') {
      throw new Error("Readability library not loaded.");
    }

    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone).parse();

    if (!article) {
      return { error: "Could not extract main content from this page." };
    }

    return {
      title: article.title,
      content: article.textContent, // Clean text
      url: window.location.href,
      siteName: article.siteName || window.location.hostname
    };
  } catch (e) {
    return { error: e.message };
  }
})();