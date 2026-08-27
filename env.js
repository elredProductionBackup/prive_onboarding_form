// Runtime configuration for the Privé onboarding site.
// This is a plain static site (no bundler/build step), so a Node-style .env
// file can't be read by the browser at runtime. This file is the client-side
// equivalent: it sets values on `window.ENV` before any other script runs.
window.ENV = {
    API_BASE_URL: 'https://pretest.elred.io/theNetwork',
    HASH_ID: 'elRED'
};
