// Shared auth helpers for Privé onboarding flow.
// Session data (access token, user code, phone number, OTP transaction) lives in
// localStorage so it survives tab closes/reloads until an explicit logout.
const PENDING_MOBILE_KEY = 'privePendingMobile';
const TRANSACTION_ID_KEY = 'priveTransactionId';
const TRANSACTION_EXPIRY_KEY = 'priveTransactionExpiry';
const ACCESS_TOKEN_KEY = 'priveAccessToken';
const USER_CODE_KEY = 'priveUserCode';
const PHONE_NUMBER_KEY = 'privePhoneNumber';

function isAuthenticated() {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
}

// Persists the verifyPhoneNumberOTP API's `result` object.
function setSession(result) {
    localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_CODE_KEY, result.userCode);
    localStorage.setItem(PHONE_NUMBER_KEY, result.phoneNumber);
}

function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

// Attach the stored access token (if any) to every outgoing axios request,
// so authenticated endpoints don't need to set the header at each call site.
if (typeof axios !== 'undefined') {
    axios.interceptors.request.use((config) => {
        const token = getAccessToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = 'Bearer ' + token;
        }
        return config;
    });
}

// Persists the sendPhoneNumberOTP API's `result` object (called on send + resend).
function setOtpTransaction(result) {
    localStorage.setItem(TRANSACTION_ID_KEY, result.transactionId);
    localStorage.setItem(TRANSACTION_EXPIRY_KEY, result.expiryTime);
}

function getTransactionId() {
    return localStorage.getItem(TRANSACTION_ID_KEY);
}

function logout() {
    localStorage.removeItem(TRANSACTION_ID_KEY);
    localStorage.removeItem(TRANSACTION_EXPIRY_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_CODE_KEY);
    localStorage.removeItem(PHONE_NUMBER_KEY);
    localStorage.removeItem('priveUsernameAvailable');
    sessionStorage.removeItem(PENDING_MOBILE_KEY);
    sessionStorage.removeItem('priveOtpJustSent');
    window.location.replace('login.html');
}

// Hides the page instantly (used right before a redirect, and on `pagehide` so a bfcache
// snapshot of this page is captured already-hidden — otherwise the browser paints the stale
// cached page for a frame before our redirect fires, causing a visible flash on Back/Forward).
function hidePageInstantly() {
    document.documentElement.style.visibility = 'hidden';
}

function showPage() {
    document.documentElement.style.visibility = '';
}

// Call on protected pages (e.g. the application form). Redirects to login if not authenticated.
// Also re-checks on `pageshow` — browsers can restore a page from bfcache on back/forward
// navigation without re-running page scripts, which would otherwise let a logged-out user
// land back on a protected page just by pressing Back.
function requireAuth() {
    const check = () => {
        if (!isAuthenticated()) {
            hidePageInstantly();
            window.location.replace('login.html');
        } else {
            showPage();
        }
    };
    check();
    window.addEventListener('pageshow', check);
    window.addEventListener('pagehide', hidePageInstantly);
}

// Call on guest-only pages (login/otp). Redirects to the app if already authenticated.
// Same bfcache re-check as requireAuth, so a logged-in user can't get back to login/otp
// via the browser's Back button either.
function redirectIfAuthenticated() {
    const check = () => {
        if (isAuthenticated()) {
            hidePageInstantly();
            window.location.replace('index.html');
        } else {
            showPage();
        }
    };
    check();
    window.addEventListener('pageshow', check);
    window.addEventListener('pagehide', hidePageInstantly);
}

// Extracts a human-readable message from an axios error.
function getApiErrorMessage(error, fallback) {
    return (error.response && error.response.data && error.response.data.message) || error.message || fallback;
}

// Shows a transient toast notification. type: 'error' | 'success'
function showToast(message, type) {
    type = type || 'error';
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
