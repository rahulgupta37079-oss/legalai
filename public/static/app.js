// Legal AI Platform - Frontend Application
// Version: 1.0.0

// Global state
const state = {
    token: localStorage.getItem('legal_ai_token'),
    user: null,
    currentPage: 'overview',
    currentSession: null,
    documents: [],
    sessions: []
};

// API base URL
const API_BASE = '/api';

// Configure axios
axios.defaults.baseURL = API_BASE;
axios.interceptors.request.use(config => {
    if (state.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
    }
    return config;
});

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

function showLogin() {
    document.getElementById('modal-content').innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-sign-in-alt text-blue-600 mr-2"></i>
            Sign In
        </h2>
        <form onsubmit="handleLogin(event)" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" id="login-email" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input type="password" id="login-password" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••">
            </div>
            <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
                <i class="fas fa-sign-in-alt mr-2"></i>Sign In
            </button>
        </form>
        <div class="mt-4 text-center text-sm text-gray-600">
            Don't have an account? 
            <a onclick="showRegister()" class="text-blue-600 hover:underline cursor-pointer">Sign up</a>
        </div>
        <div class="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-gray-600">
            <strong>Demo Account:</strong><br>
            Email: admin@legalai.com<br>
            Password: Admin@123
        </div>
    `;
    document.getElementById('auth-modal').classList.remove('hidden');
}

function showRegister() {
    document.getElementById('modal-content').innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-user-plus text-green-600 mr-2"></i>
            Create Account
        </h2>
        <form onsubmit="handleRegister(event)" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input type="text" id="register-name" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="John Doe">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" id="register-email" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="your@email.com">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Organization (Optional)</label>
                <input type="text" id="register-org"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Your Law Firm">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input type="password" id="register-password" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="••••••••">
            </div>
            <button type="submit" class="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition">
                <i class="fas fa-user-plus mr-2"></i>Create Account
            </button>
        </form>
        <div class="mt-4 text-center text-sm text-gray-600">
            Already have an account? 
            <a onclick="showLogin()" class="text-blue-600 hover:underline cursor-pointer">Sign in</a>
        </div>
    `;
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await axios.post('/auth/login', { email, password });
        if (response.data.success) {
            state.token = response.data.token;
            state.user = response.data.user;
            localStorage.setItem('legal_ai_token', state.token);
            closeModal();
            showDashboard();
        }
    } catch (error) {
        alert(error.response?.data?.error || 'Login failed');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const full_name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const organization = document.getElementById('register-org').value;

    try {
        const response = await axios.post('/auth/register', {
            full_name, email, password, organization
        });
        if (response.data.success) {
            state.token = response.data.token;
            state.user = response.data.user;
            localStorage.setItem('legal_ai_token', state.token);
            closeModal();
            showDashboard();
        }
    } catch (error) {
        alert(error.response?.data?.error || 'Registration failed');
    }
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('legal_ai_token');
    location.reload();
}

// ============================================================================
// DASHBOARD FUNCTIONS
// ============================================================================

function showDashboard() {
    document.getElementById('hero-section').style.display = 'none';
    document.getElementById('features-section').style.display = 'none';
    document.getElementById('dashboard-section').classList.remove('hidden');
    
    // Update user info
    document.getElementById('user-name').textContent = state.user.full_name;
    document.getElementById('user-email').textContent = state.user.email;
    document.getElementById('api-quota').textContent = state.user.api_quota;
    document.getElementById('api-used').textContent = state.user.api_used;
    
    // Show admin menu if admin
    if (state.user.role === 'admin') {
        document.getElementById('admin-menu-item').style.display = 'flex';
    }
    
    showDashboardPage('overview');
}

async function showDashboardPage(page) {
    state.currentPage = page;
    
    const titles = {
        overview: 'Dashboard Overview',
        documents: 'Document Library',
        chat: 'AI Legal Chat',
        history: 'Chat History',
        admin: 'Admin Panel'
    };
    
    document.getElementById('page-title').textContent = titles[page] || 'Dashboard';
    
    const contentDiv = document.getElementById('page-content');
    
    switch(page) {
        case 'overview':
            await renderOverview(contentDiv);
            break;
        case 'documents':
            await renderDocuments(contentDiv);
            break;
        case 'chat':
            await renderChat(contentDiv);
            break;
        case 'history':
            await renderHistory(contentDiv);
            break;
        case 'admin':
            await renderAdmin(contentDiv);
            break;
    }
}

// ============================================================================
// OVERVIEW PAGE
// ============================================================================

async function renderOverview(container) {
    try {
        const statsResponse = await axios.get('/users/stats');
        const stats = statsResponse.data.stats;
        
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-blue-100 text-sm">Total Documents</p>
                            <p class="text-3xl font-bold mt-2">${stats.documents.total || 0}</p>
                        </div>
                        <i class="fas fa-file-alt text-4xl text-blue-200"></i>
                    </div>
                </div>
                
                <div class="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-green-100 text-sm">Chat Sessions</p>
                            <p class="text-3xl font-bold mt-2">${stats.chats.total_sessions || 0}</p>
                        </div>
                        <i class="fas fa-comments text-4xl text-green-200"></i>
                    </div>
                </div>
                
                <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-purple-100 text-sm">Total Messages</p>
                            <p class="text-3xl font-bold mt-2">${stats.chats.total_messages || 0}</p>
                        </div>
                        <i class="fas fa-envelope text-4xl text-purple-200"></i>
                    </div>
                </div>
                
                <div class="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-6 shadow-lg">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-yellow-100 text-sm">API Usage</p>
                            <p class="text-3xl font-bold mt-2">${state.user.api_used}/${state.user.api_quota}</p>
                        </div>
                        <i class="fas fa-chart-line text-4xl text-yellow-200"></i>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-folder text-blue-600 mr-2"></i>
                        Document Categories
                    </h3>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <span class="text-gray-700">Contracts</span>
                            <span class="font-bold text-blue-600">${stats.documents.contracts || 0}</span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span class="text-gray-700">Legislation</span>
                            <span class="font-bold text-green-600">${stats.documents.legislation || 0}</span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                            <span class="text-gray-700">Case Law</span>
                            <span class="font-bold text-purple-600">${stats.documents.case_law || 0}</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-history text-green-600 mr-2"></i>
                        Recent Activity
                    </h3>
                    <div class="space-y-3">
                        ${stats.recent_activity && stats.recent_activity.length > 0 ? 
                            stats.recent_activity.slice(0, 5).map(activity => `
                                <div class="flex items-center p-3 bg-gray-50 rounded-lg">
                                    <i class="fas fa-circle text-xs text-green-500 mr-3"></i>
                                    <div class="flex-1">
                                        <p class="text-sm text-gray-800">${activity.action} - ${activity.resource_type}</p>
                                        <p class="text-xs text-gray-500">${new Date(activity.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            `).join('') 
                            : '<p class="text-gray-500 text-center py-4">No recent activity</p>'
                        }
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Failed to load overview</p>';
    }
}

// ============================================================================
// DOCUMENTS PAGE
// ============================================================================

async function renderDocuments(container) {
    try {
        const response = await axios.get('/documents');
        state.documents = response.data.documents;
        
        container.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <div class="flex space-x-4">
                    <select id="doc-category-filter" onchange="filterDocuments()" 
                        class="px-4 py-2 border border-gray-300 rounded-lg">
                        <option value="">All Categories</option>
                        <option value="contract">Contracts</option>
                        <option value="legislation">Legislation</option>
                        <option value="case_law">Case Law</option>
                        <option value="legal_opinion">Legal Opinion</option>
                        <option value="general">General</option>
                    </select>
                </div>
                <button onclick="showUploadModal()" 
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    <i class="fas fa-upload mr-2"></i>Upload Document
                </button>
            </div>
            
            <div class="bg-white rounded-xl shadow-lg overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="documents-table-body" class="divide-y divide-gray-200">
                        ${renderDocumentRows(state.documents)}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Failed to load documents</p>';
    }
}

function renderDocumentRows(documents) {
    if (documents.length === 0) {
        return '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No documents uploaded yet</td></tr>';
    }
    
    return documents.map(doc => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <i class="fas fa-file-pdf text-red-500 mr-3"></i>
                    <div>
                        <p class="text-sm font-medium text-gray-900">${doc.title}</p>
                        <p class="text-xs text-gray-500">${doc.filename}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    ${doc.category}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${formatFileSize(doc.file_size)}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${new Date(doc.created_at).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 text-sm space-x-2">
                <button onclick="startChatWithDocument(${doc.id}, '${doc.title}')" 
                    class="text-green-600 hover:text-green-800" title="Chat with document">
                    <i class="fas fa-comments"></i>
                </button>
                <button onclick="downloadDocument(${doc.id})" 
                    class="text-blue-600 hover:text-blue-800" title="Download">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteDocument(${doc.id})" 
                    class="text-red-600 hover:text-red-800" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function showUploadModal() {
    const modal = document.getElementById('auth-modal');
    document.getElementById('modal-content').innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-upload text-blue-600 mr-2"></i>
            Upload Document
        </h2>
        <form onsubmit="handleUpload(event)" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Document Title</label>
                <input type="text" id="upload-title" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Employment Contract">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select id="upload-category" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option value="general">General</option>
                    <option value="contract">Contract</option>
                    <option value="legislation">Legislation</option>
                    <option value="case_law">Case Law</option>
                    <option value="legal_opinion">Legal Opinion</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">File</label>
                <input type="file" id="upload-file" required accept=".pdf,.txt,.doc,.docx"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <p class="text-xs text-gray-500 mt-1">Supported: PDF, TXT, DOC, DOCX (Max 10MB)</p>
            </div>
            <button type="submit" class="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                <i class="fas fa-upload mr-2"></i>Upload
            </button>
        </form>
    `;
    modal.classList.remove('hidden');
}

async function handleUpload(event) {
    event.preventDefault();
    const title = document.getElementById('upload-title').value;
    const category = document.getElementById('upload-category').value;
    const file = document.getElementById('upload-file').files[0];
    
    if (!file) return;
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('file', file);
    
    try {
        await axios.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        closeModal();
        showDashboardPage('documents');
        alert('Document uploaded successfully!');
    } catch (error) {
        alert(error.response?.data?.error || 'Upload failed');
    }
}

async function downloadDocument(id) {
    try {
        const response = await axios.get(`/documents/${id}/download`, {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'document.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        alert('Download failed');
    }
}

async function deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        await axios.delete(`/documents/${id}`);
        showDashboardPage('documents');
        alert('Document deleted successfully');
    } catch (error) {
        alert('Delete failed');
    }
}

// ============================================================================
// CHAT PAGE
// ============================================================================

async function renderChat(container) {
    try {
        const modelsResponse = await axios.get('/chat/models');
        const models = modelsResponse.data.models;
        
        const documentsResponse = await axios.get('/documents');
        const documents = documentsResponse.data.documents;
        
        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Chat Settings -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h3 class="text-lg font-bold text-gray-800 mb-4">
                        <i class="fas fa-cog text-blue-600 mr-2"></i>
                        Chat Settings
                    </h3>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
                            <select id="chat-model" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                ${models.map(m => `
                                    <option value="${m.id}">${m.name}</option>
                                `).join('')}
                            </select>
                            <p id="model-description" class="text-xs text-gray-500 mt-1"></p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Document (Optional)</label>
                            <select id="chat-document" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                <option value="">No document</option>
                                ${documents.map(d => `
                                    <option value="${d.id}">${d.title}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <button onclick="startNewChat()" 
                            class="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
                            <i class="fas fa-plus mr-2"></i>New Chat Session
                        </button>
                    </div>
                </div>
                
                <!-- Chat Window -->
                <div class="lg:col-span-2 bg-white rounded-xl shadow-lg flex flex-col" style="height: 600px;">
                    <div class="p-6 border-b border-gray-200">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-robot text-blue-600 mr-2"></i>
                            <span id="chat-title">Start a new chat session</span>
                        </h3>
                    </div>
                    
                    <div id="chat-messages" class="flex-1 overflow-y-auto p-6 space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-comments text-4xl mb-4"></i>
                            <p>Select a model and start a new chat session</p>
                        </div>
                    </div>
                    
                    <div class="p-6 border-t border-gray-200">
                        <form onsubmit="sendMessage(event)" class="flex space-x-2">
                            <input type="text" id="chat-input" placeholder="Ask a legal question..." 
                                class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                disabled>
                            <button type="submit" id="chat-send-btn"
                                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                disabled>
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Update model description
        document.getElementById('chat-model').addEventListener('change', (e) => {
            const model = models.find(m => m.id === e.target.value);
            document.getElementById('model-description').textContent = model ? model.description : '';
        });
        
        // Trigger initial description
        document.getElementById('chat-model').dispatchEvent(new Event('change'));
        
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Failed to load chat</p>';
    }
}

async function startNewChat() {
    const modelName = document.getElementById('chat-model').value;
    const documentId = document.getElementById('chat-document').value;
    
    try {
        const response = await axios.post('/chat/sessions', {
            title: 'New Legal Consultation',
            model_name: modelName,
            document_id: documentId || null
        });
        
        state.currentSession = response.data.session;
        document.getElementById('chat-title').textContent = state.currentSession.title;
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-send-btn').disabled = false;
        document.getElementById('chat-messages').innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p class="text-sm text-gray-700">
                    <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                    Chat session started with <strong>${modelName}</strong> model.
                    ${documentId ? 'Document context loaded.' : 'Ask any legal question!'}
                </p>
            </div>
        `;
    } catch (error) {
        alert('Failed to start chat session');
    }
}

async function startChatWithDocument(docId, docTitle) {
    try {
        const response = await axios.post('/chat/sessions', {
            title: `Chat about: ${docTitle}`,
            model_name: 'flan-t5-legal',
            document_id: docId
        });
        
        state.currentSession = response.data.session;
        showDashboardPage('chat');
        
        setTimeout(() => {
            document.getElementById('chat-title').textContent = state.currentSession.title;
            document.getElementById('chat-input').disabled = false;
            document.getElementById('chat-send-btn').disabled = false;
            document.getElementById('chat-document').value = docId;
            document.getElementById('chat-messages').innerHTML = `
                <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                    <p class="text-sm text-gray-700">
                        <i class="fas fa-check-circle text-green-600 mr-2"></i>
                        Now chatting about <strong>${docTitle}</strong>
                    </p>
                </div>
            `;
        }, 500);
    } catch (error) {
        alert('Failed to start chat');
    }
}

async function sendMessage(event) {
    event.preventDefault();
    
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message || !state.currentSession) return;
    
    // Add user message to UI
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML += `
        <div class="flex justify-end">
            <div class="bg-blue-600 text-white rounded-lg px-4 py-3 max-w-md">
                <p class="text-sm">${message}</p>
            </div>
        </div>
    `;
    
    input.value = '';
    input.disabled = true;
    
    // Add loading indicator
    messagesDiv.innerHTML += `
        <div class="flex justify-start" id="loading-message">
            <div class="bg-gray-200 rounded-lg px-4 py-3 max-w-md">
                <p class="text-sm text-gray-600">
                    <i class="fas fa-spinner fa-spin mr-2"></i>AI is thinking...
                </p>
            </div>
        </div>
    `;
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    try {
        const response = await axios.post(`/chat/sessions/${state.currentSession.id}/messages`, {
            message,
            model_name: document.getElementById('chat-model').value
        });
        
        // Remove loading
        document.getElementById('loading-message').remove();
        
        // Add AI response
        messagesDiv.innerHTML += `
            <div class="flex justify-start">
                <div class="bg-gray-100 rounded-lg px-4 py-3 max-w-md">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-robot text-blue-600 mr-2"></i>
                        <span class="text-xs text-gray-600">${response.data.message.model_name}</span>
                    </div>
                    <p class="text-sm text-gray-800 whitespace-pre-wrap">${response.data.message.content}</p>
                    <p class="text-xs text-gray-500 mt-2">
                        <i class="fas fa-coins mr-1"></i>Tokens: ${response.data.message.tokens_used}
                    </p>
                </div>
            </div>
        `;
        
        input.disabled = false;
        input.focus();
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Update API usage
        state.user.api_used++;
        document.getElementById('api-used').textContent = state.user.api_used;
        
    } catch (error) {
        document.getElementById('loading-message').remove();
        messagesDiv.innerHTML += `
            <div class="flex justify-start">
                <div class="bg-red-100 border-l-4 border-red-500 rounded-lg px-4 py-3 max-w-md">
                    <p class="text-sm text-red-800">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        ${error.response?.data?.error || 'Failed to send message'}
                    </p>
                </div>
            </div>
        `;
        input.disabled = false;
    }
}

// ============================================================================
// HISTORY PAGE
// ============================================================================

async function renderHistory(container) {
    try {
        const response = await axios.get('/chat/sessions');
        const sessions = response.data.sessions;
        
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="mb-6 flex justify-between items-center">
                    <h3 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-history text-blue-600 mr-2"></i>
                        Chat History
                    </h3>
                </div>
                
                <div class="space-y-4">
                    ${sessions.length > 0 ? sessions.map(session => `
                        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-800">${session.title}</h4>
                                    <div class="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                                        <span><i class="fas fa-robot mr-1"></i>${session.model_name}</span>
                                        <span><i class="fas fa-comments mr-1"></i>${session.message_count} messages</span>
                                        <span><i class="fas fa-calendar mr-1"></i>${new Date(session.created_at).toLocaleDateString()}</span>
                                    </div>
                                    ${session.document_title ? `
                                        <div class="mt-2">
                                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                <i class="fas fa-file mr-1"></i>${session.document_title}
                                            </span>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="flex space-x-2">
                                    <button onclick="viewSession(${session.id})" 
                                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                                        <i class="fas fa-eye mr-1"></i>View
                                    </button>
                                    <button onclick="deleteSession(${session.id})" 
                                        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                                        <i class="fas fa-trash mr-1"></i>Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('') : '<p class="text-center text-gray-500 py-8">No chat history yet</p>'}
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Failed to load history</p>';
    }
}

async function viewSession(sessionId) {
    try {
        const response = await axios.get(`/chat/sessions/${sessionId}/messages`);
        const messages = response.data.messages;
        
        const modal = document.getElementById('auth-modal');
        document.getElementById('modal-content').innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-comments text-blue-600 mr-2"></i>
                Chat Session
            </h2>
            <div class="max-h-96 overflow-y-auto space-y-4">
                ${messages.map(msg => `
                    <div class="flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                        <div class="${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'} rounded-lg px-4 py-3 max-w-md">
                            ${msg.role === 'assistant' ? `
                                <div class="flex items-center mb-2">
                                    <i class="fas fa-robot text-blue-600 mr-2"></i>
                                    <span class="text-xs ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-600'}">${msg.model_name || 'AI'}</span>
                                </div>
                            ` : ''}
                            <p class="text-sm whitespace-pre-wrap">${msg.content}</p>
                            <p class="text-xs ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'} mt-2">
                                ${new Date(msg.created_at).toLocaleString()}
                            </p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        modal.classList.remove('hidden');
    } catch (error) {
        alert('Failed to load session');
    }
}

async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    
    try {
        await axios.delete(`/chat/sessions/${sessionId}`);
        showDashboardPage('history');
        alert('Session deleted successfully');
    } catch (error) {
        alert('Delete failed');
    }
}

// ============================================================================
// ADMIN PAGE
// ============================================================================

async function renderAdmin(container) {
    if (state.user.role !== 'admin') {
        container.innerHTML = '<p class="text-red-600">Admin access required</p>';
        return;
    }
    
    try {
        const statsResponse = await axios.get('/admin/stats');
        const stats = statsResponse.data.stats;
        
        const usersResponse = await axios.get('/admin/users');
        const users = usersResponse.data.users;
        
        container.innerHTML = `
            <!-- Admin Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="text-3xl font-bold text-blue-600">${stats.users.total_users}</div>
                    <div class="text-sm text-gray-600 mt-1">Total Users</div>
                    <div class="text-xs text-green-600 mt-2">
                        <i class="fas fa-arrow-up mr-1"></i>${stats.users.users_today} today
                    </div>
                </div>
                
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="text-3xl font-bold text-green-600">${stats.documents.total_documents}</div>
                    <div class="text-sm text-gray-600 mt-1">Total Documents</div>
                    <div class="text-xs text-gray-500 mt-2">
                        ${formatFileSize(stats.documents.total_storage)} storage
                    </div>
                </div>
                
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="text-3xl font-bold text-purple-600">${stats.chats.total_sessions}</div>
                    <div class="text-sm text-gray-600 mt-1">Chat Sessions</div>
                    <div class="text-xs text-gray-500 mt-2">
                        ${stats.chats.total_messages} messages
                    </div>
                </div>
                
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="text-3xl font-bold text-yellow-600">${stats.api.total_api_calls}</div>
                    <div class="text-sm text-gray-600 mt-1">API Calls</div>
                    <div class="text-xs text-gray-500 mt-2">
                        ${stats.api.total_tokens} tokens
                    </div>
                </div>
            </div>
            
            <!-- Users Table -->
            <div class="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-users text-blue-600 mr-2"></i>
                        User Management
                    </h3>
                </div>
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Usage</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${users.map(user => `
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4">
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">${user.full_name}</p>
                                        <p class="text-xs text-gray-500">${user.email}</p>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-500">
                                    ${user.organization || '-'}
                                </td>
                                <td class="px-6 py-4">
                                    <span class="px-2 py-1 text-xs font-semibold rounded-full 
                                        ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 
                                          user.role === 'enterprise' ? 'bg-purple-100 text-purple-800' : 
                                          'bg-blue-100 text-blue-800'}">
                                        ${user.role}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-500">
                                    ${user.api_used} / ${user.api_quota}
                                </td>
                                <td class="px-6 py-4">
                                    <span class="px-2 py-1 text-xs font-semibold rounded-full 
                                        ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                        ${user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-500">
                                    ${new Date(user.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Failed to load admin panel</p>';
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function scrollToFeatures() {
    document.getElementById('features-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Check if user is already logged in
if (state.token) {
    axios.get('/auth/verify')
        .then(response => {
            if (response.data.success) {
                state.user = response.data.user;
                showDashboard();
            } else {
                localStorage.removeItem('legal_ai_token');
            }
        })
        .catch(() => {
            localStorage.removeItem('legal_ai_token');
        });
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
                            <button onclick="downloadDocument(${doc.id})" 
                                    class="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                                <i class="fas fa-download"></i>
                            </button>
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

async function downloadDocument(id) {
    window.open(`${API_BASE}/documents/${id}/download`, '_blank');
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
