from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="user") # 'admin' or 'user'
    
    # Relationship to Departments
    departments = relationship("Department", back_populates="owner")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)          
    keywords = Column(String)      
    canned_response = Column(Text) 
    knowledge_base = Column(Text, default="") # The "Brain" of the department
    email_recipient = Column(String) 
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="departments")

class ChatLog(Base):
    __tablename__ = "chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    sender = Column(String) 
    message = Column(Text)
    department = Column(String) 
    timestamp = Column(DateTime, default=datetime.utcnow)