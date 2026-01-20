"""
Authentication service for user login, token management, and password handling.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.repositories.user import user_repository


# JWT settings
ALGORITHM = "HS256"


class AuthenticationService:
    """Service for handling user authentication operations."""
    
    def __init__(self):
        self.user_repo = user_repository
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify a plain password against a hashed password.
        
        Args:
            plain_password: The plain text password
            hashed_password: The hashed password to verify against
            
        Returns:
            True if password matches, False otherwise
        """
        # Encode password as bytes for bcrypt
        if isinstance(plain_password, str):
            plain_password = plain_password.encode('utf-8')
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_password, hashed_password)
    
    def hash_password(self, password: str) -> str:
        """
        Hash a plain password.
        
        Args:
            password: The plain text password to hash
            
        Returns:
            The hashed password
        """
        # Encode password as bytes for bcrypt
        if isinstance(password, str):
            password = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password, salt)
        return hashed.decode('utf-8')
    
    def authenticate_user(
        self,
        db: Session,
        username: str,
        password: str
    ) -> Optional[User]:
        """
        Authenticate a user by username and password.
        
        Args:
            db: Database session
            username: Username to authenticate
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        user = self.user_repo.get_by_username(db, username)
        if not user:
            return None
        if not user.is_active:
            return None
        if not self.verify_password(password, user.password_hash):
            return None
        return user
    
    def create_access_token(
        self,
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT access token.
        
        Args:
            data: Data to encode in the token
            expires_delta: Optional expiration time delta
            
        Returns:
            Encoded JWT token
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=ALGORITHM
        )
        return encoded_jwt
    
    def create_refresh_token(
        self,
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT refresh token with longer expiration.
        
        Args:
            data: Data to encode in the token
            expires_delta: Optional expiration time delta
            
        Returns:
            Encoded JWT refresh token
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            # Refresh tokens last 30 days by default
            expire = datetime.utcnow() + timedelta(days=30)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=ALGORITHM
        )
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode and verify a JWT token.
        
        Args:
            token: JWT token to decode
            
        Returns:
            Decoded token payload if valid, None otherwise
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[ALGORITHM]
            )
            return payload
        except JWTError:
            return None
    
    def get_user_from_token(
        self,
        db: Session,
        token: str
    ) -> Optional[User]:
        """
        Get user from a JWT token.
        
        Args:
            db: Database session
            token: JWT token
            
        Returns:
            User object if token is valid, None otherwise
        """
        payload = self.decode_token(token)
        if payload is None:
            return None
        
        user_id_str = payload.get("sub")
        if user_id_str is None:
            return None
        
        try:
            user_id = UUID(user_id_str)
        except (ValueError, AttributeError):
            return None
        
        user = self.user_repo.get(db, user_id)
        if user is None or not user.is_active:
            return None
        
        return user
    
    def login(
        self,
        db: Session,
        username: str,
        password: str
    ) -> Optional[Dict[str, str]]:
        """
        Login a user and return access and refresh tokens.
        
        Args:
            db: Database session
            username: Username
            password: Plain text password
            
        Returns:
            Dictionary with access_token and refresh_token if successful, None otherwise
        """
        user = self.authenticate_user(db, username, password)
        if not user:
            return None
        
        access_token = self.create_access_token(
            data={"sub": str(user.id), "username": user.username}
        )
        refresh_token = self.create_refresh_token(
            data={"sub": str(user.id), "username": user.username}
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    
    def refresh_access_token(
        self,
        db: Session,
        refresh_token: str
    ) -> Optional[Dict[str, str]]:
        """
        Refresh an access token using a refresh token.
        
        Args:
            db: Database session
            refresh_token: Refresh token
            
        Returns:
            Dictionary with new access_token if successful, None otherwise
        """
        payload = self.decode_token(refresh_token)
        if payload is None:
            return None
        
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            return None
        
        user_id_str = payload.get("sub")
        if user_id_str is None:
            return None
        
        try:
            user_id = UUID(user_id_str)
        except (ValueError, AttributeError):
            return None
        
        user = self.user_repo.get(db, user_id)
        if user is None or not user.is_active:
            return None
        
        # Create new access token
        access_token = self.create_access_token(
            data={"sub": str(user.id), "username": user.username}
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    
    def create_user(
        self,
        db: Session,
        username: str,
        email: str,
        password: str,
        is_active: bool = True
    ) -> User:
        """
        Create a new user with hashed password.
        
        Args:
            db: Database session
            username: Username
            email: Email address
            password: Plain text password
            is_active: Whether user is active
            
        Returns:
            Created User object
        """
        password_hash = self.hash_password(password)
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            is_active=is_active
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def change_password(
        self,
        db: Session,
        user_id: UUID,
        old_password: str,
        new_password: str
    ) -> bool:
        """
        Change a user's password.
        
        Args:
            db: Database session
            user_id: User ID
            old_password: Current password
            new_password: New password
            
        Returns:
            True if password changed successfully, False otherwise
        """
        user = self.user_repo.get(db, user_id)
        if not user:
            return False
        
        if not self.verify_password(old_password, user.password_hash):
            return False
        
        user.password_hash = self.hash_password(new_password)
        db.commit()
        return True
    
    def reset_password(
        self,
        db: Session,
        user_id: UUID,
        new_password: str
    ) -> bool:
        """
        Reset a user's password (admin function).
        
        Args:
            db: Database session
            user_id: User ID
            new_password: New password
            
        Returns:
            True if password reset successfully, False otherwise
        """
        user = self.user_repo.get(db, user_id)
        if not user:
            return False
        
        user.password_hash = self.hash_password(new_password)
        db.commit()
        return True


# Create service instance
authentication_service = AuthenticationService()
