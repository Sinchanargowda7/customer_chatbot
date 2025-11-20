from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import engine, get_db

# Create Database Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Customer Support API")

# Allow Frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Demo Data Setup ---
def init_db():
    db = next(get_db())
    if not db.query(models.Client).filter_by(api_key="DEMO_KEY").first():
        db.add(models.Client(
            api_key="DEMO_KEY", name="Demo Corp",
            email_sales="sales@demo.com", email_support="tech@demo.com", email_billing="bill@demo.com"
        ))
        db.commit()
init_db()

# --- Config ---
KEYWORDS = {
    "SALES": ['buy', 'price', 'cost', 'upgrade', 'demo'],
    "SUPPORT": ['error', 'bug', 'crash', 'help', 'login', 'reset'],
    "BILLING": ['refund', 'invoice', 'charge', 'payment', 'cancel']
}

CANNED_RESPONSES = {
    "SALES": "We have great deals today. I've notified a sales rep.",
    "SUPPORT": "Sorry to hear that. I've flagged this for tech support.",
    "BILLING": "I've sent this request to our accounts team.",
    "GENERAL": "Could you clarify if this is Sales, Support, or Billing?"
}

# --- Models & Helpers ---
class ChatRequest(BaseModel):
    text: str
    session_id: str
    current_dept: str = "GENERAL"

def detect_department(text):
    text = text.lower()
    for dept, words in KEYWORDS.items():
        if any(w in text for w in words): return dept
    return None

async def verify_key(x_api_key: str = Header(...), db: Session = Depends(get_db)):
    client = db.query(models.Client).filter_by(api_key=x_api_key).first()
    if not client: raise HTTPException(403, "Invalid Key")
    return client

# --- Endpoints ---
@app.get("/")
def check_health():
    return {"status": "Online"}

@app.post("/api/chat/process")
def process_chat(req: ChatRequest, client: models.Client = Depends(verify_key), db: Session = Depends(get_db)):
    # Log User Message
    db.add(models.ChatLog(session_id=req.session_id, sender="user", message=req.text, department=req.current_dept))
    
    response_dept = req.current_dept
    response_msg = "I'm listening..."
    action = "stay"

    if req.current_dept == "GENERAL":
        detected = detect_department(req.text)
        if detected:
            response_dept = detected
            response_msg = f"I see this is about {detected}. {CANNED_RESPONSES[detected]}"
            action = "transfer"
            print(f"📧 ALERT: Email sent to {getattr(client, f'email_{detected.lower()}')}")
        else:
            response_msg = CANNED_RESPONSES["GENERAL"]
    else:
        response_msg = "An agent will be with you shortly."

    # Log Bot Response
    db.add(models.ChatLog(session_id=req.session_id, sender="bot", message=response_msg, department=response_dept))
    db.commit()

    return {"department": response_dept, "bot_message": response_msg, "action": action}

@app.post("/api/chat/transfer")
def manual_transfer(target_dept: str, session_id: str, client: models.Client = Depends(verify_key), db: Session = Depends(get_db)):
    print(f"📧 ALERT: Manual transfer to {target_dept}")
    db.add(models.ChatLog(session_id=session_id, sender="system", message=f"Manual transfer to {target_dept}", department=target_dept))
    db.commit()
    return {"status": "ok"}