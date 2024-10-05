const APPNAME = 'Corrlinks Extension 1';
const SERVER = 'https://theeblvd.ngrok.io';
console.debug('background:', `${APPNAME} background.js started`);
console.debug(`Current ngrok server address: ${SERVER}`);
console.log('To see all logs, set the console to VERBOSE');

const C = {
  WEBSITE_DETAILS: {
    TITLE: 'CorrLinks',
    HOST: 'www.corrlinks.com',
    LOGIN: 'www.corrlinks.com/en-US/login',
    INBOX: 'https://www.corrlinks.com/en-US/mailbox/inbox'
  },
  SERVER: {
    SERVER: SERVER,
    SEND_POST_MESSAGE: `${SERVER}/message-from-corrlinks`
  }
};
const onIcon = {
  path: './images/wc-on.png'
};
const offIcon = {
  path: './images/wc-off.png'
};

let STATE = {
  running: false,
  tab: null
};

chrome.runtime.onInstalled.addListener(function(details) {
  const fn = 'chrome.runtime.onInstalled.addListener:';
  let msg = details.reason === 'install' ? `${APPNAME} Installed` : `${APPNAME} update Installed`;
  console.log(fn, msg);
});



chrome.action.onClicked.addListener(function() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!STATE.running) {
      start();
    } else {
      stop();

    }
  });
});

function start() {
  const fn = 'start:';
  if (STATE.running) return false;

  console.debug(fn);
  chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
    const tab = tabs[0];
    STATE.tab = tab;

    
    const result = isValidSite(tab);

    if (!result.isValid) {
      handleInvalidSite(tab, result.msg);
      return;
    }

    console.debug(fn, 'completed. Handing off to serverMessageListener');

    chrome.action.setIcon(onIcon);
    STATE.running = true;

    const msg = {
      message: "START_INTEGRATION"
    };
    sendMessageToTab(STATE.tab.id, msg);
    setupMessageListeners();

  });
}

function stop() {
  const fn = 'stop:';
  console.debug(fn, 'stopping integration');
  chrome.action.setIcon(offIcon);

  const msg = { message: "STOP_INTEGRATION" };
  if (STATE.tab) sendMessageToTab(STATE.tab.id, msg);

  resetState();
}


function handleInvalidSite(tab, msg) {
  resetState();
  showAlert(tab.id, tab.url, msg);
}

function isValidSite(tab) {

  if (tab.url.includes(C.WEBSITE_DETAILS.LOGIN)) {
    console.debug('Invalid host:', tab.url);
    return { isValid: false, msg: 'Login Page Detected: Please login and retry.' }; 
  }

  if (!tab.title.includes(C.WEBSITE_DETAILS.TITLE)) {
    console.debug('Invalid title:', tab.title);
    return { isValid: false, msg: `This extension can only be activated on a site with the title ${C.WEBSITE_DETAILS.TITLE}`}; 
  }
  
  if (!tab.url.includes(C.WEBSITE_DETAILS.HOST)) {
    console.debug('Invalid host:', tab.url);
    
    return { 
      isValid: false, 
      msg: `This extension can only be activated on a site hosted on ${C.WEBSITE_DETAILS.HOST}` 
    };
  }

  return { isValid: true, msg: 'Site is valid.' };
}



function showAlert(tabID, tabURL, message) {
  if (
    tabURL?.startsWith("chrome://") || // Chrome internal URLs
    tabURL?.startsWith("about:") || // About pages
    tabURL?.startsWith("file://") || // Local file access
    tabURL?.startsWith("data:") || // Data URLs
    tabURL?.includes("://localhost") || // Localhost access
    tabURL?.includes("127.0.0.1") || // Local IP access
    tabURL?.startsWith("chrome-extension://") || 
    tabURL?.startsWith("view-source:") // View source 
  )

 return // Should return because can't show alerts on these pages
  chrome.scripting.executeScript({
    target: { tabId: tabID },
    func: (alertMessage) => alert(alertMessage),
    args: [message],
  });
}

function resetState() {
  STATE.running = false;
  STATE.tab = null;
  chrome.action.setIcon(offIcon);
  removeMessageListeners();
}

function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message)
    .then(response => {})
    .catch(error => {});
}

function sendMessageToServer(data) {
  const fn = 'sendMessageToServer:';
  const url = C.SERVER.SEND_POST_MESSAGE;
console.log("Sending request to:", url);

  const config = {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };

  fetch(url, config)
    .then(r => {
      if (!r.ok) return Promise.reject(`HTTP error: ${r.status}`);
      if (!r.headers.get("content-type")?.includes("application/json")) return Promise.reject('Non-JSON response');
      return r.json();
    })
    .then(responseData => {
      console.debug(fn, 'Response data:', responseData);
    })
    .catch(error => {
      console.debug('Error:', error);
    });
}

function setupMessageListeners() {
  console.debug('setupMessageListeners:');
  chrome.runtime.onMessage.addListener(chrome_runtime_onMessage_listener);
}

function removeMessageListeners() {
  console.debug('removeMessageListeners:');
  chrome.runtime.onMessage.removeListener(chrome_runtime_onMessage_listener);
}

function chrome_runtime_onMessage_listener(request, sender, sendResponse) {
  console.log('chrome_runtime_onMessage_listener:', { request });
  if (request.message === "QUEUE_NEW_MESSAGE_TO_WHATS_APP") {
    sendMessageToServer(request.data);
  }
  sendResponse({ status: "Received Msg" });
}



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
const tabId = sender.tab ? sender.tab.id : undefined;
  
  switch (request.action) {
    case 'getState':
      if (tabId && STATE.tab && tabId === STATE.tab.id) { // This ensure only 1x Tab stays active by ignoring requests from other tabs
	      console.log(`Request from the Target tab`);
        sendResponse({ state: STATE.running });
      } 
      break;
      
    case 'setState':
        stop();
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (STATE.tab && STATE.tab.id === tabId) {
    resetState();
    console.debug('Tab closed, reset state.');
  }
});
