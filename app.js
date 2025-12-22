const DEFAULT_DOMAIN = "https://archive.fo";
const STORAGE_KEY = "archive_share_base_domain";
const PROXY_URL_KEY = "archive_share_proxy_url";
const PROXY_SECRET_KEY = "archive_share_proxy_secret";

// DOM Elements
const domainInput = document.getElementById('base-domain');
const proxyUrlInput = document.getElementById('proxy-url');
const proxySecretInput = document.getElementById('proxy-secret');
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
    console.log('beforeinstallprompt fired');
});

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, so clear it
        deferredPrompt = null;
    } else {
        // If the event hasn't fired, we can't trigger the prompt.
        // This usually means it's already installed, or the browser blocked it.
        showStatus('Installation not ready or already installed.', 'error');
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

function getProxySettings() {
    return {
        url: localStorage.getItem(PROXY_URL_KEY) || "",
        secret: localStorage.getItem(PROXY_SECRET_KEY) || ""
    };
}

function setProxySettings(url, secret) {
    let cleanUrl = url.trim();
    if (cleanUrl && !cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl; // Default to https if missing, though localhost might be http
        if (cleanUrl.includes("localhost")) {
            cleanUrl = cleanUrl.replace("https://", "http://");
        }
    }
    if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
    }

    if (cleanUrl) {
        localStorage.setItem(PROXY_URL_KEY, cleanUrl);
    } else {
        localStorage.removeItem(PROXY_URL_KEY);
    }

    if (secret) {
        localStorage.setItem(PROXY_SECRET_KEY, secret);
    } else {
        localStorage.removeItem(PROXY_SECRET_KEY);
    }

    return { url: cleanUrl, secret };
}

async function unwrapUrl(url) {
    // Only unwrap share.google links
    if (!url.includes('share.google')) {
        return url;
    }

    const { url: proxyUrl, secret } = getProxySettings();

    if (!proxyUrl) {
        console.warn("Share.google link found but no proxy configured.");
        return url;
    }

    try {
        const fetchUrl = `${proxyUrl}/?url=${encodeURIComponent(url)}`;
        const headers = {};
        if (secret) {
            headers['Authorization'] = `Bearer ${secret}`;
        }

        const response = await fetch(fetchUrl, { headers });
        if (!response.ok) {
            throw new Error(`Proxy error: ${response.status}`);
        }

        const data = await response.json();
        if (data.finalUrl) {
            return data.finalUrl;
        } else if (data.error) {
            throw new Error(data.error);
        }
        return url;
    } catch (err) {
        console.error("Failed to unwrap URL:", err);
        showStatus(`Failed to unwrap URL: ${err.message}`, 'error');
        return url; // Fallback to original
    }
}

function showStatus(msg, type = 'success') {
    statusMsg.textContent = msg;
    statusMsg.className = `status ${type}`;
    statusMsg.classList.remove('hidden');
    setTimeout(() => {
        statusMsg.classList.add('hidden');
    }, 3000);
}

async function handleShare() {
    const params = new URLSearchParams(window.location.search);
    // Android Share Target usually sends 'text' or 'url'.
    // Sometimes 'text' contains the URL mixed with other text.
    const sharedText = params.get('text') || params.get('url') || params.get('title');

    if (sharedText) {
        // Simple regex to extract the first URL found in the text
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = sharedText.match(urlRegex);

        if (matches && matches.length > 0) {
            let targetUrl = matches[0];

            showStatus('Processing URL...', 'info');

            targetUrl = await unwrapUrl(targetUrl);

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
    const proxyUrl = proxyUrlInput.value;
    const proxySecret = proxySecretInput.value;

    if (val) {
        const saved = setBaseDomain(val);
        domainInput.value = saved; // Update UI with cleaned value

        const savedProxy = setProxySettings(proxyUrl, proxySecret);
        proxyUrlInput.value = savedProxy.url;

        showStatus('Settings saved!');
    }
});

resetBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROXY_URL_KEY);
    localStorage.removeItem(PROXY_SECRET_KEY);

    domainInput.value = DEFAULT_DOMAIN;
    proxyUrlInput.value = "";
    proxySecretInput.value = "";

    showStatus('Reset to default!');
});

// --- Initialization ---

// 1. Load saved settings
domainInput.value = getBaseDomain();
const proxySettings = getProxySettings();
proxyUrlInput.value = proxySettings.url;
proxySecretInput.value = proxySettings.secret;

// 2. Check if we are handling a share
handleShare();
