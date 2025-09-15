document.addEventListener("DOMContentLoaded", function() {

    const popupOverlay = document.getElementById('popup-overlay');
    const welcomePopup = document.getElementById('welcome-popup');
    const closePopupButton = document.getElementById('close-popup');
    const usernameForm = document.getElementById('username-form');
    const usernameInput = document.getElementById('username-input');

    function showPopup() {
        if (popupOverlay && welcomePopup) {
            popupOverlay.style.display = 'block';
            welcomePopup.style.display = 'block';
        }
    }

    function hidePopup() {
        if (popupOverlay && welcomePopup) {
            popupOverlay.style.display = 'none';
            welcomePopup.style.display = 'none';
        }
    }

    let username = localStorage.getItem('username');
    if (!username) {
        showPopup();

        usernameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            username = usernameInput.value.trim();
            if (username) {
                localStorage.setItem('username', username);
                hidePopup();
                window.location.reload();
            }
        });

        closePopupButton.addEventListener('click', () => {
            hidePopup();
        });

        return; 
    }

    // Initialize Firebase
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
    const drawingRef = db.ref('drawings');
    const typingRef = db.ref('typing');
    const usersRef = db.ref('users');
    const pingsRef = db.ref('pings');
    const messagesRef = db.ref("messages");

    const typingUsers = new Set();
    let initialUsersLoaded = false;
    const lastLeaveTimestamp = {};

    let randomColor = localStorage.getItem('coloredUsername');
    if (!randomColor) {
        randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        localStorage.setItem('coloredUsername', randomColor);
    }
    const coloredUsernameHtml = `<span style="color:${randomColor}">${username}</span>`;

    const typingNotificationArea = document.getElementById("typing-notification");
    const backgroundMusicPlayer = document.getElementById("background-music-player");
    const musicSelector = document.getElementById("music-selector");
    
    // Check for elements before assigning events
    if (musicSelector) {
        musicSelector.addEventListener('change', loadAndPlaySelectedMusic);
    }

    const joinSound = new Audio('sound/buddyin.mp3');
    const leaveSound = new Audio('sound/buddyout.mp3');
    const mentionSound = new Audio('sound/mention.mp3');

    let typingTimeout;
    let messageSendTimeout;

    const userOnlineRef = usersRef.child(username);
    userOnlineRef.onDisconnect().remove();
    userOnlineRef.set(true).then(() => {
        messagesRef.push({
            msg: `<span style="color:green">${username} joined the chat</span>`,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
    });

    usersRef.on('child_removed', function(snapshot) {
        const leftUsername = snapshot.key;
        if (leftUsername !== username) {
            lastLeaveTimestamp[leftUsername] = Date.now();

            setTimeout(() => {
                if (lastLeaveTimestamp[leftUsername]) {
                    messagesRef.push({
                        msg: `<span style="color:red">${leftUsername} left the chat</span>`,
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                    leaveSound.play().catch(e => console.error("Failed to play leave sound:", e));
                    delete lastLeaveTimestamp[leftUsername];
                }
            }, 5000);
        }
    });

    initialUsersLoaded = true;

    if (document.getElementById("chat-txt")) {
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
    }

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
        if (!typingNotificationArea) return;
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

    if (document.getElementById("send-message")) {
        document.getElementById("send-message").addEventListener("submit", postChat);
    }

    function postChat(e) {
        e.preventDefault();

        clearTimeout(typingTimeout);
        clearTimeout(messageSendTimeout);

        const chatTxt = document.getElementById("chat-txt");
        if (!chatTxt) return;
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
            messagesRef.push({
                usr: "sYs (bot)",
                msg: "<i style='color:gray'>someone used the !help command</i> Hi, I'm sYs",
                createdAt: timestamp
            });
        } else {
            messagesRef.push({
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

    function displayMessage(messageData) {
        const messagesElement = document.getElementById("messages");
        if (!messagesElement) return;
        let msgContent = '';

        if (messageData.usr) {
            msgContent = `<li>${messageData.usr} : ${messageData.msg}</li>`;
        } else {
            msgContent = `<li>${messageData.msg}</li>`;
        }

        messagesElement.innerHTML += msgContent;
        scrollToBottom();
    }

    function scrollToBottom() {
        const chatBox = document.querySelector(".chat-box");
        if (chatBox) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    messagesRef.once("value", snapshot => {
        let lastKey = null;
        snapshot.forEach(childSnapshot => {
            displayMessage(childSnapshot.val());
            lastKey = childSnapshot.key;
        });

        if (lastKey) {
            messagesRef.orderByKey().startAt(lastKey).on("child_added", newSnapshot => {
                if (newSnapshot.key !== lastKey) {
                    displayMessage(newSnapshot.val());
                }
            });
        } else {
            messagesRef.on("child_added", newSnapshot => {
                displayMessage(newSnapshot.val());
            });
        }
    });

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

    window.loadAndPlaySelectedMusic = loadAndPlaySelectedMusic;
    window.playCurrentMusic = playCurrentMusic;
    window.pauseCurrentMusic = pauseCurrentMusic;
    window.stopCurrentMusic = stopCurrentMusic;
    window.play = play;

    function deleteOldMessages() {
        const cutoff = Date.now() - 20 * 60 * 1000;
        const oldMessagesQuery = messagesRef.orderByChild("createdAt").endAt(cutoff);

        oldMessagesQuery.once("value", (snapshot) => {
            const updates = {};
            snapshot.forEach((child) => {
                updates[child.key] = null;
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

    setInterval(deleteOldMessages, 5 * 60 * 1000);

    // Draggable Functionality 
    const makeDraggable = (windowElement, handleElement) => {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        handleElement.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = windowElement.offsetLeft;
            initialY = windowElement.offsetTop;
            document.body.style.cursor = 'move'; 
            handleElement.style.cursor = 'move';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            windowElement.style.left = `${initialX + dx}px`;
            windowElement.style.top = `${initialY + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = 'default';
                handleElement.style.cursor = 'crosshair';
            }
        });
    };

    // Make the Music Player window draggable
    const musicWindow = document.querySelector('.draggable-window');
    const musicTitlebar = document.getElementById('music-window-titlebar');
    if (musicWindow && musicTitlebar) {
        makeDraggable(musicWindow, musicTitlebar);
    }
    
    // Make the Chat window draggable
    const chatWindow = document.querySelector('.chat-window');
    const chatTitlebar = chatWindow.querySelector('.title-bar');
    if (chatWindow && chatTitlebar) {
        makeDraggable(chatWindow, chatTitlebar);
    }

    // Paint Canvas Functionality with Firebase
    const canvas = document.getElementById('paint-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const colorPicker = document.getElementById('color-picker');
        const brushSize = document.getElementById('brush-size');
        const clearButton = document.getElementById('clear-canvas');

        canvas.width = 400;
        canvas.height = 300;

        let isPainting = false;
        let lastX = 0;
        let lastY = 0;

        ctx.lineWidth = brushSize.value;
        ctx.lineCap = 'round';
        ctx.strokeStyle = colorPicker.value;

        const drawLine = (x1, y1, x2, y2, color, size) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = size;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        };

        canvas.addEventListener('mousedown', (e) => {
            isPainting = true;
            [lastX, lastY] = [e.offsetX, e.offsetY];
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isPainting) return;
            
            const lineData = {
                startX: lastX,
                startY: lastY,
                endX: e.offsetX,
                endY: e.offsetY,
                color: ctx.strokeStyle,
                size: ctx.lineWidth
            };
            drawingRef.push(lineData);

            [lastX, lastY] = [e.offsetX, e.offsetY];
        });

        canvas.addEventListener('mouseup', () => {
            isPainting = false;
        });

        canvas.addEventListener('mouseleave', () => {
            isPainting = false;
        });

        colorPicker.addEventListener('input', (e) => {
            ctx.strokeStyle = e.target.value;
        });

        brushSize.addEventListener('input', (e) => {
            ctx.lineWidth = e.target.value;
        });

        clearButton.addEventListener('click', () => {
            drawingRef.push({ clear: true });
        });

        // Listen for drawing data from Firebase
        drawingRef.on('child_added', (snapshot) => {
            const data = snapshot.val();
            if (data.clear) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } else {
                drawLine(data.startX, data.startY, data.endX, data.endY, data.color, data.size);
            }
        });

        // Make the paint window draggable
        const paintWindow = document.getElementById('paint-window');
        const paintTitlebar = document.getElementById('paint-titlebar');
        if (paintWindow && paintTitlebar) {
            makeDraggable(paintWindow, paintTitlebar);
        }
    }
});