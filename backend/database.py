from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Renamed database file to be generic
SQLALCHEMY_DATABASE_URL = "sqlite:///./chatbot.db"

# If you want to use PostgreSQL later, you just change the line above to:
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/dbname"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Helper to get database session in API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()