from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    api_key = Column(String, unique=True, index=True)
    name = Column(String)
    
    # Where emails go for this specific client
    email_sales = Column(String)
    email_support = Column(String)
    email_billing = Column(String)

class ChatLog(Base):
    __tablename__ = "chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    sender = Column(String) # 'user' or 'bot'
    message = Column(Text)
    department = Column(String) # Which dept handled this
    timestamp = Column(DateTime, default=datetime.utcnow)