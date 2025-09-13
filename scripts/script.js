const firebaseConfig = {
    apiKey: "AIzaSyAcyqPpPq0dXLez3MINPXfYvy6LnOCkbPM",
    authDomain: "cringechat-cc04f.firebaseapp.com",
    databaseURL: "https://cringechat-cc04f-default-rtdb.firebaseio.com",
    projectId: "cringechat-cc04f",
    storageBucket: "cringechat-cc04f.appspot.com",
    messagingSenderId: "1078798953034",
    appId: "1:1078798953034:web:78081799548359f3e294b3",
    measurementId: "G-FGHETW90V3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const typingUsers = new Set();
let initialUsersLoaded = false;

let username = localStorage.getItem('username');
while (!username || username.trim() === "") {
    username = prompt("What's your username oomf?");
    if (username) {
        username = username.trim();
    }
}
localStorage.setItem('username', username);

let randomColor = localStorage.getItem('coloredUsername');
if (!randomColor) {
    randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    localStorage.setItem('coloredUsername', randomColor);
}
const coloredUsernameHtml = `<span style="color:${randomColor}">${username}</span>`;

const typingRef = db.ref('typing');
const usersRef = db.ref('users');
const pingsRef = db.ref('pings');

const typingNotificationArea = document.getElementById("typing-notification");
const backgroundMusicPlayer = document.getElementById("background-music-player");
const musicSelector = document.getElementById("music-selector");

const joinSound = new Audio('sound/buddyin.mp3');
const leaveSound = new Audio('sound/buddyout.mp3');
const mentionSound = new Audio('sound/mention.mp3');

let typingTimeout;
let messageSendTimeout;

const userOnlineRef = usersRef.child(username);

userOnlineRef.onDisconnect().remove();
userOnlineRef.set(true);

// Listen for new users joining
usersRef.on('child_added', function(snapshot) {
    const joinedUsername = snapshot.key;
    if (initialUsersLoaded && joinedUsername !== username) {
        db.ref("messages").push({
            msg: `<span style="color:green">${joinedUsername} joined the chat</span>`,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        joinSound.play().catch(e => console.error("Failed to play join sound:", e));
    }
});

// Listen for users leaving
usersRef.on('child_removed', function(snapshot) {
    const leftUsername = snapshot.key;
    if (leftUsername !== username) {
        db.ref("messages").push({
            msg: `<span style="color:red">${leftUsername} left the chat</span>`,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        leaveSound.play().catch(e => console.error("Failed to play leave sound:", e));
    }
});

// Use a one-time listener to set the flag after initial users are loaded
usersRef.once('value', () => {
    initialUsersLoaded = true;
});


document.getElementById("chat-txt").addEventListener("input", () => {
    typingRef.child(username).set(true);

    clearTimeout(typingTimeout);
    clearTimeout(messageSendTimeout);

    typingTimeout = setTimeout(() => {
        typingRef.child(username).remove();
    }, 3000);

    messageSendTimeout = setTimeout(() => {
        const chatTxtElement = document.getElementById("chat-txt");
        if (chatTxtElement.value.trim() !== "") {
            postChat({ preventDefault: () => {} });
        }
    }, 10000);
});

typingRef.on('child_added', function(snapshot) {
    const typingUsername = snapshot.key;
    if (typingUsername !== username) {
        typingUsers.add(typingUsername);
    }
    updateTypingNotificationDisplay();
});

typingRef.on('child_removed', function(snapshot) {
    const typingUsername = snapshot.key;
    typingUsers.delete(typingUsername);
    updateTypingNotificationDisplay();
});

function updateTypingNotificationDisplay() {
    if (typingUsers.size === 0) {
        typingNotificationArea.innerHTML = "";
    } else if (typingUsers.size === 1) {
        typingNotificationArea.innerHTML = `<small>${Array.from(typingUsers)[0]} is typing...</small>`;
    } else {
        const usersArray = Array.from(typingUsers);
        const lastUser = usersArray.pop();
        if (usersArray.length === 0) {
            typingNotificationArea.innerHTML = `<small>${lastUser} is typing...</small>`;
        } else {
            typingNotificationArea.innerHTML = `<small>${usersArray.join(', ')} and ${lastUser} are typing...</small>`;
        }
    }
}

document.getElementById("send-message").addEventListener("submit", postChat);

function postChat(e) {
    e.preventDefault();

    clearTimeout(typingTimeout);
    clearTimeout(messageSendTimeout);

    const chatTxt = document.getElementById("chat-txt");
    let message = chatTxt.value;
    chatTxt.value = "";

    typingRef.child(username).remove();

    if (message.trim() === "") {
        updateTypingNotificationDisplay();
        return;
    }

    const mentionRegex = /@(\w+)/g;
    let formattedMessage = message.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:blue;">$1</a>');
    let mentionedUsers = [];

    const matches = message.matchAll(mentionRegex);
    for (const match of matches) {
        const mentionedUsername = match[1];
        mentionedUsers.push(mentionedUsername);
        formattedMessage = formattedMessage.replace(
            `@${mentionedUsername}`,
            `<span class="mention">@${mentionedUsername}</span>`
        );
    }

    const timestamp = firebase.database.ServerValue.TIMESTAMP;

    if (message === "!help") {
        db.ref("messages").push({
            usr: "sYs (bot)",
            msg: "<i style='color:gray'>someone used the !help command</i> Hi, I'm sYs",
            createdAt: timestamp
        });
    } else {
        db.ref("messages").push({
            usr: coloredUsernameHtml,
            msg: formattedMessage,
            createdAt: timestamp
        });
    }

    mentionedUsers.forEach(mentionedUsername => {
        if (mentionedUsername !== username) {
            pingsRef.child(mentionedUsername).push({
                sender: username,
                timestamp: timestamp,
                read: false
            });
        }
    });

    updateTypingNotificationDisplay();
    scrollToBottom();
}

const fetchChat = db.ref("messages");
fetchChat.on("child_added", function(snapshot) {
    const messages = snapshot.val();
    let msgContent = '';
    if (messages.usr) {
        msgContent = `<li>${messages.usr} : ${messages.msg}</li>`;
    } else {
        msgContent = `<li>${messages.msg}</li>`;
    }
    document.getElementById("messages").innerHTML += msgContent;
    scrollToBottom();
});

function scrollToBottom() {
    const chatBox = document.querySelector(".chat-box");
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

const userPingsRef = pingsRef.child(username);
let unreadPingsCount = 0;
const originalTitle = document.title;

userPingsRef.on('child_added', function(snapshot) {
    const pingData = snapshot.val();
    if (!pingData.read) {
        unreadPingsCount++;
        updatePageTitle();
        mentionSound.play().catch(e => console.error("Failed to play mention sound:", e));
    }
});

function updatePageTitle() {
    if (unreadPingsCount > 0) {
        const pingCountDisplay = unreadPingsCount > 9 ? "9+" : unreadPingsCount;
        document.title = `(${pingCountDisplay}) ${originalTitle}`;
    } else {
        document.title = originalTitle;
    }
}

window.addEventListener('focus', () => {
    if (unreadPingsCount > 0) {
        setTimeout(() => {
            userPingsRef.once('value', snapshot => {
                const updates = {};
                snapshot.forEach(childSnapshot => {
                    updates[childSnapshot.key + '/read'] = true;
                });
                if (Object.keys(updates).length > 0) {
                    userPingsRef.update(updates);
                }
            });
            unreadPingsCount = 0;
            updatePageTitle();
        }, 500);
    }
});

// Music Player Functions
function loadAndPlaySelectedMusic() {
    const selectedSong = musicSelector.value;
    if (selectedSong) {
        backgroundMusicPlayer.src = selectedSong;
        backgroundMusicPlayer.load();
        playCurrentMusic();
    } else {
        backgroundMusicPlayer.pause();
        backgroundMusicPlayer.src = "";
    }
}

function playCurrentMusic() {
    if (backgroundMusicPlayer.src) {
        backgroundMusicPlayer.volume = 0.1;
        backgroundMusicPlayer.play().catch(e => console.error("Failed to play music:", e));
    }
}

function pauseCurrentMusic() {
    backgroundMusicPlayer.pause();
}

function stopCurrentMusic() {
    backgroundMusicPlayer.pause();
    backgroundMusicPlayer.currentTime = 0;
}

function play() {
    var audio = document.getElementById("audio");
    audio.play();
}

// Global functions for HTML event handlers
window.loadAndPlaySelectedMusic = loadAndPlaySelectedMusic;
window.playCurrentMusic = playCurrentMusic;
window.pauseCurrentMusic = pauseCurrentMusic;
window.stopCurrentMusic = stopCurrentMusic;
window.play = play;

//Auto-Deletion
function deleteOldMessages() {
  // 20 minutes in milliseconds
  const cutoff = Date.now() - 20 * 60 * 1000;
  
  const messagesRef = db.ref("messages");

  const oldMessagesQuery = messagesRef.orderByChild("createdAt").endAt(cutoff);

  oldMessagesQuery.once("value", (snapshot) => {
    const updates = {};
    snapshot.forEach((child) => {
      updates[child.key] = null; // Set to null to delete the message
    });
    
    if (Object.keys(updates).length > 0) {
      messagesRef.update(updates)
        .then(() => {
          console.log(`Successfully deleted ${Object.keys(updates).length} old messages.`);
        })
        .catch((error) => {
          console.error("Failed to delete old messages:", error);
        });
    }
  });
}

// Run the deletion function every 5 minutes
setInterval(deleteOldMessages, 5 * 60 * 1000);

document.addEventListener("DOMContentLoaded", function() {
  const titlebar = document.getElementById("music-window-titlebar");
  const windowToDrag = titlebar.parentElement;

  let isDragging = false;
  let offsetX, offsetY;

  titlebar.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - windowToDrag.offsetLeft;
    offsetY = e.clientY - windowToDrag.offsetTop;
    windowToDrag.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    // Calculate new position
    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;

    // Update element position
    windowToDrag.style.left = `${newX}px`;
    windowToDrag.style.top = `${newY}px`;
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    windowToDrag.style.cursor = "grab";
    document.body.style.userSelect = "auto";
  });
});