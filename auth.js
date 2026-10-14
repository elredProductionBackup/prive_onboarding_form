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

// Shared by every modal overlay — stops the page behind it from scrolling while open.
function showModal(id) {
    document.getElementById(id).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideModal(id) {
    document.getElementById(id).style.display = 'none';
    document.body.style.overflow = '';
}

// Catches expired/invalid JWT errors on any authenticated request. Shows the
// "Session Expired" modal if the page has one (index.html); otherwise logs out directly.
function triggerSessionExpired() {
    // No token = no session to expire (login/OTP pages). Logging out there just reloads
    // the page and hides the API's real error, e.g. "Too many attempts".
    if (!isAuthenticated()) return;
    const modal = document.getElementById('sessionExpiredModal');
    if (modal) {
        showModal('sessionExpiredModal');
    } else {
        logout();
    }
}

// errorCode 110 = form already submitted: show the same "Submitted" popup as a fresh
// submit (its OK button logs out). Only index.html has that popup.
function triggerAlreadySubmitted() {
    if (document.getElementById('submitSuccessModal')) {
        showModal('submitSuccessModal');
    }
}

function handleErrorCode(errorCode) {
    if (errorCode === 1 || errorCode === -1) triggerSessionExpired();
    if (errorCode === 110) triggerAlreadySubmitted();
}

if (typeof axios !== 'undefined') {
    axios.interceptors.response.use(
        (response) => {
            handleErrorCode((response.data || {}).errorCode);
            return response;
        },
        (error) => {
            const status = error.response && error.response.status;
            const data = (error.response && error.response.data) || {};
            if (status === 401) triggerSessionExpired();
            handleErrorCode(data.errorCode);
            return Promise.reject(error);
        }
    );
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
// Only one toast is ever shown at a time — a rapid double-click or an overlapping
// retry would otherwise stack several identical toasts on screen.
function showToast(message, type) {
    // While the "Submitted" popup is up (errorCode 110), the caller's own error toast —
    // e.g. "not allowed to update user details after final submission" — is just noise.
    const submitModal = document.getElementById('submitSuccessModal');
    if (submitModal && submitModal.style.display === 'flex') return;
    type = type || 'error';
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    container.querySelectorAll('.toast').forEach((t) => t.remove());

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

// Rate-limits a button's click handler — ignores a click if the same key fired
// within `cooldownMs`, even faster than the handler's own `disabled = true` can land
// (e.g. a double-tap on mobile, or an Enter-key submit racing a button click).
const _rateLimitLastCall = {};
function rateLimited(key, cooldownMs, fn) {
    return function (...args) {
        const now = Date.now();
        if (now - (_rateLimitLastCall[key] || 0) < cooldownMs) {
            // A throttled form submit must still be cancelled, or the browser does a native
            // submit — reloading the page with the field values (e.g. phone number) in the URL.
            if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
            return;
        }
        _rateLimitLastCall[key] = now;
        return fn.apply(this, args);
    };
}
