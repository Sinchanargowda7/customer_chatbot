import os
import smtplib
from email.mime.text import MIMEText
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import models
from database import engine, get_db

# Load variables from .env file (passwords, API keys)
load_dotenv()

# Create Database Tables automatically if they don't exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Customer Support API")

# --- CORS SETUP ---
# This allows the frontend (running on localhost:5173) to talk to this backend (localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- EMAIL FUNCTION ---
# Sends an actual email using SMTP (Gmail, etc.)
def send_email_alert(to_email, subject, body):
    sender = os.getenv("MAIL_FROM")
    password = os.getenv("MAIL_PASSWORD")
    smtp_server = os.getenv("MAIL_SERVER")
    smtp_port = int(os.getenv("MAIL_PORT", 587))

    # Safety check: If config is missing, just print to console instead of crashing
    if not sender or not password:
        print(f"⚠️  Email not configured. Skipping alert to {to_email}")
        print(f"   -> Content: {body}")
        return

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = to_email

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls() # Encrypt the connection
            server.login(sender, password)
            server.sendmail(sender, to_email, msg.as_string())
            print(f"✅ EMAIL SENT to {to_email}")
    except Exception as e:
        print(f"❌ FAILED to send email: {e}")

# --- DATABASE INIT ---
# Creates a Demo Client so you can test the app immediately
def init_db():
    db = next(get_db())
    if not db.query(models.Client).filter_by(api_key="DEMO_KEY").first():
        db.add(models.Client(
            api_key="DEMO_KEY", name="Demo Corp",
            email_sales="sales@demo.com", 
            email_support="support@demo.com", 
            email_billing="billing@demo.com"
        ))
        db.commit()
init_db()

# --- KEYWORD CONFIGURATION ---
# Words that trigger automatic routing
KEYWORDS = {
    "SALES": ['buy', 'price', 'cost', 'upgrade', 'demo', 'purchase'],
    "SUPPORT": ['error', 'bug', 'crash', 'help', 'login', 'reset', 'broken'],
    "BILLING": ['refund', 'invoice', 'charge', 'payment', 'cancel', 'money']
}

# Words that reset the chat back to the main menu
EXIT_KEYWORDS = ['menu', 'main menu', 'back', 'start over', 'reset', 'exit', 'home']

# Initial questions the bot asks when entering a department
CANNED_RESPONSES = {
    "SALES": "I've connected you to Sales. To get started, please tell me **which product** you are interested in?",
    "SUPPORT": "I've opened a ticket with Tech Support. Please describe the **error message** you are seeing.",
    "BILLING": "I've connected you to Billing. For refunds, please provide your **Order ID** and **reason**.",
    "GENERAL": "I'm not sure where to send that. Is this about Sales, Support, or Billing?"
}

# --- DATA MODELS ---
# Defines the shape of data we expect from the Frontend
class ChatRequest(BaseModel):
    text: str
    session_id: str
    current_dept: str = "GENERAL"

# --- LOGIC FUNCTIONS ---

# Scans text to find if it matches any department keywords
def detect_department(text):
    text = text.lower()
    for dept, words in KEYWORDS.items():
        if any(w in text for w in words): return dept
    return None

# Validates the API Key against the database
async def verify_key(x_api_key: str = Header(...), db: Session = Depends(get_db)):
    client = db.query(models.Client).filter_by(api_key=x_api_key).first()
    if not client: raise HTTPException(403, "Invalid Key")
    return client

# --- API ENDPOINTS ---

@app.get("/")
def check_health():
    return {"status": "Online"}

@app.post("/api/chat/process")
def process_chat(req: ChatRequest, client: models.Client = Depends(verify_key), db: Session = Depends(get_db)):
    # 1. Log the User's Message to Database
    db.add(models.ChatLog(session_id=req.session_id, sender="user", message=req.text, department=req.current_dept))
    
    response_dept = req.current_dept
    response_msg = ""
    action = "stay"

    # 2. CHECK FOR EXIT COMMANDS ("reset", "menu")
    if req.text.lower().strip() in EXIT_KEYWORDS:
        response_dept = "GENERAL"
        response_msg = "You have returned to the main menu. How can I help you?"
        action = "transfer" # Tell Frontend to reset UI
        
        # Log the reset event
        db.add(models.ChatLog(session_id=req.session_id, sender="system", message="User requested reset to menu", department="GENERAL"))
        db.add(models.ChatLog(session_id=req.session_id, sender="bot", message=response_msg, department="GENERAL"))
        db.commit()
        return {"department": response_dept, "bot_message": response_msg, "action": action}

    # 3. SCENARIO A: User is in GENERAL (Needs routing)
    if req.current_dept == "GENERAL":
        detected = detect_department(req.text)
        
        if detected:
            # Match Found! Transfer to new department
            response_dept = detected
            response_msg = CANNED_RESPONSES[detected]
            action = "transfer"
            
            # Alert the new department via Email
            dept_email = getattr(client, f'email_{detected.lower()}')
            send_email_alert(
                to_email=dept_email,
                subject=f"New Chat Started: {req.session_id}",
                body=f"User has entered the {detected} queue.\nInitial Query: {req.text}"
            )
        else:
            # No Match: Ask for clarification
            response_msg = CANNED_RESPONSES["GENERAL"]
            
    # 4. SCENARIO B: User is ALREADY in a department (Sending details)
    else:
        # Find who to email based on current department
        dept_email = getattr(client, f'email_{req.current_dept.lower()}', 'admin@demo.com')
        
        # Send user's details to that agent
        send_email_alert(
            to_email=dept_email,
            subject=f"Update on Chat: {req.session_id}",
            body=f"User Provided Details:\n{req.text}"
        )
        
        response_msg = "Thanks! I've updated your ticket with those details. Type 'menu' to start over or provide more info."
        action = "stay"

    # 5. Log Bot Response to Database
    db.add(models.ChatLog(session_id=req.session_id, sender="bot", message=response_msg, department=response_dept))
    db.commit()

    return {"department": response_dept, "bot_message": response_msg, "action": action}

@app.post("/api/chat/transfer")
def manual_transfer(target_dept: str, session_id: str, client: models.Client = Depends(verify_key), db: Session = Depends(get_db)):
    # Handles manual button clicks (e.g., User clicks "Sales")
    response_msg = CANNED_RESPONSES.get(target_dept, "How can we help?")
    
    db.add(models.ChatLog(session_id=session_id, sender="system", message=f"Manual transfer to {target_dept}", department=target_dept))
    db.add(models.ChatLog(session_id=session_id, sender="bot", message=response_msg, department=target_dept))
    db.commit()
    
    return {"status": "ok"}