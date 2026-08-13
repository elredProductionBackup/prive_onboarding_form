// Shared auth helpers for Privé onboarding flow.
// Auth state and pending-mobile are kept in sessionStorage so a closed tab requires re-login.
const AUTH_KEY = 'priveAuthenticated';
const PENDING_MOBILE_KEY = 'privePendingMobile';
const STATIC_OTP = '123456';

function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function setAuthenticated() {
    sessionStorage.setItem(AUTH_KEY, 'true');
}

function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(PENDING_MOBILE_KEY);
    window.location.href = 'login.html';
}

// Call on protected pages (e.g. the application form). Redirects to login if not authenticated.
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}

// Call on guest-only pages (login/otp). Redirects to the app if already authenticated.
function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        window.location.href = 'index.html';
    }
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
