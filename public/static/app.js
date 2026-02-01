// Legal AI Platform - Frontend Application
// Enterprise-grade legal document AI interface

// Configuration
const API_BASE = window.location.origin + '/api';
let AUTH_TOKEN = localStorage.getItem('auth_token');
let CURRENT_USER = null;
let CURRENT_SESSION = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (AUTH_TOKEN) {
        loadCurrentUser();
    }
});

// Authentication Functions
async function showLogin() {
    const authPage = document.getElementById('auth-page');
    const landingPage = document.getElementById('landing-page');
    const authContent = document.getElementById('auth-content');
    
    landingPage.classList.add('hidden');
    authPage.classList.remove('hidden');
    
    authContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-6 text-center">
            <i class="fas fa-sign-in-alt mr-2"></i>Login to Legal AI
        </h2>
        <form id="login-form" onsubmit="handleLogin(event)" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" id="login-email" required
                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input type="password" id="login-password" required
                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <button type="submit" 
                    class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                <i class="fas fa-sign-in-alt mr-2"></i>Login
            </button>
        </form>
        <p class="text-center mt-4 text-gray-600">
            Don't have an account? 
            <button onclick="showRegister()" class="text-blue-600 hover:underline">Register</button>
        </p>
        <button onclick="showLanding()" class="w-full mt-4 text-gray-600 hover:text-gray-800">
            <i class="fas fa-arrow-left mr-2"></i>Back
        </button>
    `;
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            AUTH_TOKEN = data.token;
            CURRENT_USER = data.user;
            localStorage.setItem('auth_token', AUTH_TOKEN);
            showDashboard();
        } else {
            alert('Login failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Login error: ' + error.message);
    }
}

async function showRegister() {
    const authPage = document.getElementById('auth-page');
    const landingPage = document.getElementById('landing-page');
    const authContent = document.getElementById('auth-content');
    
    landingPage.classList.add('hidden');
    authPage.classList.remove('hidden');
    
    authContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-6 text-center">
            <i class="fas fa-user-plus mr-2"></i>Create Account
        </h2>
        <form id="register-form" onsubmit="handleRegister(event)" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input type="text" id="register-name" required
                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" id="register-email" required
                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Organization (Optional)</label>
                <input type="text" id="register-org"
                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Password (min 8 characters)</label>
                <input type="password" id="register-password" required minlength="8"
                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <button type="submit" 
                    class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition">
                <i class="fas fa-user-plus mr-2"></i>Create Account
            </button>
        </form>
        <p class="text-center mt-4 text-gray-600">
            Already have an account? 
            <button onclick="showLogin()" class="text-blue-600 hover:underline">Login</button>
        </p>
        <button onclick="showLanding()" class="w-full mt-4 text-gray-600 hover:text-gray-800">
            <i class="fas fa-arrow-left mr-2"></i>Back
        </button>
    `;
}

async function handleRegister(event) {
    event.preventDefault();
    
    const full_name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const organization = document.getElementById('register-org').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, password, organization })
        });
        
        const data = await response.json();
        
        if (data.success) {
            AUTH_TOKEN = data.token;
            CURRENT_USER = data.user;
            localStorage.setItem('auth_token', AUTH_TOKEN);
            showDashboard();
        } else {
            alert('Registration failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Registration error: ' + error.message);
    }
}

async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            CURRENT_USER = data.user;
            showDashboard();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Load user error:', error);
        logout();
    }
}

function logout() {
    AUTH_TOKEN = null;
    CURRENT_USER = null;
    localStorage.removeItem('auth_token');
    showLanding();
}

function showLanding() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.add('hidden');
    
    document.getElementById('nav-buttons').innerHTML = `
        <button onclick="showLogin()" class="px-4 py-2 rounded-lg bg-white text-blue-900 hover:bg-gray-100 transition">
            <i class="fas fa-sign-in-alt mr-2"></i>Login
        </button>
        <button onclick="showRegister()" class="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 transition">
            <i class="fas fa-user-plus mr-2"></i>Register
        </button>
    `;
}

// Dashboard Functions
async function showDashboard() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');
    
    document.getElementById('nav-buttons').innerHTML = `
        <span class="text-white mr-4">
            <i class="fas fa-user mr-2"></i>${CURRENT_USER.full_name}
        </span>
        <button onclick="logout()" class="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 transition">
            <i class="fas fa-sign-out-alt mr-2"></i>Logout
        </button>
    `;
    
    await loadDashboard();
}

async function loadDashboard() {
    const dashboardContent = document.getElementById('dashboard-content');
    
    dashboardContent.innerHTML = `
        <div class="grid md:grid-cols-4 gap-4 mb-8">
            <button onclick="showView('chat')" class="p-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                <i class="fas fa-comments text-3xl mb-2"></i>
                <h3 class="font-bold">AI Chat</h3>
            </button>
            <button onclick="showView('documents')" class="p-6 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                <i class="fas fa-file-alt text-3xl mb-2"></i>
                <h3 class="font-bold">Documents</h3>
            </button>
            <button onclick="showView('history')" class="p-6 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition">
                <i class="fas fa-history text-3xl mb-2"></i>
                <h3 class="font-bold">History</h3>
            </button>
            ${CURRENT_USER.role === 'admin' ? `
            <button onclick="showView('admin')" class="p-6 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                <i class="fas fa-cog text-3xl mb-2"></i>
                <h3 class="font-bold">Admin</h3>
            </button>
            ` : ''}
        </div>
        <div id="view-content" class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-4">Welcome to Legal AI Platform</h2>
            <p class="text-gray-600 mb-4">Select an option above to get started.</p>
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                <p class="text-sm text-blue-700">
                    <i class="fas fa-info-circle mr-2"></i>
                    <strong>Getting Started:</strong> Upload a legal document or start chatting with our AI assistant about legal questions.
                </p>
            </div>
        </div>
    `;
}

async function showView(view) {
    const viewContent = document.getElementById('view-content');
    
    switch(view) {
        case 'chat':
            await loadChatView();
            break;
        case 'documents':
            await loadDocumentsView();
            break;
        case 'history':
            await loadHistoryView();
            break;
        case 'admin':
            if (CURRENT_USER.role === 'admin') {
                await loadAdminView();
            }
            break;
    }
}

// Chat View Functions
async function loadChatView() {
    const viewContent = document.getElementById('view-content');
    
    // Load available models
    const modelsResponse = await fetch(`${API_BASE}/models`);
    const modelsData = await modelsResponse.json();
    const models = modelsData.models || [];
    
    viewContent.innerHTML = `
        <div class="flex flex-col h-[600px]">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold">
                    <i class="fas fa-comments mr-2"></i>AI Legal Assistant
                </h2>
                <div class="flex space-x-2">
                    <select id="model-select" class="px-4 py-2 border rounded-lg">
                        ${models.map(m => `<option value="${m.model_id}">${m.model_name}</option>`).join('')}
                    </select>
                    <button onclick="startNewChat()" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        <i class="fas fa-plus mr-2"></i>New Chat
                    </button>
                </div>
            </div>
            
            <div id="chat-messages" class="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 mb-4 space-y-4">
                <div class="text-center text-gray-500 mt-20">
                    <i class="fas fa-robot text-5xl mb-4"></i>
                    <p>Start a conversation with the AI legal assistant</p>
                    <p class="text-sm mt-2">Ask questions about legal concepts, contracts, or case law</p>
                </div>
            </div>
            
            <div class="flex space-x-2">
                <input type="text" id="chat-input" placeholder="Ask a legal question..."
                       class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                       onkeypress="if(event.key === 'Enter') sendMessage()">
                <button onclick="sendMessage()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
}

async function startNewChat() {
    CURRENT_SESSION = null;
    await loadChatView();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    const chatMessages = document.getElementById('chat-messages');
    const model = document.getElementById('model-select').value;
    
    // Clear placeholder if it's first message
    if (!CURRENT_SESSION) {
        chatMessages.innerHTML = '';
    }
    
    // Add user message
    chatMessages.innerHTML += `
        <div class="flex justify-end">
            <div class="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-md">
                ${escapeHtml(message)}
            </div>
        </div>
    `;
    
    // Add loading indicator
    chatMessages.innerHTML += `
        <div id="loading-message" class="flex justify-start">
            <div class="bg-gray-200 rounded-lg px-4 py-2">
                <i class="fas fa-spinner fa-spin mr-2"></i>Thinking...
            </div>
        </div>
    `;
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    input.value = '';
    
    try {
        const response = await fetch(`${API_BASE}/chat/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                session_id: CURRENT_SESSION,
                message,
                model
            })
        });
        
        const data = await response.json();
        
        // Remove loading indicator
        document.getElementById('loading-message').remove();
        
        if (data.success) {
            CURRENT_SESSION = data.session_id;
            
            // Add AI response
            chatMessages.innerHTML += `
                <div class="flex justify-start">
                    <div class="bg-white border rounded-lg px-4 py-2 max-w-md">
                        <div class="flex items-center text-xs text-gray-500 mb-2">
                            <i class="fas fa-robot mr-1"></i>
                            ${data.message.model_used} 
                            <span class="ml-2">${data.message.processing_time_ms}ms</span>
                        </div>
                        <div>${escapeHtml(data.message.content)}</div>
                    </div>
                </div>
            `;
        } else {
            chatMessages.innerHTML += `
                <div class="flex justify-start">
                    <div class="bg-red-100 border border-red-400 text-red-700 rounded-lg px-4 py-2">
                        Error: ${data.error || 'Failed to get response'}
                    </div>
                </div>
            `;
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        document.getElementById('loading-message').remove();
        chatMessages.innerHTML += `
            <div class="flex justify-start">
                <div class="bg-red-100 border border-red-400 text-red-700 rounded-lg px-4 py-2">
                    Network error: ${error.message}
                </div>
            </div>
        `;
    }
}

// Documents View Functions
async function loadDocumentsView() {
    const viewContent = document.getElementById('view-content');
    
    viewContent.innerHTML = `
        <div>
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">
                    <i class="fas fa-file-alt mr-2"></i>Document Library
                </h2>
                <button onclick="showUploadDialog()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <i class="fas fa-upload mr-2"></i>Upload Document
                </button>
            </div>
            
            <div id="documents-list" class="space-y-4">
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-spinner fa-spin text-3xl"></i>
                    <p class="mt-2">Loading documents...</p>
                </div>
            </div>
        </div>
    `;
    
    await loadDocuments();
}

async function loadDocuments() {
    try {
        const response = await fetch(`${API_BASE}/documents/`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        
        const data = await response.json();
        const documentsList = document.getElementById('documents-list');
        
        if (data.success && data.documents.length > 0) {
            documentsList.innerHTML = data.documents.map(doc => `
                <div class="bg-white border rounded-lg p-4 hover:shadow-md transition">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h3 class="font-bold text-lg">${escapeHtml(doc.title)}</h3>
                            <p class="text-sm text-gray-600 mt-1">
                                <i class="fas fa-file mr-1"></i>${doc.filename}
                                <span class="mx-2">•</span>
                                ${formatFileSize(doc.file_size)}
                                <span class="mx-2">•</span>
                                ${new Date(doc.uploaded_at).toLocaleDateString()}
                            </p>
                            ${doc.tags ? `
                                <div class="mt-2">
                                    ${doc.tags.split(',').map(tag => 
                                        `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">${tag.trim()}</span>`
                                    ).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="chatWithDocument(${doc.id})" 
                                    class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                                <i class="fas fa-comments"></i> Chat
                            </button>
                            <a href="${API_BASE}/documents/${doc.id}/download" 
                               class="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm inline-block">
                                <i class="fas fa-download"></i>
                            </a>
                            <button onclick="deleteDocument(${doc.id})" 
                                    class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            documentsList.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-folder-open text-5xl mb-4"></i>
                    <p class="text-lg">No documents yet</p>
                    <button onclick="showUploadDialog()" class="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        Upload Your First Document
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load documents error:', error);
        document.getElementById('documents-list').innerHTML = `
            <div class="text-center py-8 text-red-600">
                Error loading documents: ${error.message}
            </div>
        `;
    }
}

function showUploadDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
        <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 class="text-2xl font-bold mb-4">Upload Legal Document</h3>
            <form id="upload-form" onsubmit="handleUpload(event)" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Document Title</label>
                    <input type="text" id="upload-title" required
                           class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">Document Type</label>
                    <select id="upload-type" class="w-full px-4 py-2 border rounded-lg">
                        <option value="contract">Contract</option>
                        <option value="case_law">Case Law</option>
                        <option value="statute">Statute</option>
                        <option value="regulation">Regulation</option>
                        <option value="brief">Brief</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                    <input type="text" id="upload-tags" placeholder="contract, employment, 2024"
                           class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">File (PDF, DOC, TXT - Max 50MB)</label>
                    <input type="file" id="upload-file" required accept=".pdf,.txt,.doc,.docx"
                           class="w-full px-4 py-2 border rounded-lg">
                </div>
                <div class="flex space-x-2">
                    <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                        <i class="fas fa-upload mr-2"></i>Upload
                    </button>
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="flex-1 bg-gray-400 text-white py-2 rounded-lg hover:bg-gray-500">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(dialog);
}

async function handleUpload(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('title', document.getElementById('upload-title').value);
    formData.append('document_type', document.getElementById('upload-type').value);
    formData.append('tags', document.getElementById('upload-tags').value);
    formData.append('file', document.getElementById('upload-file').files[0]);
    
    try {
        const response = await fetch(`${API_BASE}/documents/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            event.target.closest('.fixed').remove();
            await loadDocuments();
            alert('Document uploaded successfully!');
        } else {
            alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Upload error: ' + error.message);
    }
}

async function deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/documents/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadDocuments();
        } else {
            alert('Delete failed: ' + data.error);
        }
    } catch (error) {
        alert('Delete error: ' + error.message);
    }
}

async function chatWithDocument(docId) {
    CURRENT_SESSION = null;
    await showView('chat');
    
    // Create new session with document
    const response = await fetch(`${API_BASE}/chat/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
            document_id: docId,
            title: 'Document Chat'
        })
    });
    
    const data = await response.json();
    if (data.success) {
        CURRENT_SESSION = data.session.id;
    }
}

// History View Functions
async function loadHistoryView() {
    const viewContent = document.getElementById('view-content');
    
    viewContent.innerHTML = `
        <div>
            <h2 class="text-2xl font-bold mb-6">
                <i class="fas fa-history mr-2"></i>Chat History
            </h2>
            <div id="history-list" class="space-y-4">
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-spinner fa-spin text-3xl"></i>
                </div>
            </div>
        </div>
    `;
    
    await loadChatHistory();
}

async function loadChatHistory() {
    try {
        const response = await fetch(`${API_BASE}/chat/sessions`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        
        const data = await response.json();
        const historyList = document.getElementById('history-list');
        
        if (data.success && data.sessions.length > 0) {
            historyList.innerHTML = data.sessions.map(session => `
                <div class="bg-white border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                     onclick="loadSession(${session.id})">
                    <h3 class="font-bold">${escapeHtml(session.title)}</h3>
                    <p class="text-sm text-gray-600 mt-1">
                        <i class="fas fa-robot mr-1"></i>${session.ai_model}
                        <span class="mx-2">•</span>
                        ${new Date(session.created_at).toLocaleDateString()}
                    </p>
                </div>
            `).join('');
        } else {
            historyList.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-history text-5xl mb-4"></i>
                    <p>No chat history yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load history error:', error);
    }
}

async function loadSession(sessionId) {
    CURRENT_SESSION = sessionId;
    await showView('chat');
    
    const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const data = await response.json();
    const chatMessages = document.getElementById('chat-messages');
    
    if (data.success && data.messages.length > 0) {
        chatMessages.innerHTML = data.messages.map(msg => {
            if (msg.role === 'user') {
                return `
                    <div class="flex justify-end">
                        <div class="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-md">
                            ${escapeHtml(msg.content)}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="flex justify-start">
                        <div class="bg-white border rounded-lg px-4 py-2 max-w-md">
                            ${escapeHtml(msg.content)}
                        </div>
                    </div>
                `;
            }
        }).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Admin View Functions
async function loadAdminView() {
    const viewContent = document.getElementById('view-content');
    
    viewContent.innerHTML = `
        <div>
            <h2 class="text-2xl font-bold mb-6">
                <i class="fas fa-cog mr-2"></i>Admin Dashboard
            </h2>
            <div id="admin-stats" class="grid md:grid-cols-3 gap-4 mb-6">
                <div class="text-center py-8">
                    <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
                </div>
            </div>
        </div>
    `;
    
    await loadAdminStats();
}

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_BASE}/admin/stats/platform`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        
        const data = await response.json();
        const adminStats = document.getElementById('admin-stats');
        
        if (data.success) {
            adminStats.innerHTML = `
                <div class="bg-blue-100 rounded-lg p-6">
                    <div class="text-3xl font-bold text-blue-900">${data.stats.users.total_users}</div>
                    <div class="text-sm text-blue-700">Total Users</div>
                </div>
                <div class="bg-green-100 rounded-lg p-6">
                    <div class="text-3xl font-bold text-green-900">${data.stats.documents.total_documents}</div>
                    <div class="text-sm text-green-700">Total Documents</div>
                </div>
                <div class="bg-purple-100 rounded-lg p-6">
                    <div class="text-3xl font-bold text-purple-900">${data.stats.chat.total_sessions}</div>
                    <div class="text-sm text-purple-700">Chat Sessions</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load admin stats error:', error);
    }
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
