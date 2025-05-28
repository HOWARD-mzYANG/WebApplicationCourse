import { socket } from './socket.js';
import { showUserInfo, showLoginForm, updateUsersList } from './ui.js';

let currentUser = null;

// Login handling
function initializeAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameInput = document.getElementById('username');

    loginBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username) {
            socket.emit('login', { username });
        } else {
            alert('Please enter a username');
        }
    });

    logoutBtn.addEventListener('click', () => {
        socket.emit('logout');
        // showLoginForm(); // 可以保留立即更新UI，或依赖刷新后的效果
    });
}

// Socket event handlers for auth
socket.on('login_success', (data) => {
    currentUser = data.username;
    document.getElementById('current-user').textContent = currentUser;
    showUserInfo();
});

socket.on('login_error', (data) => {
    alert(data.message);
});

socket.on('logout_success', () => {
    currentUser = null;
    // showLoginForm(); // 由刷新页面处理UI重置
    location.reload(); // 刷新页面
});

socket.on('user_list', (users) => {
    updateUsersList(users);
});

export { currentUser, initializeAuth };