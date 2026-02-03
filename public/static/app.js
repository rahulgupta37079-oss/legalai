// Legal AI Platform - DraftBotPro Style Redesign
// Enterprise Legal Intelligence System with 1,000,000+ Legal Topics

// Configuration
const API_BASE = window.location.origin + '/api';
let AUTH_TOKEN = localStorage.getItem('auth_token');
let CURRENT_USER = null;
let CURRENT_SESSION = null;
let CURRENT_DOCUMENT = null;

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
        <div class="max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-8 mt-20">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-gavel text-white text-2xl"></i>
                </div>
                <h2 class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Welcome Back
                </h2>
                <p class="text-gray-600 mt-2">Sign in to access your legal workspace</p>
            </div>
            <form id="login-form" onsubmit="handleLogin(event)" class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input type="email" id="login-email" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <input type="password" id="login-password" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                </div>
                <button type="submit" 
                        class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition font-semibold">
                    Sign In
                </button>
            </form>
            <p class="text-center mt-6 text-gray-600">
                Don't have an account? 
                <button onclick="showRegister()" class="text-blue-600 hover:text-purple-600 font-semibold">Create Account</button>
            </p>
            <button onclick="showLanding()" class="w-full mt-4 text-gray-500 hover:text-gray-700">
                <i class="fas fa-arrow-left mr-2"></i>Back to Home
            </button>
        </div>
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
            showNotification('Login failed: ' + (data.error || 'Invalid credentials'), 'error');
        }
    } catch (error) {
        showNotification('Login error: ' + error.message, 'error');
    }
}

async function showRegister() {
    const authPage = document.getElementById('auth-page');
    const landingPage = document.getElementById('landing-page');
    const authContent = document.getElementById('auth-content');
    
    landingPage.classList.add('hidden');
    authPage.classList.remove('hidden');
    
    authContent.innerHTML = `
        <div class="max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-8 mt-20">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-user-plus text-white text-2xl"></i>
                </div>
                <h2 class="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                    Join Legal AI
                </h2>
                <p class="text-gray-600 mt-2">Start your journey to smarter legal work</p>
            </div>
            <form id="register-form" onsubmit="handleRegister(event)" class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                    <input type="text" id="register-name" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input type="email" id="register-email" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Organization</label>
                    <input type="text" id="register-org" placeholder="Law firm or company"
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Password (min 8 characters)</label>
                    <input type="password" id="register-password" required minlength="8"
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
                </div>
                <button type="submit" 
                        class="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition font-semibold">
                    Create Account
                </button>
            </form>
            <p class="text-center mt-6 text-gray-600">
                Already have an account? 
                <button onclick="showLogin()" class="text-blue-600 hover:text-purple-600 font-semibold">Sign In</button>
            </p>
            <button onclick="showLanding()" class="w-full mt-4 text-gray-500 hover:text-gray-700">
                <i class="fas fa-arrow-left mr-2"></i>Back to Home
            </button>
        </div>
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
            showNotification('Registration failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Registration error: ' + error.message, 'error');
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
        <button onclick="showLogin()" class="px-6 py-2.5 rounded-xl bg-white text-blue-900 hover:bg-gray-100 transition font-semibold shadow-md">
            Sign In
        </button>
        <button onclick="showRegister()" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-blue-500 hover:shadow-lg transition font-semibold transform hover:-translate-y-0.5">
            Start Free
        </button>
    `;
}

// Dashboard Functions
async function showDashboard() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');
    
    document.getElementById('nav-buttons').innerHTML = `
        <div class="flex items-center space-x-4">
            <span class="text-white px-4 py-2 bg-white bg-opacity-20 rounded-lg backdrop-blur">
                <i class="fas fa-user mr-2"></i>${CURRENT_USER.full_name}
            </span>
            <button onclick="logout()" class="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 transition">
                <i class="fas fa-sign-out-alt mr-2"></i>Logout
            </button>
        </div>
    `;
    
    await loadDashboard();
}

async function loadDashboard() {
    const dashboardContent = document.getElementById('dashboard-content');
    
    dashboardContent.innerHTML = `
        <!-- Quick Action Cards -->
        <div class="grid md:grid-cols-4 gap-4 mb-6">
            <button onclick="showView('chat')" class="group p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl hover:shadow-xl transition transform hover:-translate-y-1">
                <i class="fas fa-comments text-4xl mb-3 group-hover:scale-110 transition"></i>
                <h3 class="font-bold text-lg">AI Legal Assistant</h3>
                <p class="text-sm text-blue-100 mt-1">Chat with AI</p>
            </button>
            <button onclick="showView('documents')" class="group p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl hover:shadow-xl transition transform hover:-translate-y-1">
                <i class="fas fa-file-alt text-4xl mb-3 group-hover:scale-110 transition"></i>
                <h3 class="font-bold text-lg">Documents</h3>
                <p class="text-sm text-green-100 mt-1">Upload & analyze</p>
            </button>
            <button onclick="showView('history')" class="group p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl hover:shadow-xl transition transform hover:-translate-y-1">
                <i class="fas fa-history text-4xl mb-3 group-hover:scale-110 transition"></i>
                <h3 class="font-bold text-lg">History</h3>
                <p class="text-sm text-purple-100 mt-1">View past chats</p>
            </button>
            ${CURRENT_USER.role === 'admin' ? `
            <button onclick="showView('admin')" class="group p-6 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl hover:shadow-xl transition transform hover:-translate-y-1">
                <i class="fas fa-cog text-4xl mb-3 group-hover:scale-110 transition"></i>
                <h3 class="font-bold text-lg">Admin</h3>
                <p class="text-sm text-red-100 mt-1">Platform stats</p>
            </button>
            ` : ''}
        </div>
        
        <!-- Main Content Area -->
        <div id="view-content" class="bg-white rounded-2xl shadow-xl p-8">
            <div class="text-center py-12">
                <div class="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i class="fas fa-gavel text-white text-4xl"></i>
                </div>
                <h2 class="text-3xl font-bold text-gray-800 mb-4">Welcome to Legal AI Platform</h2>
                <p class="text-gray-600 mb-8 text-lg">Your intelligent legal workspace powered by AI</p>
                
                <div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-8">
                    <div class="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                        <i class="fas fa-database text-blue-600 text-3xl mb-3"></i>
                        <h3 class="font-bold text-blue-900 mb-2">1,000,000+ Topics</h3>
                        <p class="text-sm text-blue-700">Comprehensive legal knowledge base covering all areas of law</p>
                    </div>
                    <div class="bg-green-50 rounded-xl p-6 border-2 border-green-200">
                        <i class="fas fa-brain text-green-600 text-3xl mb-3"></i>
                        <h3 class="font-bold text-green-900 mb-2">AI-Powered Research</h3>
                        <p class="text-sm text-green-700">Get instant answers to complex legal questions</p>
                    </div>
                    <div class="bg-purple-50 rounded-xl p-6 border-2 border-purple-200">
                        <i class="fas fa-shield-alt text-purple-600 text-3xl mb-3"></i>
                        <h3 class="font-bold text-purple-900 mb-2">Secure & Private</h3>
                        <p class="text-sm text-purple-700">Your documents and data are always encrypted</p>
                    </div>
                </div>
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

// Chat View Functions - DraftBotPro Style
async function loadChatView() {
    const viewContent = document.getElementById('view-content');
    
    // Load available models
    const modelsResponse = await fetch(`${API_BASE}/models`);
    const modelsData = await modelsResponse.json();
    const models = modelsData.models || [];
    
    viewContent.innerHTML = `
        <div class="flex h-[700px]">
            <!-- Research Panel Sidebar (DraftBotPro style) -->
            <div id="research-panel" class="w-80 bg-gray-50 rounded-l-2xl border-r-2 border-gray-200 p-4 overflow-y-auto hidden">
                <h3 class="font-bold text-lg mb-4 flex items-center">
                    <i class="fas fa-book text-blue-600 mr-2"></i>
                    Research Panel
                </h3>
                <div id="research-content" class="space-y-3">
                    <div class="bg-white rounded-lg p-4 border">
                        <p class="text-sm text-gray-600">
                            Upload a document or ask legal questions to see relevant research and citations here.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Main Chat Area -->
            <div class="flex-1 flex flex-col">
                <!-- Chat Header -->
                <div class="flex justify-between items-center p-4 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 rounded-tr-2xl">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-robot text-blue-600 mr-2"></i>AI Legal Assistant
                        </h2>
                        <p class="text-sm text-gray-600 mt-1">Powered by Legal-BERT & FLAN-T5</p>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="toggleResearchPanel()" class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-semibold">
                            <i class="fas fa-book mr-1"></i>Research
                        </button>
                        <select id="model-select" class="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold">
                            ${models.map(m => `<option value="${m.model_id}">${m.model_name}</option>`).join('')}
                        </select>
                        <button onclick="uploadDocumentInChat()" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-semibold">
                            <i class="fas fa-upload mr-1"></i>Upload
                        </button>
                        <button onclick="startNewChat()" class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-semibold">
                            <i class="fas fa-plus mr-1"></i>New
                        </button>
                    </div>
                </div>
                
                <!-- Current Document Info -->
                <div id="current-document-info" class="px-4 pt-2"></div>
                
                <!-- Chat Messages -->
                <div id="chat-messages" class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                    <div class="text-center text-gray-400 mt-20">
                        <div class="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-comments text-4xl text-blue-600"></i>
                        </div>
                        <p class="text-lg font-semibold text-gray-600">Start a Legal Conversation</p>
                        <p class="text-sm mt-2 max-w-md mx-auto text-gray-500">
                            Ask questions about Indian law, upload documents for analysis, or explore our 1M+ legal topics database
                        </p>
                        <div class="grid grid-cols-2 gap-2 max-w-xl mx-auto mt-6">
                            <button onclick="askSample('Explain Article 21 of Indian Constitution')" 
                                    class="p-3 bg-white rounded-lg hover:shadow-md transition text-left text-sm">
                                <i class="fas fa-balance-scale text-blue-600 mr-2"></i>
                                Article 21 Rights
                            </button>
                            <button onclick="askSample('What is Section 148A procedure?')" 
                                    class="p-3 bg-white rounded-lg hover:shadow-md transition text-left text-sm">
                                <i class="fas fa-file-invoice-dollar text-green-600 mr-2"></i>
                                Tax Reassessment
                            </button>
                            <button onclick="askSample('GST compliance requirements')" 
                                    class="p-3 bg-white rounded-lg hover:shadow-md transition text-left text-sm">
                                <i class="fas fa-receipt text-purple-600 mr-2"></i>
                                GST Laws
                            </button>
                            <button onclick="askSample('Companies Act 2013 overview')" 
                                    class="p-3 bg-white rounded-lg hover:shadow-md transition text-left text-sm">
                                <i class="fas fa-building text-orange-600 mr-2"></i>
                                Corporate Law
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Chat Input -->
                <div class="p-4 bg-white border-t-2 border-gray-200 rounded-br-2xl">
                    <div class="flex space-x-2">
                        <input type="text" id="chat-input" placeholder="Ask anything about law..." 
                               class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                               onkeypress="if(event.key === 'Enter') sendMessage()">
                        <button onclick="sendMessage()" 
                                class="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition font-semibold">
                            <i class="fas fa-paper-plane mr-2"></i>Send
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-2 text-center">
                        <i class="fas fa-shield-alt mr-1"></i>Your conversations are secure and private
                    </p>
                </div>
            </div>
        </div>
    `;
}

function toggleResearchPanel() {
    const panel = document.getElementById('research-panel');
    panel.classList.toggle('hidden');
}

function askSample(question) {
    document.getElementById('chat-input').value = question;
    sendMessage();
}

async function startNewChat() {
    CURRENT_SESSION = null;
    CURRENT_DOCUMENT = null;
    await loadChatView();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    const chatMessages = document.getElementById('chat-messages');
    const model = document.getElementById('model-select').value;
    
    // Clear placeholder if first message
    if (!CURRENT_SESSION) {
        chatMessages.innerHTML = '';
    }
    
    // Add user message with modern styling
    chatMessages.innerHTML += `
        <div class="flex justify-end animate-fade-in">
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl px-5 py-3 max-w-2xl shadow-md">
                <p class="whitespace-pre-wrap">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
    
    // Add loading indicator with animation
    chatMessages.innerHTML += `
        <div id="loading-message" class="flex justify-start animate-fade-in">
            <div class="bg-white rounded-2xl px-5 py-3 shadow-md border-2 border-gray-100">
                <div class="flex items-center space-x-2">
                    <div class="flex space-x-1">
                        <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                        <div class="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                        <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    </div>
                    <span class="text-gray-600">Analyzing...</span>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    input.value = '';
    
    try {
        const requestBody = {
            session_id: CURRENT_SESSION,
            message,
            model
        };
        
        if (CURRENT_DOCUMENT && CURRENT_DOCUMENT.id) {
            requestBody.document_id = CURRENT_DOCUMENT.id;
        }
        
        const response = await fetch(`${API_BASE}/chat/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        // Remove loading indicator
        document.getElementById('loading-message').remove();
        
        if (data.success) {
            CURRENT_SESSION = data.session_id;
            
            // Add AI response with enhanced formatting
            const content = formatLegalResponse(data.message.content);
            
            chatMessages.innerHTML += `
                <div class="flex justify-start animate-fade-in">
                    <div class="bg-white rounded-2xl px-5 py-4 max-w-2xl shadow-md border-2 border-gray-100">
                        <div class="flex items-center space-x-2 text-xs text-gray-500 mb-3 pb-2 border-b border-gray-100">
                            <i class="fas fa-robot text-blue-600"></i>
                            <span class="font-semibold">${data.message.model_used}</span>
                            <span>•</span>
                            <span>${data.message.processing_time_ms}ms</span>
                        </div>
                        <div class="legal-response-content text-gray-800">
                            ${content}
                        </div>
                    </div>
                </div>
            `;
            
            // Update research panel with citations if available
            updateResearchPanel(data.message.content);
        } else {
            chatMessages.innerHTML += `
                <div class="flex justify-start animate-fade-in">
                    <div class="bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl px-5 py-3 max-w-2xl">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Error: ${data.error || 'Failed to get response'}
                    </div>
                </div>
            `;
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        document.getElementById('loading-message').remove();
        chatMessages.innerHTML += `
            <div class="flex justify-start animate-fade-in">
                <div class="bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl px-5 py-3 max-w-2xl">
                    <i class="fas fa-exclamation-circle mr-2"></i>
                    Network error: ${error.message}
                </div>
            </div>
        `;
    }
}

// Format legal responses with enhanced styling
function formatLegalResponse(content) {
    // Convert markdown-style formatting to HTML
    let formatted = escapeHtml(content);
    
    // Headers
    formatted = formatted.replace(/## (.+?)(\n|$)/g, '<h3 class="text-lg font-bold text-blue-900 mt-4 mb-2">$1</h3>');
    formatted = formatted.replace(/### (.+?)(\n|$)/g, '<h4 class="text-base font-bold text-gray-800 mt-3 mb-2">$1</h4>');
    
    // Bold text
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
    
    // Lists
    formatted = formatted.replace(/- (.+?)(\n|$)/g, '<li class="ml-4 mb-1">• $1</li>');
    
    // Checkmarks
    formatted = formatted.replace(/✓ (.+?)(\n|$)/g, '<div class="flex items-start mb-2"><i class="fas fa-check-circle text-green-600 mr-2 mt-1"></i><span>$1</span></div>');
    
    // Line breaks
    formatted = formatted.replace(/\n\n/g, '<br><br>');
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// Update research panel with citations
function updateResearchPanel(content) {
    const panel = document.getElementById('research-content');
    if (!panel) return;
    
    // Extract sections and legal references
    const sections = [];
    
    if (content.includes('Section')) {
        sections.push({
            icon: 'fas fa-file-alt',
            title: 'Legal Provisions Referenced',
            color: 'blue',
            items: ['Sections mentioned in the response']
        });
    }
    
    if (content.includes('Article')) {
        sections.push({
            icon: 'fas fa-balance-scale',
            title: 'Constitutional References',
            color: 'purple',
            items: ['Constitutional articles discussed']
        });
    }
    
    if (content.includes('Act') || content.includes('Law')) {
        sections.push({
            icon: 'fas fa-gavel',
            title: 'Applicable Acts',
            color: 'green',
            items: ['Relevant legislation']
        });
    }
    
    if (sections.length > 0) {
        panel.innerHTML = sections.map(section => `
            <div class="bg-white rounded-lg p-4 border-l-4 border-${section.color}-500 shadow-sm">
                <h4 class="font-bold text-${section.color}-900 mb-2 flex items-center">
                    <i class="${section.icon} text-${section.color}-600 mr-2"></i>
                    ${section.title}
                </h4>
                <ul class="text-sm text-gray-700 space-y-1">
                    ${section.items.map(item => `<li>• ${item}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    }
}

// Documents View Functions
async function loadDocumentsView() {
    const viewContent = document.getElementById('view-content');
    
    viewContent.innerHTML = `
        <div>
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-3xl font-bold text-gray-800">
                        <i class="fas fa-folder-open text-green-600 mr-2"></i>Document Library
                    </h2>
                    <p class="text-gray-600 mt-1">Manage and analyze your legal documents</p>
                </div>
                <button onclick="showUploadDialog()" 
                        class="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition font-semibold">
                    <i class="fas fa-cloud-upload-alt mr-2"></i>Upload Document
                </button>
            </div>
            
            <div id="documents-list" class="space-y-4">
                <div class="text-center py-12">
                    <div class="inline-block">
                        <div class="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p class="mt-4 text-gray-600">Loading documents...</p>
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
                <div class="bg-white border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition transform hover:-translate-y-1">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-start space-x-4">
                                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-file-alt text-white text-xl"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-bold text-xl text-gray-800">${escapeHtml(doc.title)}</h3>
                                    <p class="text-sm text-gray-600 mt-2 flex items-center flex-wrap gap-2">
                                        <span class="flex items-center">
                                            <i class="fas fa-file mr-1"></i>${doc.filename}
                                        </span>
                                        <span class="text-gray-400">•</span>
                                        <span class="flex items-center">
                                            <i class="fas fa-hdd mr-1"></i>${formatFileSize(doc.file_size)}
                                        </span>
                                        <span class="text-gray-400">•</span>
                                        <span class="flex items-center">
                                            <i class="fas fa-calendar mr-1"></i>${new Date(doc.uploaded_at).toLocaleDateString()}
                                        </span>
                                    </p>
                                    ${doc.tags ? `
                                        <div class="mt-3 flex flex-wrap gap-2">
                                            ${doc.tags.split(',').map(tag => 
                                                `<span class="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">${tag.trim()}</span>`
                                            ).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex space-x-2 ml-4">
                            <button onclick="chatWithDocument(${doc.id})" 
                                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-semibold">
                                <i class="fas fa-comments mr-1"></i>Chat
                            </button>
                            <a href="${API_BASE}/documents/${doc.id}/download" 
                               class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm font-semibold inline-flex items-center">
                                <i class="fas fa-download"></i>
                            </a>
                            <button onclick="deleteDocument(${doc.id})" 
                                    class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-semibold">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            documentsList.innerHTML = `
                <div class="text-center py-20">
                    <div class="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-folder-open text-6xl text-gray-400"></i>
                    </div>
                    <p class="text-xl font-semibold text-gray-600 mb-2">No documents yet</p>
                    <p class="text-gray-500 mb-6">Upload your first legal document to get started</p>
                    <button onclick="showUploadDialog()" 
                            class="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition font-semibold">
                        <i class="fas fa-cloud-upload-alt mr-2"></i>Upload Document
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load documents error:', error);
        document.getElementById('documents-list').innerHTML = `
            <div class="text-center py-12 bg-red-50 rounded-xl border-2 border-red-200">
                <i class="fas fa-exclamation-circle text-red-600 text-4xl mb-4"></i>
                <p class="text-red-800 font-semibold">Error loading documents</p>
                <p class="text-red-600 text-sm mt-2">${error.message}</p>
            </div>
        `;
    }
}

function showUploadDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    dialog.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-scale-in">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-cloud-upload-alt text-white text-2xl"></i>
                </div>
                <h3 class="text-2xl font-bold text-gray-800">Upload Legal Document</h3>
                <p class="text-gray-600 mt-2">Add documents to your library for AI analysis</p>
            </div>
            <form id="upload-form" onsubmit="handleUpload(event)" class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Document Title</label>
                    <input type="text" id="upload-title" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Document Type</label>
                    <select id="upload-type" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500">
                        <option value="contract">Contract</option>
                        <option value="case_law">Case Law</option>
                        <option value="statute">Statute</option>
                        <option value="regulation">Regulation</option>
                        <option value="brief">Brief</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Tags (comma-separated)</label>
                    <input type="text" id="upload-tags" placeholder="e.g., contract, employment, 2024"
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">File (PDF, DOC, TXT - Max 50MB)</label>
                    <input type="file" id="upload-file" required accept=".pdf,.txt,.doc,.docx"
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl">
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="submit" 
                            class="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl hover:shadow-lg transition font-semibold">
                        <i class="fas fa-upload mr-2"></i>Upload
                    </button>
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition font-semibold">
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
            showNotification('Document uploaded successfully!', 'success');
        } else {
            showNotification('Upload failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Upload error: ' + error.message, 'error');
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
            showNotification('Document deleted successfully', 'success');
        } else {
            showNotification('Delete failed: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Delete error: ' + error.message, 'error');
    }
}

// Upload document in chat
function uploadDocumentInChat() {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    dialog.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-scale-in">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-upload text-white text-2xl"></i>
                </div>
                <h3 class="text-2xl font-bold text-gray-800">Upload for Chat Analysis</h3>
                <p class="text-gray-600 mt-2">Add a document to discuss with AI</p>
            </div>
            <form id="chat-upload-form" onsubmit="handleChatUpload(event)" class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Document Title</label>
                    <input type="text" id="chat-upload-title" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Document Type</label>
                    <select id="chat-upload-type" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl">
                        <option value="contract">Contract</option>
                        <option value="case_law">Case Law</option>
                        <option value="statute">Statute</option>
                        <option value="regulation">Regulation</option>
                        <option value="brief">Brief</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">File (PDF, DOC, TXT - Max 50MB)</label>
                    <input type="file" id="chat-upload-file" required accept=".pdf,.txt,.doc,.docx"
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl">
                </div>
                <div class="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <p class="text-sm text-blue-800 flex items-start">
                        <i class="fas fa-info-circle text-blue-600 mr-2 mt-0.5"></i>
                        <span>Upload your document and start asking questions about it immediately</span>
                    </p>
                </div>
                <div class="flex space-x-3 pt-2">
                    <button type="submit" 
                            class="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl hover:shadow-lg transition font-semibold">
                        <i class="fas fa-upload mr-2"></i>Upload & Chat
                    </button>
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition font-semibold">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(dialog);
}

async function handleChatUpload(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('title', document.getElementById('chat-upload-title').value);
    formData.append('document_type', document.getElementById('chat-upload-type').value);
    formData.append('tags', 'chat-context');
    formData.append('file', document.getElementById('chat-upload-file').files[0]);
    
    try {
        const response = await fetch(`${API_BASE}/documents/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            event.target.closest('.fixed').remove();
            CURRENT_DOCUMENT = data.document;
            
            // Show document info
            const docInfo = document.getElementById('current-document-info');
            docInfo.innerHTML = `
                <div class="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-4 flex justify-between items-center">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                            <i class="fas fa-file-alt text-white"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-green-900">${escapeHtml(data.document.title)}</h4>
                            <p class="text-sm text-green-700">
                                ${data.document.filename} • ${formatFileSize(data.document.file_size)}
                            </p>
                        </div>
                    </div>
                    <button onclick="clearCurrentDocument()" 
                            class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            await chatWithDocument(data.document.id);
            
            // Welcome message
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = `
                <div class="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6">
                    <h3 class="font-bold text-blue-900 text-lg mb-2">
                        <i class="fas fa-check-circle text-green-600 mr-2"></i>
                        Document Loaded Successfully
                    </h3>
                    <p class="text-blue-800 mb-4">
                        <strong>${escapeHtml(data.document.title)}</strong> is now ready for AI analysis
                    </p>
                    <div class="bg-white rounded-lg p-4 border-2 border-blue-200">
                        <p class="text-sm text-gray-700 font-semibold mb-2">Try asking:</p>
                        <ul class="text-sm text-gray-600 space-y-1">
                            <li>• "Summarize this document"</li>
                            <li>• "What are the key points?"</li>
                            <li>• "Extract important dates and parties"</li>
                            <li>• "Identify potential legal risks"</li>
                        </ul>
                    </div>
                </div>
            `;
            
            showNotification('Document uploaded and ready for analysis!', 'success');
        } else {
            showNotification('Upload failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Upload error: ' + error.message, 'error');
    }
}

function clearCurrentDocument() {
    CURRENT_DOCUMENT = null;
    CURRENT_SESSION = null;
    document.getElementById('current-document-info').innerHTML = '';
    loadChatView();
}

async function chatWithDocument(docId) {
    CURRENT_SESSION = null;
    await showView('chat');
    
    try {
        const docResponse = await fetch(`${API_BASE}/documents/${docId}`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        
        if (docResponse.ok) {
            const docData = await docResponse.json();
            if (docData.success && docData.document) {
                CURRENT_DOCUMENT = docData.document;
                
                const docInfo = document.getElementById('current-document-info');
                if (docInfo) {
                    docInfo.innerHTML = `
                        <div class="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-4 flex justify-between items-center">
                            <div class="flex items-center space-x-3">
                                <div class="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-file-alt text-white"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-green-900">${escapeHtml(docData.document.title)}</h4>
                                    <p class="text-sm text-green-700">
                                        ${docData.document.filename} • ${formatFileSize(docData.document.file_size)}
                                    </p>
                                </div>
                            </div>
                            <button onclick="clearCurrentDocument()" 
                                    class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `;
                }
            }
        }
        
        const response = await fetch(`${API_BASE}/chat/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                document_id: docId,
                title: `Chat: ${CURRENT_DOCUMENT?.title || 'Document'}`
            })
        });
        
        const data = await response.json();
        if (data.success) {
            CURRENT_SESSION = data.session.id;
            
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6">
                        <h3 class="font-bold text-blue-900 text-lg mb-2">
                            <i class="fas fa-check-circle text-green-600 mr-2"></i>
                            Document Loaded
                        </h3>
                        <p class="text-blue-800">
                            You can now chat about <strong>${escapeHtml(CURRENT_DOCUMENT?.title || 'this document')}</strong>
                        </p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading document for chat:', error);
        showNotification('Failed to load document for chat', 'error');
    }
}

// History View
async function loadHistoryView() {
    const viewContent = document.getElementById('view-content');
    
    viewContent.innerHTML = `
        <div>
            <div class="mb-6">
                <h2 class="text-3xl font-bold text-gray-800">
                    <i class="fas fa-history text-purple-600 mr-2"></i>Chat History
                </h2>
                <p class="text-gray-600 mt-1">Review your previous legal conversations</p>
            </div>
            <div id="history-list" class="space-y-4">
                <div class="text-center py-12">
                    <div class="inline-block">
                        <div class="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p class="mt-4 text-gray-600">Loading history...</p>
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
                <div class="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-xl transition transform hover:-translate-y-1 cursor-pointer"
                     onclick="loadSession(${session.id})">
                    <div class="flex items-start space-x-4">
                        <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-comments text-white text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="font-bold text-lg text-gray-800">${escapeHtml(session.title)}</h3>
                            <p class="text-sm text-gray-600 mt-1 flex items-center space-x-2">
                                <span class="flex items-center">
                                    <i class="fas fa-robot text-purple-600 mr-1"></i>${session.ai_model}
                                </span>
                                <span class="text-gray-400">•</span>
                                <span class="flex items-center">
                                    <i class="fas fa-calendar text-blue-600 mr-1"></i>${new Date(session.created_at).toLocaleDateString()}
                                </span>
                            </p>
                        </div>
                        <i class="fas fa-chevron-right text-gray-400"></i>
                    </div>
                </div>
            `).join('');
        } else {
            historyList.innerHTML = `
                <div class="text-center py-20">
                    <div class="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-history text-6xl text-gray-400"></i>
                    </div>
                    <p class="text-xl font-semibold text-gray-600">No chat history yet</p>
                    <p class="text-gray-500 mt-2">Start a conversation to see it here</p>
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
                        <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl px-5 py-3 max-w-2xl">
                            ${escapeHtml(msg.content)}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="flex justify-start">
                        <div class="bg-white rounded-2xl px-5 py-3 max-w-2xl shadow-md border-2 border-gray-100">
                            ${formatLegalResponse(msg.content)}
                        </div>
                    </div>
                `;
            }
        }).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Admin View
async function loadAdminView() {
    const viewContent = document.getElementById('view-content');
    
    viewContent.innerHTML = `
        <div>
            <div class="mb-6">
                <h2 class="text-3xl font-bold text-gray-800">
                    <i class="fas fa-shield-alt text-red-600 mr-2"></i>Admin Dashboard
                </h2>
                <p class="text-gray-600 mt-1">Platform statistics and insights</p>
            </div>
            <div id="admin-stats" class="grid md:grid-cols-3 gap-6 mb-6">
                <div class="text-center py-12">
                    <div class="inline-block">
                        <div class="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
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
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-8 shadow-xl">
                    <i class="fas fa-users text-4xl mb-4 opacity-80"></i>
                    <div class="text-4xl font-bold mb-2">${data.stats.users.total_users}</div>
                    <div class="text-blue-100 font-semibold">Total Users</div>
                </div>
                <div class="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-8 shadow-xl">
                    <i class="fas fa-file-alt text-4xl mb-4 opacity-80"></i>
                    <div class="text-4xl font-bold mb-2">${data.stats.documents.total_documents}</div>
                    <div class="text-green-100 font-semibold">Total Documents</div>
                </div>
                <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-8 shadow-xl">
                    <i class="fas fa-comments text-4xl mb-4 opacity-80"></i>
                    <div class="text-4xl font-bold mb-2">${data.stats.chat.total_sessions}</div>
                    <div class="text-purple-100 font-semibold">Chat Sessions</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load admin stats error:', error);
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        success: 'from-green-500 to-green-600',
        error: 'from-red-500 to-red-600',
        info: 'from-blue-500 to-blue-600'
    };
    
    notification.className = `fixed top-4 right-4 z-50 bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3 animate-slide-in`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} text-xl"></i>
        <span class="font-semibold">${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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
