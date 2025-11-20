import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, MessageSquare, Headphones, CreditCard, ShoppingBag, HelpCircle, X, ChevronDown, ArrowLeft } from 'lucide-react';

// --- CONFIGURATION ---
const API_URL = "http://localhost:8000/api"; 

// This gets the 'apiKey' query parameter from the URL (e.g. ?apiKey=123).
// This allows the chatbot to know which client/website it is running on.
// If no key is found, it defaults to "DEMO_KEY".
const queryParams = new URLSearchParams(window.location.search);
const API_KEY = queryParams.get('apiKey') || "DEMO_KEY";

// --- DEPARTMENT DEFINITIONS ---
// This object holds the configuration for each department, including its ID, display name, color, and icon.
// We use this to easily change the UI theme based on the active department.
const DEPTS = {
  INITIAL: { id: 'INITIAL', name: 'Chat Assistant', color: 'bg-gray-500', icon: MessageSquare },
  SALES: { id: 'SALES', name: 'Sales', color: 'bg-blue-600', icon: ShoppingBag },
  SUPPORT: { id: 'SUPPORT', name: 'Support', color: 'bg-purple-600', icon: Headphones },
  BILLING: { id: 'BILLING', name: 'Billing', color: 'bg-green-600', icon: CreditCard },
  GENERAL: { id: 'GENERAL', name: 'General / Others', color: 'bg-indigo-500', icon: HelpCircle },
};

export default function App() {
  // --- STATE VARIABLES ---
  // 'isOpen': Controls whether the chat window is visible or minimized to a button.
  const [isOpen, setIsOpen] = useState(false);
  
  // 'messages': An array that stores the history of chat messages ({ text, sender }).
  const [messages, setMessages] = useState([]);
  
  // 'input': Stores the text currently being typed in the input field.
  const [input, setInput] = useState('');
  
  // 'dept': Tracks the currently active department. Starts with the 'INITIAL' (Welcome) state.
  const [dept, setDept] = useState(DEPTS.INITIAL);
  
  // 'hasStarted': A flag to ensure the initial welcome message ("Hi! I am your AI Assistant...") is only sent once.
  const [hasStarted, setHasStarted] = useState(false);
  
  // 'sessionId': A random ID generated when the component mounts to uniquely identify this chat session.
  const [sessionId] = useState(`sess_${Math.random().toString(36).substr(2, 9)}`);
  
  // 'bottomRef': A reference to the bottom of the chat log, used for auto-scrolling.
  const bottomRef = useRef(null);

  // --- EFFECTS ---

  // Effect to notify the parent window (if the chatbot is embedded in an iframe) when it opens or closes.
  // This allows the host site to resize the iframe appropriately.
  useEffect(() => {
    if (window.parent) {
      window.parent.postMessage(isOpen ? 'chatbot-open' : 'chatbot-close', '*');
    }
  }, [isOpen]);

  // Effect to auto-scroll to the bottom of the message list whenever new messages are added or the chat is opened.
  useEffect(() => { 
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, isOpen]);

  // Effect to send the initial welcome message when the chat is first opened.
  useEffect(() => {
    if (isOpen && !hasStarted) {
      setHasStarted(true);
      setTimeout(() => {
        addMsg("Hi! I am your AI Assistant. How can I help you today?", 'bot');
      }, 500); // Small delay for a more natural feel
    }
  }, [isOpen, hasStarted]);


  // --- HELPER FUNCTIONS ---

  // Helper function to add a message to the 'messages' state array.
  const addMsg = (text, sender) => setMessages(prev => [...prev, { text, sender }]);

  // --- MAIN HANDLER: SENDING MESSAGES ---
  const handleSend = async (e) => {
    e.preventDefault(); // Prevent the form from refreshing the page
    if (!input.trim()) return; // Don't send empty messages
    
    const userText = input;
    setInput(''); // Clear the input field
    addMsg(userText, 'user'); // Display the user's message immediately
    
    // Logic: If the user sends a message while in the 'INITIAL' menu (without clicking a button),
    // automatically switch the context to 'GENERAL' so the backend can process it.
    let currentDepartmentId = dept.id;
    if (currentDepartmentId === 'INITIAL') {
        setDept(DEPTS.GENERAL);
        currentDepartmentId = 'GENERAL';
    }

    try {
      // Send the message to the Python backend API
      const res = await fetch(`${API_URL}/chat/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ 
            text: userText, 
            session_id: sessionId, 
            current_dept: currentDepartmentId 
        })
      });
      
      if (!res.ok) throw new Error("Offline");
      
      const data = await res.json();
      
      // Intelligent Routing:
      // If the backend detects a keyword (e.g., "refund") and returns an action of 'transfer',
      // automatically update the UI to the new department (e.g., BILLING).
      if (data.action === 'transfer') {
          setDept(DEPTS[data.department]);
      }
      
      // Display the bot's response message
      setTimeout(() => addMsg(data.bot_message, 'bot'), 500);

    } catch (err) {
      console.log("Backend offline");
      setTimeout(() => addMsg("I'm having trouble connecting.", 'bot'), 500);
    }
  };

  // --- HANDLER: SWITCHING DEPARTMENTS ---
  const switchDept = async (key) => {
    setDept(DEPTS[key]); // Update the local state to show the new department theme
    
    // If switching to a specific department (Sales/Support/Billing), notify the backend.
    // This is important for logging and context.
    if (key !== 'INITIAL') {
        try {
          await fetch(`${API_URL}/chat/transfer?target_dept=${key}&session_id=${sessionId}`, {
              method: 'POST', headers: { 'x-api-key': API_KEY }
          });
        } catch (e) {}
        
        // Determine the welcome message based on the selected department.
        // "General" gets a routing prompt; others get a direct greeting.
        const welcomeMsg = key === 'GENERAL' 
        ? "I can help route your request. Briefly describe your issue or select a department below."
        : `Hello from ${DEPTS[key].name}! How can I help?`;

        setTimeout(() => addMsg(welcomeMsg, 'bot'), 800);
    }
  };

  // Function for the "Back Arrow" button to return to the main menu.
  const resetToMenu = () => {
    setDept(DEPTS.INITIAL); 
  };

  // --- RENDER (The HTML) ---
  return (
    <div className="fixed bottom-5 right-5 font-sans z-50 flex flex-col items-end">
      
      {/* Chat Window Container (Only visible if isOpen is true) */}
      {isOpen && (
        <div className="bg-white w-[350px] h-[450px] rounded-lg shadow-2xl flex flex-col border border-gray-200 mb-4 overflow-hidden animate-in slide-in-from-bottom-5">
          
          {/* Header Section: Displays department name, color, and back/close buttons */}
          <div className={`${dept.color} p-4 text-white flex justify-between items-center`}>
            <div className="flex items-center gap-2">
              {/* Show 'Back Arrow' if inside a specific department, otherwise show default Icon */}
              {dept.id !== 'INITIAL' ? (
                <button onClick={resetToMenu} className="hover:bg-white/20 p-1 rounded mr-1" title="Back to Menu">
                  <ArrowLeft size={20} />
                </button>
              ) : (
                <dept.icon size={20} />
              )}
              <span className="font-bold">{dept.name}</span>
            </div>
            
            {/* Close Button (Minimizes the chat) */}
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Messages Area: The scrollable list of chat bubbles */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((m, i) => {
              const isUser = m.sender === 'user';
              return (
                <div key={i} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2 items-end`}>
                    
                    {/* Profile Avatar: Shows user or bot icon next to the message */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-sm ${isUser ? 'bg-indigo-600' : dept.color}`}>
                      {isUser ? <User size={16} /> : <Bot size={16} />}
                    </div>

                    {/* Chat Bubble: Contains the message text */}
                    <div className={`px-4 py-2 text-sm shadow-sm rounded-2xl leading-relaxed ${
                      isUser 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Department Selection Buttons: Only visible in 'INITIAL' menu or 'GENERAL' chat */}
            {(dept.id === 'INITIAL' || dept.id === 'GENERAL') && (
              <div className="grid grid-cols-1 gap-2 mt-4 pl-10"> 
                <p className="text-xs text-gray-400 mb-1 ml-1">Select a department:</p>
                {Object.entries(DEPTS).filter(([k]) => k !== 'INITIAL').map(([k, d]) => (
                  <button key={k} onClick={() => switchDept(k)} className={`p-3 border bg-white rounded-xl hover:bg-slate-50 text-left text-sm flex items-center gap-3 text-slate-700 transition-all shadow-sm hover:shadow ${k === dept.id ? 'ring-2 ring-indigo-100 bg-indigo-50' : ''}`}>
                    <div className={`p-1.5 rounded-lg ${d.color.replace('bg-', 'text-').replace('600', '500')} bg-opacity-10`}>
                        <d.icon size={16} />
                    </div>
                    <span className="font-medium">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Invisible div to scroll to */}
            <div ref={bottomRef} />
          </div>

          {/* Input Form: Always visible at the bottom */}
          <form onSubmit={handleSend} className="p-3 border-t flex gap-2 bg-white items-center">
            <input 
            className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 ring-indigo-100 transition-all"
            placeholder="Type your question here..."
            value={input} onChange={e => setInput(e.target.value)}
            />
            <button type="submit" className={`p-2 rounded-full text-white transition-transform active:scale-95 ${dept.color} hover:opacity-90 shadow-md`}>
                <Send size={18}/>
            </button>
          </form>

        </div>
      )}

      {/* Launcher Button: The floating circle to open the chat */}
      <button onClick={() => setIsOpen(!isOpen)} className="h-14 w-14 bg-blue-600 rounded-full text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
        {isOpen ? <X /> : <MessageSquare />}
      </button>
    </div>
  );
}