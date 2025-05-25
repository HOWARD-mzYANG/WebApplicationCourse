import { initializeAuth } from './auth.js';
import { showLoginForm } from './ui.js';

// Initialize the application
function initializeApp() {
    initializeAuth();
    showLoginForm();
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp); 