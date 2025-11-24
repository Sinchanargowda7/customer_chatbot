import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Send, User, Bot, MessageSquare, Trash2, Plus, Save, LogOut, Lock, ShoppingBag, Globe, Upload, FileText, Users, LayoutGrid, MessageCircle, Check, X, Edit2, Eye, ArrowDownCircle, Mail, Key } from 'lucide-react';

const API_URL = "http://localhost:8000/api"; 

// --- AUTH HELPERS ---
const setToken = (token, role) => {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
};
const getToken = () => localStorage.getItem('token');
const getRole = () => localStorage.getItem('role');
const logout = () => { localStorage.clear(); window.location.href = '/login'; };

// ===========================
// 1. REGISTER COMPONENT
// ===========================
function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password })
    });
    if (res.ok) { alert("Registration Successful!"); navigate('/login'); } 
    else { alert("Registration Failed."); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleRegister} className="bg-white p-8 rounded-lg shadow-lg w-96 border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Create Account</h2>
        <input className="w-full p-2 border rounded mb-3" placeholder="Username" onChange={e=>setUsername(e.target.value)} required />
        <input className="w-full p-2 border rounded mb-6" type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} required />
        <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-bold transition">Register</button>
        <p className="text-center mt-4 text-sm text-gray-600 cursor-pointer hover:underline" onClick={()=>navigate('/login')}>Already have an account? Login</p>
      </form>
    </div>
  );
}

// ===========================
// 2. LOGIN COMPONENT
// ===========================
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      setToken(data.access_token, data.role);
      if (data.role === 'admin') navigate('/admin');
      else navigate('/');
    } else { alert("Invalid Credentials"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-lg w-96 border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">Welcome Back</h2>
        <input className="w-full p-2 border rounded mb-3" placeholder="Username" onChange={e=>setUsername(e.target.value)} required />
        <input className="w-full p-2 border rounded mb-6" type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} required />
        <button className="w-full bg-slate-800 text-white p-2 rounded hover:bg-slate-900 font-bold transition">Login</button>
        <p className="text-center mt-4 text-sm text-gray-600 cursor-pointer hover:underline" onClick={()=>navigate('/register')}>New here? Register</p>
      </form>
    </div>
  );
}

// ===========================
// 3. ADMIN DASHBOARD Wrapper
// ===========================
function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('departments');
  const navigate = useNavigate();

  useEffect(() => {
    if (getRole() !== 'admin') navigate('/'); 
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white p-6 flex flex-col">
        <h1 className="text-2xl font-bold mb-8 flex items-center gap-2"><Bot className="text-blue-400"/> Admin</h1>
        
        <nav className="flex-1 space-y-2">
            <button onClick={()=>setActiveTab('departments')} className={`w-full text-left p-3 rounded flex items-center gap-3 ${activeTab==='departments' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <LayoutGrid size={20}/> Departments
            </button>
            <button onClick={()=>setActiveTab('users')} className={`w-full text-left p-3 rounded flex items-center gap-3 ${activeTab==='users' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <Users size={20}/> User Management
            </button>
            <button onClick={()=>setActiveTab('tickets')} className={`w-full text-left p-3 rounded flex items-center gap-3 ${activeTab==='tickets' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <MessageCircle size={20}/> Ticket Logs
            </button>
        </nav>

        <button onClick={logout} className="flex items-center gap-2 text-red-400 hover:text-red-300 mt-auto">
            <LogOut size={18}/> Logout
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-8 overflow-y-auto h-screen relative">
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'tickets' && <TicketsTab />}
      </div>
    </div>
  );
}

// --- TAB 1: DEPARTMENTS (Updated UI) ---
function DepartmentsTab() {
    const [depts, setDepts] = useState([]);
    const [form, setForm] = useState({ id: null, name: '', keywords: '', canned_response: '', knowledge_base: '', email_recipient: '' });
    const [loading, setLoading] = useState(false);
    const [scrapeUrls, setScrapeUrls] = useState('');
    const [stagedItems, setStagedItems] = useState([]); 
    const [viewDept, setViewDept] = useState(null); // State for viewing details modal

    useEffect(() => { fetchDepts(); }, []);

    const fetchDepts = async () => {
        const res = await fetch(`${API_URL}/departments`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        if (res.ok) setDepts(await res.json());
    };

    const handleSave = async () => {
        const method = form.id ? 'PUT' : 'POST';
        const url = form.id ? `${API_URL}/departments/${form.id}` : `${API_URL}/departments`;
        
        await fetch(url, {
            method: method, 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(form)
        });
        
        setForm({ id: null, name: '', keywords: '', canned_response: '', knowledge_base: '', email_recipient: '' });
        setStagedItems([]);
        fetchDepts();
    };

    const handleEdit = (dept) => {
        setForm(dept);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Helper to extract sources from KB text
    const getSourcesList = (text) => {
        if (!text) return [];
        const regex = /--- Source: (.*?) ---/g;
        const matches = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    };

    const handleScrape = async () => {
        if(!scrapeUrls) return;
        setLoading(true);
        try {
            const urlList = scrapeUrls.split(/[\n,]+/).map(u => u.trim()).filter(u => u);
            const res = await fetch(`${API_URL}/tools/scrape`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ urls: urlList })
            });
            const data = await res.json();
            const newItems = data.results.map(r => ({ type: 'web', source: r.source, text: r.text }));
            setStagedItems(prev => [...prev, ...newItems]);
            setScrapeUrls('');
        } catch (e) { alert("Scrape failed"); }
        setLoading(false);
    };

    const handleUpload = async (e) => {
        const files = e.target.files;
        if(!files || files.length === 0) return;
        setLoading(true);
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        try {
            const res = await fetch(`${API_URL}/tools/upload`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            });
            const data = await res.json();
            const newItems = data.results.map(r => ({ type: 'file', source: r.source, text: r.text }));
            setStagedItems(prev => [...prev, ...newItems]);
        } catch (e) { alert("Upload failed"); }
        setLoading(false);
    };

    const appendStagedToKB = () => {
        const allText = stagedItems.map(item => item.text).join("\n\n");
        setForm(prev => ({ 
            ...prev, 
            knowledge_base: (prev.knowledge_base ? prev.knowledge_base + "\n\n" : "") + allText 
        }));
        setStagedItems([]);
    };

    const removeStagedItem = (index) => {
        setStagedItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleDelete = async (id) => {
        if(confirm("Delete?")) {
            await fetch(`${API_URL}/departments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
            fetchDepts();
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
            
            {/* VIEW DETAILS MODAL */}
            {viewDept && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="bg-slate-50 border-b p-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">{viewDept.name} Department</h2>
                                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded mt-1 inline-block">ID: {viewDept.id}</span>
                            </div>
                            <button onClick={()=>setViewDept(null)} className="bg-white p-2 rounded-full shadow hover:bg-slate-100 transition"><X size={20}/></button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                            
                            {/* Contact Info */}
                            <div className="flex items-start gap-3">
                                <div className="bg-blue-100 p-2 rounded text-blue-600"><Mail size={20}/></div>
                                <div>
                                    <h4 className="font-bold text-sm text-gray-500 uppercase">Alert Email</h4>
                                    <p className="text-slate-800 text-lg">{viewDept.email_recipient}</p>
                                </div>
                            </div>

                            {/* Keywords */}
                            <div className="flex items-start gap-3">
                                <div className="bg-green-100 p-2 rounded text-green-600"><Key size={20}/></div>
                                <div>
                                    <h4 className="font-bold text-sm text-gray-500 uppercase">Routing Keywords</h4>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {viewDept.keywords.split(',').map((k, i) => (
                                            <span key={i} className="bg-slate-100 border text-slate-700 px-2 py-1 rounded text-sm font-medium">{k.trim()}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Training Data Sources */}
                            <div className="border-t pt-4">
                                <h4 className="font-bold text-sm text-gray-500 uppercase mb-3 flex items-center gap-2"><FileText size={16}/> Training Data Sources</h4>
                                {getSourcesList(viewDept.knowledge_base).length > 0 ? (
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {getSourcesList(viewDept.knowledge_base).map((src, i) => (
                                            <li key={i} className="text-sm bg-slate-50 p-2 rounded border flex items-center gap-2 text-slate-700">
                                                {src.includes('http') ? <Globe size={14} className="text-blue-400"/> : <FileText size={14} className="text-amber-500"/>}
                                                <span className="truncate">{src}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm italic text-gray-400">No external documents or websites linked.</p>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 p-4 border-t flex justify-end">
                            <button onClick={()=>setViewDept(null)} className="bg-slate-800 text-white px-6 py-2 rounded hover:bg-slate-900 font-bold">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT COLUMN: DEPARTMENTS LIST */}
            <div className="lg:col-span-2 space-y-4">
                <h2 className="text-2xl font-bold mb-4 text-slate-800">Active Departments</h2>
                {depts.map(d => (
                    <div key={d.id} className="bg-white p-5 rounded shadow-sm border flex justify-between items-center group hover:shadow-md transition">
                        <div>
                            <h3 className="font-bold text-blue-600 text-lg">{d.name}</h3>
                            <p className="text-sm text-gray-600"><strong>Keywords:</strong> {d.keywords}</p>
                            <p className="text-xs text-gray-400 mt-1">KB Length: {d.knowledge_base?.length || 0} chars</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setViewDept(d)} className="p-2 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition" title="View Details"><Eye size={18}/></button>
                            <button onClick={() => handleEdit(d)} className="p-2 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition" title="Edit"><Edit2 size={18}/></button>
                            <button onClick={() => handleDelete(d.id)} className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition" title="Delete"><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
            
            {/* RIGHT COLUMN: ADD/EDIT FORM */}
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded shadow-lg border border-blue-100 h-fit sticky top-4">
                    <h3 className="font-bold mb-4 text-lg flex items-center gap-2 text-slate-800">
                        <div className="bg-blue-100 p-1.5 rounded"><Plus size={20} className="text-blue-600"/></div>
                        {form.id ? 'Edit Department' : 'Add Department'}
                    </h3>
                    
                    {form.id && (
                        <button onClick={() => setForm({ id: null, name: '', keywords: '', canned_response: '', knowledge_base: '', email_recipient: '' })} className="text-xs text-red-500 underline mb-2 block">
                            Cancel Edit
                        </button>
                    )}

                    <div className="space-y-3">
                        <input placeholder="Name (e.g. SALES)" className="w-full border p-2 rounded focus:ring-2 ring-blue-500 outline-none" 
                            value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
                        <input placeholder="Keywords (comma separated)" className="w-full border p-2 rounded focus:ring-2 ring-blue-500 outline-none" 
                            value={form.keywords} onChange={e=>setForm({...form, keywords: e.target.value})} />
                        
                        {/* TOOLS SECTION */}
                        <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Import Tools</label>
                            
                            <div className="flex gap-2 items-start">
                                <textarea placeholder="https://site1.com&#10;https://site2.com" className="flex-1 border p-2 rounded text-xs h-16 resize-none" 
                                    value={scrapeUrls} onChange={e=>setScrapeUrls(e.target.value)} />
                                <button onClick={handleScrape} disabled={loading} className="bg-white border p-2 rounded h-16 flex items-center justify-center hover:bg-blue-50 transition text-blue-600" title="Scrape">
                                    {loading ? <div className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full border-t-transparent"></div> : <Globe size={20}/>}
                                </button>
                            </div>

                            <label className="cursor-pointer bg-white border border-dashed border-gray-400 p-2 rounded text-xs text-gray-500 hover:bg-blue-50 flex items-center gap-2 justify-center transition">
                                <Upload size={14}/> {loading ? "Processing..." : "Upload Docs (PDF/TXT)"}
                                <input type="file" accept=".txt,.pdf" multiple className="hidden" onChange={handleUpload} disabled={loading}/>
                            </label>
                        </div>

                        {/* STAGING LIST */}
                        {stagedItems.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm animate-in fade-in zoom-in">
                                <p className="font-bold text-amber-800 mb-2 text-xs uppercase flex justify-between">
                                    <span>Ready to Add:</span>
                                    <span className="text-amber-600">{stagedItems.length} items</span>
                                </p>
                                <ul className="max-h-32 overflow-y-auto mb-3 space-y-1">
                                    {stagedItems.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center bg-white p-1.5 rounded border border-amber-100 text-xs text-gray-600">
                                            <div className="flex items-center gap-2 truncate">
                                                {item.type === 'web' ? <Globe size={12} className="text-blue-400"/> : <FileText size={12} className="text-red-400"/>}
                                                <span className="truncate max-w-[150px]">{item.source}</span>
                                            </div>
                                            <button onClick={() => removeStagedItem(idx)} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
                                        </li>
                                    ))}
                                </ul>
                                <button onClick={appendStagedToKB} className="w-full bg-amber-500 text-white py-1.5 rounded font-bold text-xs hover:bg-amber-600 flex items-center justify-center gap-2 shadow-sm transition">
                                    <ArrowDownCircle size={14}/> Append All to Knowledge Base
                                </button>
                            </div>
                        )}

                        <label className="text-xs font-bold text-slate-500 uppercase block mt-2">Knowledge Base</label>
                        <textarea placeholder="Content will appear here manually or via tools..." className="w-full border p-2 rounded h-40 text-sm focus:ring-2 ring-blue-500 outline-none resize-none" 
                            value={form.knowledge_base} onChange={e=>setForm({...form, knowledge_base: e.target.value})} />
                        
                        <input placeholder="Fallback Response" className="w-full border p-2 rounded focus:ring-2 ring-blue-500 outline-none" 
                            value={form.canned_response} onChange={e=>setForm({...form, canned_response: e.target.value})} />
                        <input placeholder="Alert Email" className="w-full border p-2 rounded focus:ring-2 ring-blue-500 outline-none" 
                            value={form.email_recipient} onChange={e=>setForm({...form, email_recipient: e.target.value})} />
                        
                        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-2.5 rounded font-bold hover:bg-blue-700 transition shadow-md mt-2 flex items-center justify-center gap-2">
                            <Save size={18}/> {form.id ? 'Update Department' : 'Save Department'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- TAB 2: USER MANAGEMENT ---
function UsersTab() {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        const res = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        if (res.ok) setUsers(await res.json());
    };

    const handleAddUser = async () => {
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(newUser)
        });
        if(res.ok) {
            setNewUser({ username: '', password: '', role: 'user' });
            fetchUsers();
        } else { alert("Failed to add user. Username might differ."); }
    };

    const handleDeleteUser = async (id) => {
        if(confirm("Remove user?")) {
            await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
            fetchUsers();
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-slate-800">User Management</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <table className="w-full bg-white shadow rounded overflow-hidden">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="p-3 text-left text-sm font-bold text-slate-600 uppercase">Username</th>
                                <th className="p-3 text-left text-sm font-bold text-slate-600 uppercase">Role</th>
                                <th className="p-3 text-right text-sm font-bold text-slate-600 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-t hover:bg-slate-50">
                                    <td className="p-3 text-slate-700">{u.username}</td>
                                    <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role==='admin'?'bg-purple-100 text-purple-700':'bg-green-100 text-green-700'}`}>{u.role.toUpperCase()}</span></td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><Trash2 size={18}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-white p-6 rounded shadow border h-fit">
                    <h3 className="font-bold mb-4 text-lg text-slate-800">Add New User</h3>
                    <div className="space-y-3">
                        <input placeholder="Username" className="w-full border p-2 rounded" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})} />
                        <input type="password" placeholder="Password" className="w-full border p-2 rounded" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} />
                        <select className="w-full border p-2 rounded bg-white" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}>
                            <option value="user">User (Chat Access)</option>
                            <option value="admin">Admin (Full Access)</option>
                        </select>
                        <button onClick={handleAddUser} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 transition shadow-sm">Create User</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- TAB 3: TICKET LOGS ---
function TicketsTab() {
    const [tickets, setTickets] = useState([]);

    useEffect(() => {
        const fetchTickets = async () => {
            const res = await fetch(`${API_URL}/tickets`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            if (res.ok) setTickets(await res.json());
        };
        fetchTickets();
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-slate-800">Recent Chat Logs</h2>
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="p-3 text-left text-sm font-bold text-slate-600">Time</th>
                            <th className="p-3 text-left text-sm font-bold text-slate-600">Sender</th>
                            <th className="p-3 text-left text-sm font-bold text-slate-600">Message</th>
                            <th className="p-3 text-left text-sm font-bold text-slate-600">Dept</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-400">No logs found.</td></tr>}
                        {tickets.map(t => (
                            <tr key={t.id} className="border-t hover:bg-slate-50 transition">
                                <td className="p-3 text-sm text-gray-500 whitespace-nowrap">{new Date(t.timestamp).toLocaleTimeString()}</td>
                                <td className="p-3 font-bold text-xs uppercase text-slate-700">{t.sender}</td>
                                <td className="p-3 text-sm text-slate-600">{t.message}</td>
                                <td className="p-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">{t.department}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ===========================
// 4. CHATBOT (User View)
// ===========================
function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [deptName, setDeptName] = useState("General Support");
  const bottomRef = useRef(null);
  const sessionId = useRef(`sess_${Math.random().toString(36).substr(2, 9)}`).current;
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) navigate('/login'); 

    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);
    ws.onopen = () => console.log("Connected");
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      
      if (data.department && data.action === "transfer") {
        setDeptName(data.department);
      }
      if (data.bot_message) setMessages(prev => [...prev, { text: data.bot_message, sender: 'bot' }]);
    };
    setSocket(ws);
    return () => ws.close();
  }, []);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(prev => [...prev, { text: input, sender: 'user' }]);
    if (socket) socket.send(JSON.stringify({ text: input, current_dept: deptName === "General Support" ? "GENERAL" : deptName }));
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <div className="bg-white shadow p-4 flex justify-between items-center border-b border-gray-200">
        <h1 className="font-bold text-xl text-slate-800 flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Bot size={20}/></div> 
            {deptName}
        </h1>
        <button onClick={logout} className="text-sm text-red-500 hover:bg-red-50 px-3 py-1 rounded transition">Logout</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20 animate-in fade-in zoom-in duration-500">
                <MessageSquare size={64} className="mx-auto mb-4 opacity-10"/>
                <p className="text-lg font-medium text-gray-500">How can we help you today?</p>
            </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
            <div className={`px-5 py-3 rounded-2xl max-w-[75%] shadow-sm text-sm leading-relaxed ${m.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-700 border border-gray-200 rounded-bl-none'}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-2">
        <input className="flex-1 bg-gray-100 rounded-full px-6 py-3 outline-none focus:ring-2 ring-blue-500 transition text-slate-700" 
               placeholder="Type your message..." value={input} onChange={e => setInput(e.target.value)} />
        <button className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"><Send size={20}/></button>
      </form>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={<ChatBot />} />
      </Routes>
    </BrowserRouter>
  );
}