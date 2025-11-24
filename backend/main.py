import os
import json
import smtplib
import bcrypt
import requests
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from jose import JWTError, jwt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, FileSystemLoader
from openai import AsyncOpenAI
from bs4 import BeautifulSoup
from pypdf import PdfReader
from io import BytesIO

import models
from database import engine, get_db

# --- CONFIGURATION ---
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey123") 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Create DB Tables
models.Base.metadata.create_all(bind=engine)

# Security & AI Setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
template_env = Environment(loader=FileSystemLoader('templates'))

app = FastAPI(title="AI Chatbot System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTH UTILS ---
def get_password_hash(password):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password, hashed_password):
    plain_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_bytes, hashed_bytes)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise HTTPException(status_code=401)
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = db.query(models.User).filter_by(username=username).first()
    if user is None: raise HTTPException(status_code=401)
    return user

# --- DATA MODELS ---
class UserRegister(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"

class DepartmentCreate(BaseModel):
    name: str
    keywords: str
    canned_response: str
    knowledge_base: str = ""
    email_recipient: str

class ScrapeRequest(BaseModel):
    urls: List[str]

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

# --- HELPER FUNCTIONS ---
def scrape_website_text(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        for script in soup(["script", "style", "nav", "footer"]):
            script.decompose()
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        return f"--- Source: {url} ---\n{text[:5000]}\n\n"
    except Exception as e:
        return f"Error scraping {url}: {str(e)}\n"

def extract_pdf_text(file_content, filename):
    try:
        reader = PdfReader(BytesIO(file_content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return f"--- Source: {filename} ---\n{text[:5000]}\n\n"
    except Exception as e:
        return f"Error parsing PDF {filename}: {str(e)}\n"

def send_email_alert(to_email, subject, context):
    sender = os.getenv("MAIL_FROM")
    password = os.getenv("MAIL_PASSWORD")
    if not sender or not password: return 

    try:
        template = template_env.get_template('email_alert.html')
        if 'timestamp' not in context:
            context['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        html_body = template.render(**context)
        msg = MIMEMultipart("alternative")
        msg['Subject'] = subject
        msg['From'] = sender
        msg['To'] = to_email
        msg.attach(MIMEText(str(context), "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(os.getenv("MAIL_SERVER", "smtp.gmail.com"), int(os.getenv("MAIL_PORT", 587))) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, to_email, msg.as_string())
            print(f"✅ Alert sent to {to_email}")
    except Exception as e:
        print(f"❌ Email Error: {e}")

# --- AI LOGIC ---
async def get_ai_response(user_text, department, db):
    if not department: return "I'm not sure which department can help. Can you clarify?"
    system_prompt = f"""
    You are a helpful assistant for the {department.name} department.
    Here is your Knowledge Base (Facts you know):
    {department.knowledge_base}
    Instructions:
    1. Answer the user's question based ONLY on the Knowledge Base above.
    2. If the answer is not in the Knowledge Base, say: "{department.canned_response}"
    3. Be professional and concise.
    """
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text}
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"AI Error: {e}")
        return "I am having trouble connecting to my brain right now."

async def detect_department_ai(text, db):
    depts = db.query(models.Department).all()
    if not depts: return None
    dept_list = "\n".join([f"- {d.name}: {d.keywords}" for d in depts])
    prompt = f"""
    Classify the user input into one of these departments:
    {dept_list}
    Return ONLY the exact Department Name. If unsure, return 'GENERAL'.
    User Input: {text}
    """
    try:
        res = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo", messages=[{"role": "user", "content": prompt}], temperature=0
        )
        dept_name = res.choices[0].message.content.strip().upper()
        return next((d for d in depts if d.name.upper() == dept_name), None)
    except:
        return None

# --- AUTH ENDPOINTS ---
@app.post("/api/auth/register")
def register(user: UserRegister, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(username=user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    role = "admin" if db.query(models.User).count() == 0 else "user"
    new_user = models.User(username=user.username, password_hash=get_password_hash(user.password), role=role)
    db.add(new_user)
    db.commit()
    return {"msg": "User created successfully"}

@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(username=form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "username": user.username}

# --- ADMIN: USER MANAGEMENT ---
@app.get("/api/users")
def get_users(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    return db.query(models.User).all()

@app.post("/api/users")
def create_user(new_user: UserCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    if db.query(models.User).filter_by(username=new_user.username).first():
        raise HTTPException(400, "Username taken")
    db_user = models.User(
        username=new_user.username,
        password_hash=get_password_hash(new_user.password),
        role=new_user.role
    )
    db.add(db_user)
    db.commit()
    return {"status": "created"}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    db.query(models.User).filter_by(id=user_id).delete()
    db.commit()
    return {"status": "deleted"}

# --- ADMIN: TICKET LOGS ---
@app.get("/api/tickets")
def get_tickets(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    return db.query(models.ChatLog).order_by(models.ChatLog.timestamp.desc()).limit(50).all()

# --- TRAINING TOOLS ---
@app.post("/api/tools/scrape")
def scrape_urls(req: ScrapeRequest, user: models.User = Depends(get_current_user)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    
    results = []
    for url in req.urls:
        if url.strip():
            text = scrape_website_text(url.strip())
            results.append({"source": url, "text": text})
            
    return {"results": results}

@app.post("/api/tools/upload")
async def upload_files(files: List[UploadFile] = File(...), user: models.User = Depends(get_current_user)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    
    results = []
    for file in files:
        content = await file.read()
        if file.content_type == "application/pdf":
            text = extract_pdf_text(content, file.filename)
        else:
            text = content.decode("utf-8", errors="ignore")
            text = f"--- Source: {file.filename} ---\n{text[:5000]}\n\n"
        results.append({"source": file.filename, "text": text})
            
    return {"results": results}

# --- DEPARTMENTS API ---
@app.get("/api/departments")
def get_departments(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    return db.query(models.Department).all()

@app.post("/api/departments")
def add_department(dept: DepartmentCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    new_dept = models.Department(**dept.dict(), owner_id=user.id)
    db.add(new_dept)
    db.commit()
    return {"status": "ok"}

@app.put("/api/departments/{dept_id}")
def update_department(dept_id: int, dept: DepartmentCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    db_dept = db.query(models.Department).filter_by(id=dept_id).first()
    if not db_dept: raise HTTPException(404, detail="Department not found")
    
    db_dept.name = dept.name
    db_dept.keywords = dept.keywords
    db_dept.canned_response = dept.canned_response
    db_dept.knowledge_base = dept.knowledge_base
    db_dept.email_recipient = dept.email_recipient
    
    db.commit()
    return {"status": "updated"}

@app.delete("/api/departments/{dept_id}")
def delete_department(dept_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin": raise HTTPException(403, "Admins only")
    db.query(models.Department).filter_by(id=dept_id).delete()
    db.commit()
    return {"status": "deleted"}

# --- WEBSOCKET CHAT ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)
manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    try:
        while True:
            data_json = await websocket.receive_text()
            data = json.loads(data_json)
            user_text = data.get("text")
            current_dept_name = data.get("current_dept", "GENERAL")

            db.add(models.ChatLog(session_id=client_id, sender="user", message=user_text, department=current_dept_name))
            db.commit()

            response_dept = current_dept_name
            response_msg = ""
            action = "stay"

            if user_text.lower().strip() in ['menu', 'exit', 'reset']:
                response_dept = "GENERAL"
                response_msg = "Returned to main menu."
                action = "transfer"
            
            elif current_dept_name == "GENERAL":
                detected_dept = await detect_department_ai(user_text, db)
                if detected_dept:
                    response_dept = detected_dept.name
                    response_msg = await get_ai_response(user_text, detected_dept, db)
                    action = "transfer"
                    send_email_alert(detected_dept.email_recipient, f"New Chat: {client_id}", 
                                     {"session_id": client_id, "department": response_dept, "user_message": user_text})
                else:
                    response_msg = "I'm not sure where to route that. Can you provide more details?"
            else:
                curr_dept = db.query(models.Department).filter_by(name=current_dept_name).first()
                response_msg = await get_ai_response(user_text, curr_dept, db)
                if curr_dept:
                    pass 

            db.add(models.ChatLog(session_id=client_id, sender="bot", message=response_msg, department=response_dept))
            db.commit()

            await manager.send_message({
                "department": response_dept, "bot_message": response_msg, "action": action
            }, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)