import { initializeApp }
from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    collection,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    increment,
    serverTimestamp,
    onSnapshot,
    runTransaction,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";


// ======================================
// 1. FIREBASE CONFIGURATION
// ======================================

const firebaseConfig = {
    apiKey: "AIzaSyA6MRe4PDgXL7it-2inhHcFg7EE0z83D6M",
    authDomain: "classsy-2907a.firebaseapp.com",
    projectId: "classsy-2907a",
    storageBucket: "classsy-2907a.firebasestorage.app",
    messagingSenderId: "668403682430",
    appId: "1:668403682430:web:69e6c4f08caa73e4d91c2f"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);


// ======================================
// 2. GLOBAL VARIABLES
// ======================================

let currentCode = "";
let currentDoc = null;
let unsubscribeAccount = null;
let unsubscribeMessages = null;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


// ======================================
// 3. GENERAL FUNCTIONS
// ======================================

window.showSection = function(id) {

    document.querySelectorAll(".section").forEach(section => {
        section.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
};


function toast(message) {

    const element = document.getElementById("toast");

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => {
        element.classList.remove("show");
    }, 2500);
}


function setLoading(buttonId, loading, originalText) {

    const button = document.getElementById(buttonId);

    button.disabled = loading;

    button.textContent = loading
        ? "Please wait..."
        : originalText;
}


function showError(error) {

    console.error(error);

    let message = "Something went wrong. Please try again.";

    if (error.code === "permission-denied") {
        message = "Access denied. Check your Firestore security rules.";
    } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Check your internet connection.";
    } else if (error.code === "auth/operation-not-allowed") {
        message = "Enable Anonymous Authentication in Firebase.";
    } else if (error.code === "unavailable") {
        message = "Firebase is temporarily unavailable.";
    }

    toast(message);
}


// ======================================
// 4. AUTHENTICATION
// ======================================

async function ensureAuthentication() {

    if (auth.currentUser) {
        return auth.currentUser;
    }

    const result = await signInAnonymously(auth);

    return result.user;
}


// ======================================
// 5. SECRET CODE GENERATOR
// ======================================

function generateSecretCode() {

    const randomValues = new Uint8Array(16);

    crypto.getRandomValues(randomValues);

    const characters = Array.from(randomValues, value => {
        return CODE_ALPHABET[value % CODE_ALPHABET.length];
    });

    const groups = [];

    for (let i = 0; i < characters.length; i += 4) {
        groups.push(characters.slice(i, i + 4).join(""));
    }

    return "SELOS-" + groups.join("-");
}


// ======================================
// 6. HASH SECRET CODE
// ======================================

async function hashCode(code) {

    const encoder = new TextEncoder();

    const data = encoder.encode(code);

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        data
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}


function normalizeCode(code) {

    return code
        .toUpperCase()
        .replace(/\s/g, "")
        .replace(/[^A-Z0-9-]/g, "");
}


function validCode(code) {

    return /^SELOS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);
}


// ======================================
// 7. REGISTER ACCOUNT
// ======================================

window.registerAccount = async function() {

    const buttonText = "Generate My Secret Code 💗";

    setLoading("registerBtn", true, buttonText);

    try {

        await ensureAuthentication();

        let created = false;
        let generatedCode = "";

        // Retry if a code collision occurs.
        for (let attempt = 0; attempt < 5; attempt++) {

            const code = generateSecretCode();

            const hash = await hashCode(code);

            const accountRef = doc(db, "antiSelosAccounts", hash);

            const success = await runTransaction(db, async transaction => {

                const existing = await transaction.get(accountRef);

                if (existing.exists()) {
                    return false;
                }

                transaction.set(accountRef, {
                    selosCount: 0,
                    agreementAccepted: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                return true;
            });

            if (success) {

                generatedCode = code;
                created = true;

                break;
            }
        }

        if (!created) {
            throw new Error("Unable to generate a unique code.");
        }

        currentCode = generatedCode;

        sessionStorage.setItem("antiSelosCode", currentCode);

        document.getElementById("generatedCode").textContent =
            currentCode;

        showSection("generatedSection");

        toast("Account created successfully! 💗");

    } catch (error) {

        showError(error);

    } finally {

        setLoading("registerBtn", false, buttonText);

    }

};


// ======================================
// 8. COPY SECRET CODE
// ======================================

window.copySecretCode = async function() {

    if (!currentCode) {
        toast("Secret code not available.");
        return;
    }

    try {

        await navigator.clipboard.writeText(currentCode);

        toast("Secret code copied! 💗");

    } catch (error) {

        toast("Unable to copy. Please copy the code manually.");

    }

};


// ======================================
// 9. LOGIN
// ======================================

window.formatCode = function(input) {

    let value = input.value.toUpperCase();

    value = value.replace(/[^A-Z0-9]/g, "");

    if (value.startsWith("SELOS")) {

        const remaining = value.slice(5);

        const groups = remaining.match(/.{1,4}/g) || [];

        value = "SELOS-" + groups.join("-");

    }

    input.value = value.slice(0, 29);

};


window.loginAccount = async function() {

    const buttonText = "Login to Anti-Selos 💕";

    const code = normalizeCode(
        document.getElementById("loginCode").value
    );

    if (!validCode(code)) {

        toast("Please enter a valid secret code.");

        return;
    }

    setLoading("loginBtn", true, buttonText);

    try {

        await ensureAuthentication();

        const hash = await hashCode(code);

        const accountRef = doc(db, "antiSelosAccounts", hash);

        const accountSnapshot = await getDoc(accountRef);

        if (!accountSnapshot.exists()) {

            toast("Invalid secret code. Account not found.");

            return;
        }

        currentCode = code;

        sessionStorage.setItem("antiSelosCode", currentCode);

        await openDashboard();

        toast("Login successful! Welcome back. 💗");

    } catch (error) {

        showError(error);

    } finally {

        setLoading("loginBtn", false, buttonText);

    }

};


// ======================================
// 10. OPEN DASHBOARD
// ======================================

window.openDashboard = async function() {

    try {

        if (!currentCode) {
            toast("Secret code not found.");
            return;
        }

        const hash = await hashCode(currentCode);

        currentDoc = doc(db, "antiSelosAccounts", hash);

        const snapshot = await getDoc(currentDoc);

        if (!snapshot.exists()) {

            toast("Account not found.");

            return;
        }

        document.getElementById("dashboardCode").textContent =
            currentCode;

        showSection("dashboardSection");

        if (unsubscribeAccount) {
            unsubscribeAccount();
        }
        if (unsubscribeMessages) {
            unsubscribeMessages();
        }

        // REAL-TIME FIRESTORE LISTENER
        unsubscribeAccount = onSnapshot(
            currentDoc,
            snapshot => {

                if (!snapshot.exists()) {
                    toast("Account is no longer available.");
                    return;
                }

                const data = snapshot.data();

                document.getElementById("selosCount").textContent =
                    data.selosCount ?? 0;

                const accepted = data.agreementAccepted === true;

                document.getElementById("agreementStatus").textContent =
                    accepted ? "Yes" : "No";

                document.getElementById("agreementMessage").textContent =
                    accepted
                    ? "💗 The Anti-Selos Agreement has been accepted!"
                    : "Both partners can share this agreement. 💕";

                const agreementButton =
                    document.getElementById("agreementBtn");

                agreementButton.textContent = accepted
                    ? "Agreement Accepted ✓"
                    : "I AGREE! 💗";

                agreementButton.disabled = accepted;

                document.getElementById("syncStatus").textContent =
                    "● Synced with Firebase";

            },
            error => {

                console.error(error);

                document.getElementById("syncStatus").textContent =
                    "Unable to sync with Firebase.";

            }
        );

        subscribeToPartnerMessages();

    } catch (error) {

        showError(error);

    }

};


function renderPartnerMessages(messageSnapshots) {
    const commentList = document.getElementById("commentList");

    commentList.replaceChildren();

    if (messageSnapshots.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "comment-empty";
        emptyMessage.textContent =
            "No messages yet. Send your partner a note 💗";
        commentList.append(emptyMessage);
        return;
    }

    const currentUserId = auth.currentUser?.uid;

    messageSnapshots.slice().reverse().forEach(messageSnapshot => {

        const message = messageSnapshot.data();

        if (typeof message.text !== "string" ||
            typeof message.senderId !== "string") {
            console.error("A shared account message has invalid data.");
            return;
        }

        const comment = document.createElement("article");
        comment.className = "comment";

        const header = document.createElement("div");
        header.className = "comment-header";

        const author = document.createElement("strong");
        author.textContent =
            message.senderId === currentUserId ? "You" : "Partner";
        header.append(author);

        if (message.createdAt?.toDate) {
            const time = document.createElement("time");
            const createdAt = message.createdAt.toDate();
            time.dateTime = createdAt.toISOString();
            time.textContent = createdAt.toLocaleString();
            header.append(time);
        }

        const text = document.createElement("p");
        text.textContent = message.text;

        comment.append(header, text);
        commentList.append(comment);
    });

    commentList.scrollTop = commentList.scrollHeight;
}


function subscribeToPartnerMessages() {

    const messagesQuery = query(
        collection(currentDoc, "messages"),
        orderBy("createdAt", "desc"),
        limit(50)
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,
        snapshot => renderPartnerMessages(snapshot.docs),
        error => {

            console.error("Partner messages sync failed:", error);

            const commentList = document.getElementById("commentList");
            commentList.replaceChildren();

            const errorMessage = document.createElement("p");
            errorMessage.className = "comment-empty";
            errorMessage.textContent =
                error.code === "permission-denied"
                    ? "Firebase blocked messages. Deploy the rules in firestore.rules."
                    : "Unable to load messages.";
            commentList.append(errorMessage);

        }
    );
}


window.sendPartnerMessage = async function(event) {

    event.preventDefault();

    const input = document.getElementById("commentInput");
    const button = document.getElementById("sendMessageBtn");
    const text = input.value.trim();

    if (!text) {
        toast("Write a message before sending.");
        input.focus();
        return;
    }

    if (!currentDoc || !auth.currentUser) {
        toast("Please log in before sending a message.");
        return;
    }

    button.disabled = true;

    try {

        await addDoc(collection(currentDoc, "messages"), {
            text,
            senderId: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });

        input.value = "";
        toast("Message sent! 💗");

    } catch (error) {

        showError(error);

    } finally {

        button.disabled = false;

    }

};


// ======================================
// 11. SELOS CHECKER
// ======================================

window.checkSelos = async function() {

    if (!currentDoc) return;

    try {

        await updateDoc(currentDoc, {
            selosCount: increment(1),
            updatedAt: serverTimestamp()
        });

        const messages = [
            "Hala! Bakit ka nagseselos? Usap tayo. 🥺",
            "Deep breath muna. Don't overthink! 💗",
            "Ask first before assuming, okay? 💕",
            "Your feelings are valid. Communicate calmly. 🫶",
            "Selos detected! Time for reassurance. 💌",
            "It's okay to feel jealous. Let's talk about it. ❤️"
        ];

        const random = Math.floor(
            Math.random() * messages.length
        );

        document.getElementById("loveMessage").textContent =
            messages[random];

        toast("Selos recorded successfully! 💗");

    } catch (error) {

        showError(error);

    }

};


window.noSelos = function() {

    const messages = [
        "Yehey! Trust lang tayo today! 💗",
        "No selos, more love! 🥰",
        "Keep communicating and understanding each other. 💕",
        "A peaceful heart is a happy heart! 🌷"
    ];

    const random = Math.floor(
        Math.random() * messages.length
    );

    document.getElementById("loveMessage").textContent =
        messages[random];

};


// ======================================
// 12. AGREEMENT
// ======================================

window.acceptAgreement = async function() {

    if (!currentDoc) return;

    const accepted = confirm(
        "Are you sure you want to accept the Anti-Selos Agreement?"
    );

    if (!accepted) return;

    try {

        await updateDoc(currentDoc, {
            agreementAccepted: true,
            updatedAt: serverTimestamp()
        });

        toast("Agreement accepted! 💗");

        showSection("dashboardSection");

    } catch (error) {

        showError(error);

    }

};


// ======================================
// 13. LOVE REMINDERS
// ======================================

window.newReminder = function() {

    const reminders = [
        "You are enough. Never forget that. 💗",
        "Communication is the key to understanding. 💌",
        "Don't let overthinking ruin a beautiful day. 🌷",
        "Trust is built through honesty and actions. 🫶",
        "It's okay to ask for reassurance sometimes. 💕",
        "You deserve love that makes you feel secure. 💗",
        "Remember to listen to each other. ❤️",
        "Love is not about controlling someone. It's about understanding. 💞",
        "Always choose honest communication over assumptions. 🥰"
    ];

    const random = Math.floor(
        Math.random() * reminders.length
    );

    document.getElementById("reminderMessage").textContent =
        reminders[random];

};


// ======================================
// 14. LOGOUT
// ======================================

window.logoutAccount = async function() {

    const confirmed = confirm(
        "Are you sure you want to logout?"
    );

    if (!confirmed) return;

    try {

        if (unsubscribeAccount) {
            unsubscribeAccount();
            unsubscribeAccount = null;
        }
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        sessionStorage.removeItem("antiSelosCode");

        currentCode = "";
        currentDoc = null;

        await signOut(auth);

        document.getElementById("loginCode").value = "";

        showSection("loginSection");

        toast("Logged out successfully! 💗");

    } catch (error) {

        showError(error);

    }

};


// ======================================
// 15. RESTORE CURRENT SESSION
// ======================================

async function restoreSession() {

    const savedCode = sessionStorage.getItem("antiSelosCode");

    if (!savedCode) return;

    try {

        await ensureAuthentication();

        currentCode = savedCode;

        await openDashboard();

    } catch (error) {

        console.error("Session restore failed:", error);

        sessionStorage.removeItem("antiSelosCode");

        currentCode = "";

        showSection("loginSection");

    }

}


// ======================================
// 16. START APPLICATION
// ======================================

restoreSession();
