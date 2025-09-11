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

const typingRef = firebase.database().ref('typing');
const usersRef = firebase.database().ref('users');
const pingsRef = db.ref('pings'); // New reference for pings

const typingNotificationArea = document.getElementById("typing-notification");
const backgroundMusicPlayer = document.getElementById("background-music-player");
const musicSelector = document.getElementById("music-selector");

const joinSound = new Audio('sound/buddyin.mp3');
const leaveSound = new Audio('sound/buddyout.mp3');
const mentionSound = new Audio('sound/mention.mp3'); // New sound for mentions

let typingTimeout;
let messageSendTimeout;

const userOnlineRef = usersRef.child(username);

// Fix 1: Properly handle onDisconnect
// We use a timestamp to check if the user is still active before adding the 'left' message
userOnlineRef.onDisconnect().remove();
userOnlineRef.set(true);

// Fix 2: Use an initial 'once' to prevent duplicate 'joined' messages on page load.
usersRef.once('value', snapshot => {
    // Then, listen for new users joining
    usersRef.on('child_added', function(snapshot) {
        const joinedUsername = snapshot.key;
        if (joinedUsername !== username) {
            const timestamp = Date.now();
            db.ref("messages/" + timestamp).set({
                msg: `<span style="color:green">${joinedUsername} joined the chat</span>`
            });
            joinSound.play().catch(e => console.error("Failed to play join sound:", e));
        }
    });

    // Fix 3: Use the child_removed listener to handle departures properly
    usersRef.on('child_removed', function(snapshot)
