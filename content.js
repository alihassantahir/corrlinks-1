const APPNAME = 'Corrlinks Extension 1';
const REFRESH_INTERVAL = 10 // This is the time in minutes Extension refreshes the page...

let C = {
  MESSAGES: {
    START_INTEGRATION: 'START_INTEGRATION',
  }
};

const STATE = {
  inboxRefreshInterval: null,
  messageRefreshInterval: null,
  inboxMonitorCycles: 0,
  stopNow: true,
};

function requestState()

{

  chrome.runtime.sendMessage({
    action: 'getState'
  }, (response) => {
    if (response && response.state) {
      const currentState = response.state;

      if (currentState) {
        if (isLoginPage()) {
          autoLogin()
          return
        }
        startUp();

      }
    }
  });
}

window.onload = () => {
  requestState()
};

function setState() {
  chrome.runtime.sendMessage({
    action: 'setState'
  });
}

function isDefaultPage() {
  const targetUrls = [
    'https://www.corrlinks.com/en-US/',
    'https://www.corrlinks.com/es-US/'
  ];

  return targetUrls.some(url => window.location.href === url);
}

function isLoginPage() {
  const targetUrls = [
    'https://www.corrlinks.com/en-US/login',
    'https://www.corrlinks.com/es-US/login'
  ];

  return targetUrls.some(url => window.location.href === url);
}

const utils = {
  page: {
    readMessage: {
      retrieveEmailAddress: () => {
        const fn = 'retrieveEmailAddress:';
        const multiselectElement = document.querySelector('[formcontrolname="contacts"]'); // More generic selector
        const result = multiselectElement ? multiselectElement.getAttribute('data-initial-value') : null;
        console.debug(fn, ` result = $ { result }`);
        return result;
      },
      retrieveSubjectLine: () => {
        const fn = 'retrieveSubjectLine:';

        const found = document.querySelector('input[formcontrolname="subject"]');

        const result = found ? found.value : false;

        console.debug(fn, ` result = $ { result }`);
        return result;
      },
      retrieveAccountAddress: async () => {
        const fn = 'retrieveAccountAddress:';

        const alreadyOpenedItem = document.getElementById('loggedInUser'); // Bug fixed here

        if (alreadyOpenedItem) {
          return Promise.resolve(alreadyOpenedItem.innerText);
        }

        const userButton = document.querySelector('header button:has(div.user-initials)');
        if (!userButton) {
          return Promise.reject();
        }

        userButton.click();

        return new Promise((resolve, reject) => {
          setTimeout(() => {
              const listItem = document.getElementById('loggedInUser');

              if (listItem) {
                resolve(listItem.innerText);
              } else {
                reject();
              }
            },
            500);
        });
      },
      retrieveFirstLine: () => {
        const fn = 'retrieveFirstLine:';
        const found = document.querySelector('textarea[formcontrolname="message"]');
        const result = found ? found.value : false;
        console.debug(fn, ` result = $ { result }`);
        return result;
      },
      retrieveTextarea: () => {
        const fn = 'retrieveTextarea:';
        const found = document.querySelector('textarea[formcontrolname="message"]');
        const result = found ? found.value : false;
        console.debug(fn, ` result = $ { result }`);
        return result;
      },
      closeReadMessage: () => {
        const fn = 'closeReadMessage:';
        console.debug(fn, 'called');
        setTimeout(() => {
            const cancelButton = [...document.querySelectorAll('button')].filter(
              btn => btn.textContent.trim() === 'Close')[0];

            if (cancelButton) {

              simulateClick(cancelButton)
              console.debug(fn, 'Button clicked');
            }
          },
          1000);
      },

      retrieveMessageFromUI: async () => {

        const fn = 'retrieveMessageFromUI:';
        console.debug(fn);

        const emailAddress = utils.page.readMessage.retrieveEmailAddress();

        const messageText = utils.page.readMessage.retrieveTextarea();
        const message = messageText;

        const subject = utils.page.readMessage.retrieveSubjectLine();
        const mobileNumber = formatPhoneNumber(subject) || "NA";

        const accountAddress = await utils.page.readMessage.retrieveAccountAddress();

        const data = {
          mobileNumber,
          message,
          emailAddress,
          subject,
          accountAddress
        };

        console.debug(fn, 'data collected', data);
        return data;
      },
      isDisplayingMessage: () => {
        const fn = 'isDisplayingMessage:';
        const result = document.title.includes('Inbox Message') && window.location.href.includes("https://www.corrlinks.com/en-US/mailbox/inbox/message");
        console.debug(fn, `result = $ { result }`);
        return result;
      },
    },
    inbox: {
      isDisplayingInbox: () => {
        const fn = 'isDisplayingInbox:';

        const urlMatches = location.href.includes('www.corrlinks.com/en-US/mailbox/inbox');

        const result = urlMatches;

        console.debug(fn, `result = $ { result }`);
        return result;
      },
      getUnreadMessagesCheckbox: () => {
        const fn = 'getUnreadMessagesCheckbox:';
        let unreadMessagesCheckbox = document.querySelector('input[type="checkbox"][formcontrolname="unreadMessagesOnly"]');
        console.debug(fn, `result =`, {
          unreadMessagesCheckbox
        });
        return unreadMessagesCheckbox;
      },
      setDisplayToUnreadMessagesOnly: () => {
        const fn = 'setDisplayToUnreadMessagesOnly:';
        console.debug(fn);

        let unreadMessagesCheckbox = utils.page.inbox.getUnreadMessagesCheckbox();
        if (!unreadMessagesCheckbox)
          return
        if (!unreadMessagesCheckbox.checked) {
          console.debug(fn, 'setting UI to only display unread messages');
          unreadMessagesCheckbox.click();
        } else {
          console.debug(fn, 'UI already set to only display unread messages');
        }
      },
      refresh: () => {
        const fn = 'refresh:';
        console.debug(fn, 'called');

        requestState();

        const unreadMessagesCheckbox = utils.page.inbox.getUnreadMessagesCheckbox();
        if (!unreadMessagesCheckbox && (!isLoginPage() || isDefaultPage())) {
          window.location.href = "https://www.corrlinks.com/en-US/mailbox/inbox"
          return
        }

        if (unreadMessagesCheckbox) {
          unreadMessagesCheckbox.click()
        }
      },
      getClickableItem_selectedMessage: () => {
        const fn = 'getClickableItem_selectedMessage:';
        let messageLists = document.querySelector('app-message-list')
        if (messageLists) // Try to Find in App Message list first
        {
          let result = messageLists.querySelector('tr[aria-selected="true"]');
          result = result?.closest('tr')?.querySelector('td');
          console.debug(fn, `result = $ { result }`);
          return result;
        } else // Fall back
        {

          let result = document.querySelector('tr[aria-selected="true"]');
          const row = result?.closest('tr');
          if (row)
            result = row.querySelector('td');
          console.debug(fn, `result = $ { result }`);
          return result;
        }
      },
      getClickableItem_unreadMessage: () => {
        const fn = 'getClickableItem_unreadMessage:';
        const result = document.querySelector('tr.e-row.grid-row-bold') || null;
        console.debug(fn, `result = $ { result }`);
        return result;
      },
      openMessageCollectSendAndClose: async (clickableItem) => {

        const fn = 'openMessageCollectSendAndClose:';
        console.debug(fn, {
          clickableItem
        });

        if (!clickableItem) {
          console.debug(fn, 'clickableItem is null. Abort');
          return Promise.resolve(null);
        }

        const checkbox = clickableItem.closest('tr').querySelector('td[data-colindex="1"]');
        if (checkbox) {
          checkbox.click();
        }

        clickableItem.click();
        const data = await utils.general.pageChangedtoMsg();

        if (utils.general.isValidDataset(data)) {
          const msg = {
            data: {
              to: data.mobileNumber,
              from: data.emailAddress,
              body: data.message,
              subject: data.subject,
              account: data.accountAddress
            },
            message: "QUEUE_NEW_MESSAGE_TO_WHATS_APP"
          };

          chrome.runtime.sendMessage(null, msg);
        }

        utils.page.readMessage.closeReadMessage();
      },
      hasNewMessage: () => {
        const fn = 'hasNewMessage:';
        const result = !!window.document.querySelectorAll('td.BoldItem').length;
        console.debug(fn, `result = $ { result }`);
        return result;
      },
    }
  },
  general: {
    isValidDataset: (potentialDataToSend) => {
      const fn = 'isValidDataset:';
      const result = potentialDataToSend.mobileNumber && potentialDataToSend.message && potentialDataToSend.emailAddress && potentialDataToSend.subject && potentialDataToSend.accountAddress;
      console.debug(fn, ` result = $ { result }`);
      return result;
    },

    pageChangedtoMsg: async () => {
      const fn = 'pageChangedtoMsg:';
      const timeoutDuration = 5000;
      const checkInterval = 1000;

      return new Promise(async (resolve) => {
        const startTime = Date.now();

        const intervalId = setInterval(async () => {

          if (STATE.stopNow) {
            clearInterval(STATE.intervalId);
            STATE.intervalId = null;
            console.log(fn, 'stopNow');
            return;

          }

          const isDisplayingMessage = utils.page.readMessage.isDisplayingMessage();
          console.debug(fn, `Checking message display: ${isDisplayingMessage}`);

          if (isDisplayingMessage) {

            const retrievedData = await utils.page.readMessage.retrieveMessageFromUI();
            clearInterval(intervalId);

            resolve(retrievedData);

          }
          if (Date.now() - startTime >= timeoutDuration) {
            clearInterval(intervalId);
            resolve(null);
          }
        }, checkInterval);
      });
    }
  }
}

function startInboxMonitor() {
  const fn = 'startInboxMonitor:';
  console.debug(fn);
  console.debug(fn, 'IMPORTANT: uncomment utils.page.inbox.setDisplayToUnreadMessagesOnly()');
  startIntervalForInboxMonitor();
}

async function startIntervalForInboxMonitor() {

  let paused = false;
  let pausedAnnounced = false;
  const fn = 'startIntervalForInboxMonitor:';

  window.clearInterval(STATE.inboxRefreshInterval);

  STATE.inboxRefreshInterval = window.setInterval(async () => {
    console.debug(fn, `interval cycle : $ { ++STATE.inboxMonitorCycles }`);
    if (STATE.stopNow) {
      paused = true;
      pausedAnnounced = true;
      window.clearInterval(STATE.inboxRefreshInterval);
      STATE.inboxRefreshInterval = null;
      console.log(fn, 'stopNow');
      return;
    }
    if (paused) {
      if (!pausedAnnounced) {
        console.debug(fn, 'Interval PAUSED');
        pausedAnnounced = true;
      }
      return;
    }

    let clickableMessageElement = utils.page.inbox.getClickableItem_selectedMessage();
    if (!clickableMessageElement) {
      clickableMessageElement = utils.page.inbox.getClickableItem_unreadMessage();
    }

    if (!clickableMessageElement) {
      return utils.page.inbox.refresh();
    }

    paused = true;

    await utils.page.inbox.openMessageCollectSendAndClose(clickableMessageElement);
    paused = false;
    pausedAnnounced = false;
    console.debug(fn, 'Interval UNPAUSED');
  }, REFRESH_INTERVAL * 1000);
}

function startUp() {
  const fn = 'startUp:';
  console.debug(fn);
  STATE.stopNow = false;
  startInboxMonitor();
  console.debug(fn, 'complete');
}

chrome.runtime.onMessage.addListener(
  async function(request, sender, sendResponse) {
    const fn = 'content.js: chrome.runtime.onMessage.addListener:';
    console.debug(fn, {
      request,
      sender,
      sendResponse
    });
    if (request.message === "START_INTEGRATION") {
      console.log('Start Integration message received');
      startUp();

      const corrlinks_account = await utils.page.readMessage.retrieveAccountAddress();

      if (corrlinks_account) {

        const password = prompt("Please enter password for " + corrlinks_account + ":");

        sendMessage({
          action: "SET_CORRLINKS_ACCOUNT",
          corrlinks_account,
          password // Include the password
        });
      }
      return;
    }
    if (request.message === "STOP_INTEGRATION") {
      console.log('Stop Integration message received');
      STATE.stopNow = true;
      console.debug(fn, 'stopNow set to true');
      return;
    }
  });

const countries = [{
    code: 'US',
    label: 'United States',
    phone: '1',
    suggested: true,
    phoneLength: 10,
  }

];

countries.sort(
  (a, b) =>
  b.phone.replace(/\D/g, '').length - a.phone.replace(/\D/g, '').length
);

function isValidUSPhoneNumber(number) {

  if (checkInternationalPhone(number)) {
    return true;
  } else {
    return false;
  }
}
var validWorldPhoneChars = "+";
var minDigitsInIPhoneNumber = 10;
var maxDigitsInIPhoneNumber = 13;
var AreaCode = new Array(205, 251, 659, 256, 334, 907, 403, 780, 264, 268, 520, 928, 480, 602, 623, 501, 479, 870, 242, 246, 441, 250, 604, 778, 284, 341, 442, 628, 657, 669, 747, 752, 764, 951, 209, 559, 408, 831, 510, 213, 310, 424, 323, 562, 707, 369, 627, 530, 714, 949, 626, 909, 916, 760, 619, 858, 935, 818, 415, 925, 661, 805, 650, 600, 809, 345, 670, 211, 720, 970, 303, 719, 203, 475, 860, 959, 302, 411, 202, 767, 911, 239, 386, 689, 754, 941, 954, 561, 407, 727, 352, 904, 850, 786, 863, 305, 321, 813, 470, 478, 770, 678, 404, 706, 912, 229, 710, 473, 671, 808, 208, 312, 773, 630, 847, 708, 815, 224, 331, 464, 872, 217, 618, 309, 260, 317, 219, 765, 812, 563, 641, 515, 319, 712, 876, 620, 785, 913, 316, 270, 859, 606, 502, 225, 337, 985, 504, 318, 318, 204, 227, 240, 443, 667, 410, 301, 339, 351, 774, 781, 857, 978, 508, 617, 413, 231, 269, 989, 734, 517, 313, 810, 248, 278, 586, 679, 947, 906, 616, 320, 612, 763, 952, 218, 507, 651, 228, 601, 557, 573, 636, 660, 975, 314, 816, 417, 664, 406, 402, 308, 775, 702, 506, 603, 551, 848, 862, 732, 908, 201, 973, 609, 856, 505, 575, 585, 845, 917, 516, 212, 646, 315, 518, 347, 718, 607, 914, 631, 716, 709, 252, 336, 828, 910, 980, 984, 919, 704, 701, 283, 380, 567, 216, 614, 937, 330, 234, 440, 419, 740, 513, 580, 918, 405, 905, 289, 647, 705, 807, 613, 519, 416, 503, 541, 971, 445, 610, 835, 878, 484, 717, 570, 412, 215, 267, 814, 724, 902, 787, 939, 438, 450, 819, 418, 514, 401, 306, 803, 843, 864, 605, 869, 758, 784, 731, 865, 931, 423, 615, 901, 325, 361, 430, 432, 469, 682, 737, 979, 214, 972, 254, 940, 713, 281, 832, 956, 817, 806, 903, 210, 830, 409, 936, 512, 915, 868, 649, 340, 385, 435, 801, 802, 276, 434, 540, 571, 757, 703, 804, 509, 206, 425, 253, 360, 564, 304, 262, 920, 414, 715, 608, 307, 867)

function isInteger(s)

{
  var i;

  for (i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (((c < "0") || (c > "9"))) return false;

  }
  return true;
}

function stripCharsInBag(s, bag)

{
  var i;

  var returnString = "";
  for (i = 0; i < s.length; i++)

  {
    var c = s.charAt(i);
    if (bag.indexOf(c) == -1) returnString += c;
  }
  return returnString;

}

function checkInternationalPhone(strPhone) {

  if (strPhone.indexOf("00") == 0) strPhone = strPhone.substring(2)

  if (strPhone.indexOf("+") > 1) return false

  if (strPhone.indexOf("+") == 0) strPhone = strPhone.substring(1)

  if (strPhone.indexOf("(") == -1 && strPhone.indexOf(")") != -1) return false

  if (strPhone.indexOf("(") != -1 && strPhone.indexOf(")") == -1) return false

  let s = stripCharsInBag(strPhone, validWorldPhoneChars);

  if (strPhone.length > 10) {
    var CCode = s.substring(0, s.length - 10);
  } else {
    CCode = "";
  }

  if (strPhone.length > 7) {
    var NPA = s.substring(s.length - 10, s.length - 7);
  } else {
    NPA = ""
  }

  var NEC = s.substring(s.length - 7, s.length - 4)

  if (CCode != "" && CCode != null) {

    if (CCode != "1" && CCode != "011" && CCode != "001") return false

  }

  if (NPA != "") {

    if (checkAreaCode(NPA) == false) {

      return false

    }

  } else {
    return false
  }

  return (isInteger(s) && s.length >= minDigitsInIPhoneNumber && s.length <= maxDigitsInIPhoneNumber);

}



function checkAreaCode(val) {

  var res = false;

  for (var i = 0; i < AreaCode.length; i++) {

    if (AreaCode[i] == val) res = true;

  }

  return res

}

function stripAreaCode(input) {
  if (input.length === 14 && input.charAt(3) === '1') {
    return input.slice(3);

  }
  return input;
}

function formatPhoneNumber(localNumber) {
  if (!localNumber) return
  let cleanedLocalNumber = localNumber.replace(/\D/g, '');

  if (cleanedLocalNumber.length === 14) {
    cleanedLocalNumber = stripAreaCode(cleanedLocalNumber);
  }

  const country = countries.find((c) => {
    const cleanedCountryPhone = c.phone.replace(/\D/g, '');
    return cleanedLocalNumber.startsWith(cleanedCountryPhone);
  });

  if (isValidUSPhoneNumber(cleanedLocalNumber) || !country) {
    let formattedNumber;
    if (cleanedLocalNumber.length === 10) {
      formattedNumber = `(${cleanedLocalNumber.slice(0, 3)}) ${cleanedLocalNumber.slice(3, 6)}-${cleanedLocalNumber.slice(6)}`;
      return formattedNumber;
    } else if (cleanedLocalNumber.length === 11 && cleanedLocalNumber[0] === '1') {
      formattedNumber = `(${cleanedLocalNumber.slice(1, 4)}) ${cleanedLocalNumber.slice(4, 7)}-${cleanedLocalNumber.slice(7)}`;
      return formattedNumber;
    } else if (cleanedLocalNumber.length === 11 && isValidUSPhoneNumber(cleanedLocalNumber)) {
      formattedNumber = `${cleanedLocalNumber.slice(0, 3)} ${cleanedLocalNumber.slice(3, 6)}-${cleanedLocalNumber.slice(6)}`;
      return formattedNumber;
    }
  }

  if (country) {
    const cleanedCountryCode = country.phone.replace(/\D/g, '');
    const localNumberOnly = cleanedLocalNumber.slice(cleanedCountryCode.length);

    let isValid = false;
    if (Array.isArray(country.phoneLength)) {
      isValid = country.phoneLength.includes(localNumberOnly.length);
    } else if (typeof country.phoneLength === 'object') {
      const {
        min,
        max
      } = country.phoneLength;
      isValid = localNumberOnly.length >= min && localNumberOnly.length <= max;
    } else if (country.phoneLength) {
      isValid = localNumberOnly.length === country.phoneLength;
    } else {
      isValid = true;
    }

    if (localNumberOnly.length < 5) {
      return;
    }
    if (!isValid && localNumberOnly.length > 13) {
      return;
    }

    let formattedNumber;
    if (country.label === 'USA' || country.label === 'Canada') {
      if (cleanedLocalNumber.length === 10) {
        formattedNumber = `(${cleanedLocalNumber.slice(0, 3)}) ${cleanedLocalNumber.slice(3, 6)}-${cleanedLocalNumber.slice(6)}`;
      } else {
        formattedNumber = `${localNumberOnly.slice(0, 3)} ${localNumberOnly.slice(3, 6)}-${localNumberOnly.slice(6)}`;
      }
    } else {
      const fullNumber = `+${cleanedCountryCode}${localNumberOnly}`;
      formattedNumber = fullNumber;
    }

    return formattedNumber;
  }
}




function simulateClick(element) {
  if (!element)
    return;

  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  element.dispatchEvent(mouseDownEvent);
  setTimeout(() => {
      element.dispatchEvent(mouseUpEvent);
      element.dispatchEvent(clickEvent);
      element.focus();
    },
    100);
}

let lastLoginTry = null;

function autoLogin() {
  const currentTime = new Date();

  // Throttling logic for login attempts
  if (lastLoginTry && (currentTime - lastLoginTry < 8000)) {
    return;
  } else if (lastLoginTry && (currentTime - lastLoginTry > 30000)) {
    return;
  }

  lastLoginTry = currentTime;

  fetchEmail((username) => {
    if (!username)
      return; // Exit if username is not retrieved

    fetchPassword((password) => {
      if (!password)
        return; // Exit if password is not retrieved

      const emailField = document.querySelector('input[formcontrolname="email"]');
      const passwordField = document.querySelector('input[formcontrolname="password"]');

      if (emailField && passwordField) {
        setField(emailField, username);
        setField(passwordField, password);

        const loginButton = Array.from(document.querySelectorAll('button'))
          .find(button => button.innerText === 'Login');

        setTimeout(() => {
            if (loginButton) {
              loginButton.click();
            }
          },
          3000);
      }
    });
  });
}

function setField(field, value) {
  if (field) {
    simulateClick(field);
    field.value = value;
    simulateInput(field);
    blurElement(field);
  }
}

function fetchEmail(callback) {
  chrome.runtime.sendMessage({
    action: 'getEmailAddress'
  }, (response) => {
    if (response.email) {
      callback(response.email);
    } else {
      setState()
      console.error("Failed to retrieve email address.");
      callback(null);
    }
  });
}

function fetchPassword(callback) {
  chrome.runtime.sendMessage({
    action: 'getPswd'
  }, (response) => {
    if (response.pswd) {
      callback(response.pswd);
    } else {

      setState()
      console.error("Failed to retrieve password.");
      callback(null);
    }
  });
}

function sendMessage(message) {
  chrome.runtime.sendMessage(null, message);
}

function simulateInput(element) {
  if (!element)
    return;
  const KBevent = new KeyboardEvent('keyup', {
    bubbles: true,
    cancelable: true,
    key: 'a',
    code: 'KeyA',
  });
  element.dispatchEvent(KBevent);
  element.dispatchEvent(new Event('input', {
    bubbles: true
  }));
  element.dispatchEvent(new Event('change', {
    bubbles: true
  }));
}

function simulateClick(element, nofocus) {
  if (!element)
    return;

  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  element.dispatchEvent(mouseDownEvent);

  setTimeout(() => {
      element.dispatchEvent(mouseUpEvent);
      if (!nofocus)
        element.focus();

      element.dispatchEvent(clickEvent);
    },
    100);
}

function blurElement(element) {
  if (!element)
    return;

  const event = new FocusEvent('blur', {
    bubbles: true,
    cancelable: true,
    view: window
  });

  element.dispatchEvent(event);
}

function specialClick(element) {
  if (!element)
    return
  const mousedownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  const mouseupEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(mousedownEvent);
  element.dispatchEvent(mouseupEvent);
}
