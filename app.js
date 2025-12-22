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

if (installBtn) {
    installBtn.classList.add('hidden');
}

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
    // Show the install button now that we can trigger the prompt
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, so clear it
            deferredPrompt = null;
            // Hide the button immediately after use, as the prompt can't be triggered again
            installBtn.classList.add('hidden');
        } else {
            // If the event hasn't fired or was already used
            installBtn.classList.add('hidden');
            showStatus('App is likely installed. Check your home screen.', 'info');
        }
    });
}

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
    // Only unwrap share.google and search.app links
    if (!url.includes('share.google') && !url.includes('search.app')) {
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

// --- Initialization & Page Routing ---

// 1. Get current page context (simple check based on elements existence)
const isSettingsPage = !!document.getElementById('base-domain');
const isMainPage = !!document.getElementById('manual-url');

// 2. Helper to load settings into form
function loadSettingsToForm() {
    if (!isSettingsPage) return;
    domainInput.value = getBaseDomain();
    const proxySettings = getProxySettings();
    proxyUrlInput.value = proxySettings.url;
    proxySecretInput.value = proxySettings.secret;
}

// 3. Main Logic Flow
(async function init() {
    const savedDomain = localStorage.getItem(STORAGE_KEY);

    // Redirect Logic
    if (!savedDomain && !isSettingsPage) {
        // No settings saved, and we are not on the settings page -> Redirect to settings
        window.location.replace('settings.html');
        return;
    }

    if (isSettingsPage) {
        // We are on settings page. Load values.
        loadSettingsToForm();

        // Save Button Logic
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const val = domainInput.value;
                const proxyUrl = proxyUrlInput.value;
                const proxySecret = proxySecretInput.value;

                if (val) {
                    setBaseDomain(val);
                    setProxySettings(proxyUrl, proxySecret);
                    showStatus('Settings saved!', 'success');
                    window.location.replace('index.html');
                } else {
                    showStatus('Base Domain is required.', 'error');
                }
            });
        }

        // Reset Button Logic
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(PROXY_URL_KEY);
                localStorage.removeItem(PROXY_SECRET_KEY);
                loadSettingsToForm(); // Clear inputs
                // Since we are on settings page and just cleared settings, stays here.
                showStatus('Reset to default!', 'info');
            });
        }

    } else if (isMainPage) {
        // We are on main page. 

        // Handle incoming shares first
        await handleShare();

        // Settings Icon Click
        const settingsIcon = document.getElementById('settings-icon');
        if (settingsIcon) {
            settingsIcon.addEventListener('click', () => {
                window.location.href = 'settings.html';
            });
        }

        // Manual Entry Logic
        const manualInput = document.getElementById('manual-url');
        const goBtn = document.getElementById('go-btn');

        async function processManualUrl() {
            const url = manualInput.value;
            if (url) {
                showStatus('Processing...', 'info');
                const unwrapped = await unwrapUrl(url);
                const base = getBaseDomain();
                const finalUrl = `${base}/latest/${unwrapped}`;
                window.location.href = finalUrl;
            }
        }

        if (goBtn) {
            goBtn.addEventListener('click', processManualUrl);
        }

        if (manualInput) {
            manualInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    processManualUrl();
                }
            });
        }
    }
})();
