(function() {
  // 1. Read Configuration
  const config = window.ChatbotConfig || {};
  if (!config.apiKey) {
    console.error("Chatbot Widget: No API Key provided.");
    return;
  }

  // 2. Auto-detect the URL where this script is hosted
  // If script is at http://localhost:5173/widget.js, the app is at http://localhost:5173
  const scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"]');
  const scriptUrl = new URL(scriptTag.src);
  const WIDGET_URL = scriptUrl.origin; 

  // 3. Create Container
  const container = document.createElement('div');
  container.id = "chatbot-widget-container";
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '2147483647'; 
  container.style.width = '60px';
  container.style.height = '60px';
  container.style.transition = 'all 0.3s ease';
  container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  container.style.borderRadius = '30px'; 

  // 4. Create Iframe
  const iframe = document.createElement('iframe');
  iframe.src = `${WIDGET_URL}?apiKey=${config.apiKey}&theme=${encodeURIComponent(config.themeColor || '#2563EB')}`;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = 'inherit'; 
  iframe.allow = "clipboard-write"; 

  // 5. Handle Messages
  window.addEventListener('message', (event) => {
    if (event.origin !== WIDGET_URL) return; // Security check
    
    if (event.data === 'chatbot-open') {
      container.style.width = '380px';
      container.style.height = '600px';
      container.style.borderRadius = '16px';
      container.style.maxHeight = '80vh';
    } else if (event.data === 'chatbot-close') {
      container.style.width = '60px';
      container.style.height = '60px';
      container.style.borderRadius = '30px';
    }
  });

  // 6. Inject
  container.appendChild(iframe);
  document.body.appendChild(container);
})();