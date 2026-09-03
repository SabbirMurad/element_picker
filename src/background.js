// Service worker: owns the toolbar button and injects the content scripts on demand.
//
// We rely on `activeTab` rather than broad host permissions, so nothing is
// injected until the user actually clicks the toolbar icon on a given tab.

const CONTENT_FILES = [
  'src/content/picker.js',
  'src/content/format.js',
  'src/content/extract.js',
  'src/content/highlight.js',
  'src/content/panel.js',
  'src/content/content.js'
];

const BLOCKED_SCHEME = /^(chrome|edge|brave|opera|vivaldi|about|devtools|view-source|chrome-extension|moz-extension|file):/i;

// Chrome refuses content scripts on its own pages and on the Web Store,
// no matter what permissions we hold.
function isInjectable(url) {
  if (!url) return false;
  if (BLOCKED_SCHEME.test(url)) return false;
  if (/^https:\/\/chromewebstore\.google\.com/i.test(url)) return false;
  if (/^https:\/\/chrome\.google\.com\/webstore/i.test(url)) return false;
  return true;
}

function setBadge(tabId, active) {
  chrome.action.setBadgeText({ tabId, text: active ? 'ON' : '' }).catch(() => {});
  if (active) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#007ACC' }).catch(() => {});
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null || !isInjectable(tab.url)) return;

  // The scripts may already be there from an earlier click on this tab.
  // Try to talk to them first; only inject if nobody answers.
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PICKER' });
    return;
  } catch {
    // No receiver yet — fall through and inject.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: CONTENT_FILES
    });
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PICKER' });
  } catch (err) {
    console.error('[element-picker] injection failed:', err);
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'PICKER_STATE' && sender.tab?.id != null) {
    setBadge(sender.tab.id, msg.active);
  }
});

// A navigation tears down the content scripts, so drop the stale badge.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') setBadge(tabId, false);
});
