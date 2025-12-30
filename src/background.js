// background.js
console.log('Vogsphere extension background service worker started.');

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
