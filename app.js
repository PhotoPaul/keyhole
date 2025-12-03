const DEFAULT_DOMAIN = "https://archive.fo";
const STORAGE_KEY = "archive_share_base_domain";

// DOM Elements
const domainInput = document.getElementById('base-domain');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');
const statusMsg = document.getElementById('status-message');
const installBtn = document.getElementById('install-btn');

let deferredPrompt;

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.error('SW registration failed:', err));
    });
}

// --- PWA Install Logic ---
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
    // Hide the app provided install promotion
    installBtn.classList.add('hidden');
    // Show the install prompt
    if (deferredPrompt) {
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, so clear it
        deferredPrompt = null;
    }
});

// --- Core Logic ---

function getBaseDomain() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_DOMAIN;
}

function setBaseDomain(domain) {
    // Basic validation to ensure it starts with http/https and has no trailing slash
    let cleanDomain = domain.trim();
    if (!cleanDomain.startsWith('http')) {
        cleanDomain = 'https://' + cleanDomain;
    }
    if (cleanDomain.endsWith('/')) {
        cleanDomain = cleanDomain.slice(0, -1);
    }
    localStorage.setItem(STORAGE_KEY, cleanDomain);
    return cleanDomain;
}

function showStatus(msg, type = 'success') {
    statusMsg.textContent = msg;
    statusMsg.className = `status ${type}`;
    statusMsg.classList.remove('hidden');
    setTimeout(() => {
        statusMsg.classList.add('hidden');
    }, 3000);
}

function handleShare() {
    const params = new URLSearchParams(window.location.search);
    // Android Share Target usually sends 'text' or 'url'.
    // Sometimes 'text' contains the URL mixed with other text.
    const sharedText = params.get('text') || params.get('url') || params.get('title');

    if (sharedText) {
        // Simple regex to extract the first URL found in the text
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = sharedText.match(urlRegex);

        if (matches && matches.length > 0) {
            const targetUrl = matches[0];
            const base = getBaseDomain();
            const finalUrl = `${base}/latest/${targetUrl}`;
            
            // Redirect
            window.location.replace(finalUrl);
        }
    }
}

// --- Event Listeners ---

saveBtn.addEventListener('click', () => {
    const val = domainInput.value;
    if (val) {
        const saved = setBaseDomain(val);
        domainInput.value = saved; // Update UI with cleaned value
        showStatus('Settings saved!');
    }
});

resetBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    domainInput.value = DEFAULT_DOMAIN;
    showStatus('Reset to default!');
});

// --- Initialization ---

// 1. Load saved settings
domainInput.value = getBaseDomain();

// 2. Check if we are handling a share
handleShare();
