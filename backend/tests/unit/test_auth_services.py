"""
Unit tests for authentication and authorization services.
"""
import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.services.authentication import authentication_service
from app.services.authorization import authorization_service, Permission
from app.services.scope_validator import scope_validator_service
from app.services.role_management import role_management_service
from app.services.audit import audit_service
from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.base import Base
from decimal import Decimal


# Create test database engine
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def db_session():
    """Create a test database session."""
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


class TestAuthenticationService:
    """Test authentication service."""
    
    def test_hash_and_verify_password(self):
        """Test password hashing and verification."""
        password = "testpass"
        hashed = authentication_service.hash_password(password)
        
        assert hashed != password
        assert authentication_service.verify_password(password, hashed)
        assert not authentication_service.verify_password("wrongpass", hashed)
    
    def test_create_user(self, db_session):
        """Test user creation with hashed password."""
        user = authentication_service.create_user(
            db=db_session,
            username="testuser",
            email="test@example.com",
            password="password123"
        )
        
        assert user.id is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.password_hash != "password123"
        assert user.is_active is True
    
    def test_authenticate_user_success(self, db_session):
        """Test successful user authentication."""
        # Create user
        user = authentication_service.create_user(
            db=db_session,
            username="authuser",
            email="auth@example.com",
            password="password123"
        )
        
        # Authenticate
        authenticated = authentication_service.authenticate_user(
            db=db_session,
            username="authuser",
            password="password123"
        )
        
        assert authenticated is not None
        assert authenticated.id == user.id
    
    def test_authenticate_user_wrong_password(self, db_session):
        """Test authentication with wrong password."""
        # Create user
        authentication_service.create_user(
            db=db_session,
            username="authuser2",
            email="auth2@example.com",
            password="password123"
        )
        
        # Try to authenticate with wrong password
        authenticated = authentication_service.authenticate_user(
            db=db_session,
            username="authuser2",
            password="wrongpassword"
        )
        
        assert authenticated is None
    
    def test_authenticate_user_nonexistent(self, db_session):
        """Test authentication with nonexistent user."""
        authenticated = authentication_service.authenticate_user(
            db=db_session,
            username="nonexistent",
            password="password123"
        )
        
        assert authenticated is None
    
    def test_create_and_decode_token(self, db_session):
        """Test JWT token creation and decoding."""
        user = authentication_service.create_user(
            db=db_session,
            username="tokenuser",
            email="token@example.com",
            password="password123"
        )
        
        # Create token
        token = authentication_service.create_access_token(
            data={"sub": str(user.id), "username": user.username}
        )
        
        assert token is not None
        
        # Decode token
        payload = authentication_service.decode_token(token)
        
        assert payload is not None
        assert payload["sub"] == str(user.id)
        assert payload["username"] == user.username
    
    def test_login(self, db_session):
        """Test login flow."""
        # Create user
        authentication_service.create_user(
            db=db_session,
            username="loginuser",
            email="login@example.com",
            password="password123"
        )
        
        # Login
        result = authentication_service.login(
            db=db_session,
            username="loginuser",
            password="password123"
        )
        
        assert result is not None
        assert "access_token" in result
        assert "refresh_token" in result
        assert result["token_type"] == "bearer"
    
    def test_change_password(self, db_session):
        """Test password change."""
        user = authentication_service.create_user(
            db=db_session,
            username="changeuser",
            email="change@example.com",
            password="oldpassword"
        )
        
        # Change password
        success = authentication_service.change_password(
            db=db_session,
            user_id=user.id,
            old_password="oldpassword",
            new_password="newpassword"
        )
        
        assert success is True
        
        # Verify new password works
        authenticated = authentication_service.authenticate_user(
            db=db_session,
            username="changeuser",
            password="newpassword"
        )
        
        assert authenticated is not None


class TestScopeValidatorService:
    """Test scope validator service."""
    
    def test_get_user_accessible_programs_global_scope(self, db_session):
        """Test getting accessible programs with global scope."""
        # Create user with admin role and global scope
        user = authentication_service.create_user(
            db=db_session,
            username="globaluser",
            email="global@example.com",
            password="password123"
        )
        
        user_role = role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.ADMIN
        )
        
        role_management_service.assign_scope(
            db=db_session,
            user_role_id=user_role.id,
            scope_type=ScopeType.GLOBAL
        )
        
        # Create some programs
        program1 = Program(
            name="Program 1",
            business_sponsor="Sponsor 1",
            program_manager="Manager 1",
            technical_lead="Lead 1",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        program2 = Program(
            name="Program 2",
            business_sponsor="Sponsor 2",
            program_manager="Manager 2",
            technical_lead="Lead 2",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        db_session.add_all([program1, program2])
        db_session.commit()
        
        # Get accessible programs
        accessible = scope_validator_service.get_user_accessible_programs(
            db=db_session,
            user_id=user.id
        )
        
        assert len(accessible) == 2
        assert program1.id in accessible
        assert program2.id in accessible
    
    def test_get_user_accessible_programs_program_scope(self, db_session):
        """Test getting accessible programs with program scope."""
        # Create user with program manager role
        user = authentication_service.create_user(
            db=db_session,
            username="proguser",
            email="prog@example.com",
            password="password123"
        )
        
        user_role = role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.PROGRAM_MANAGER
        )
        
        # Create programs
        program1 = Program(
            name="Program 1",
            business_sponsor="Sponsor 1",
            program_manager="Manager 1",
            technical_lead="Lead 1",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        program2 = Program(
            name="Program 2",
            business_sponsor="Sponsor 2",
            program_manager="Manager 2",
            technical_lead="Lead 2",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        db_session.add_all([program1, program2])
        db_session.commit()
        
        # Assign scope to only program1
        role_management_service.assign_scope(
            db=db_session,
            user_role_id=user_role.id,
            scope_type=ScopeType.PROGRAM,
            program_id=program1.id
        )
        
        # Get accessible programs
        accessible = scope_validator_service.get_user_accessible_programs(
            db=db_session,
            user_id=user.id
        )
        
        assert len(accessible) == 1
        assert program1.id in accessible
        assert program2.id not in accessible
    
    def test_get_user_accessible_projects_program_scope(self, db_session):
        """Test that program scope includes all projects in that program."""
        # Create user
        user = authentication_service.create_user(
            db=db_session,
            username="projuser",
            email="proj@example.com",
            password="password123"
        )
        
        user_role = role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.PROGRAM_MANAGER
        )
        
        # Create program
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        db_session.add(program)
        db_session.commit()
        
        # Create projects in the program
        project1 = Project(
            program_id=program.id,
            name="Project 1",
            business_sponsor="Sponsor 1",
            project_manager="PM 1",
            technical_lead="Lead 1",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=180)).date(),
            cost_center_code="CC001"
        )
        project2 = Project(
            program_id=program.id,
            name="Project 2",
            business_sponsor="Sponsor 2",
            project_manager="PM 2",
            technical_lead="Lead 2",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=180)).date(),
            cost_center_code="CC002"
        )
        db_session.add_all([project1, project2])
        db_session.commit()
        
        # Assign program scope
        role_management_service.assign_scope(
            db=db_session,
            user_role_id=user_role.id,
            scope_type=ScopeType.PROGRAM,
            program_id=program.id
        )
        
        # Get accessible projects
        accessible = scope_validator_service.get_user_accessible_projects(
            db=db_session,
            user_id=user.id
        )
        
        assert len(accessible) == 2
        assert project1.id in accessible
        assert project2.id in accessible


class TestAuthorizationService:
    """Test authorization service."""
    
    def test_admin_has_all_permissions(self, db_session):
        """Test that admin role has all permissions."""
        user = authentication_service.create_user(
            db=db_session,
            username="admin",
            email="admin@example.com",
            password="password123"
        )
        
        role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.ADMIN
        )
        
        # Check various permissions
        assert authorization_service.has_permission(
            db=db_session,
            user_id=user.id,
            permission=Permission.MANAGE_USERS
        )
        assert authorization_service.has_permission(
            db=db_session,
            user_id=user.id,
            permission=Permission.CREATE_PROGRAM
        )
        assert authorization_service.has_permission(
            db=db_session,
            user_id=user.id,
            permission=Permission.DELETE_PROJECT
        )
    
    def test_viewer_has_read_only_permissions(self, db_session):
        """Test that viewer role has only read permissions."""
        user = authentication_service.create_user(
            db=db_session,
            username="viewer",
            email="viewer@example.com",
            password="password123"
        )
        
        role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.VIEWER
        )
        
        # Check read permissions
        assert authorization_service.has_permission(
            db=db_session,
            user_id=user.id,
            permission=Permission.READ_PROGRAM
        )
        assert authorization_service.has_permission(
            db=db_session,
            user_id=user.id,
            permission=Permission.READ_PROJECT
        )
        
        # Check write permissions (should not have)
        assert not authorization_service.has_permission(
            db=db_session,
            user_id=user.id,
            permission=Permission.CREATE_PROGRAM
        )
        assert not authorization_service.has_permission(
            db=db_session,
            user_id=user.id,
            permission=Permission.DELETE_PROJECT
        )


class TestRoleManagementService:
    """Test role management service."""
    
    def test_assign_role(self, db_session):
        """Test role assignment."""
        user = authentication_service.create_user(
            db=db_session,
            username="roleuser",
            email="role@example.com",
            password="password123"
        )
        
        user_role = role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.PROJECT_MANAGER
        )
        
        assert user_role.user_id == user.id
        assert user_role.role_type == RoleType.PROJECT_MANAGER
        assert user_role.is_active is True
    
    def test_assign_scope(self, db_session):
        """Test scope assignment."""
        user = authentication_service.create_user(
            db=db_session,
            username="scopeuser",
            email="scope@example.com",
            password="password123"
        )
        
        user_role = role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.PROGRAM_MANAGER
        )
        
        # Create a program
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        db_session.add(program)
        db_session.commit()
        
        # Assign scope
        scope = role_management_service.assign_scope(
            db=db_session,
            user_role_id=user_role.id,
            scope_type=ScopeType.PROGRAM,
            program_id=program.id
        )
        
        assert scope.user_role_id == user_role.id
        assert scope.scope_type == ScopeType.PROGRAM
        assert scope.program_id == program.id
        assert scope.is_active is True
    
    def test_get_user_role_summary(self, db_session):
        """Test getting user role summary."""
        user = authentication_service.create_user(
            db=db_session,
            username="summaryuser",
            email="summary@example.com",
            password="password123"
        )
        
        user_role = role_management_service.assign_role(
            db=db_session,
            user_id=user.id,
            role_type=RoleType.FINANCE_MANAGER
        )
        
        role_management_service.assign_scope(
            db=db_session,
            user_role_id=user_role.id,
            scope_type=ScopeType.GLOBAL
        )
        
        summary = role_management_service.get_user_role_summary(
            db=db_session,
            user_id=user.id
        )
        
        assert summary["username"] == "summaryuser"
        assert len(summary["roles"]) == 1
        assert summary["roles"][0]["role_type"] == RoleType.FINANCE_MANAGER.value
        assert len(summary["roles"][0]["scopes"]) == 1


class TestAuditService:
    """Test audit service."""
    
    def test_log_create(self, db_session):
        """Test logging a CREATE operation."""
        user = authentication_service.create_user(
            db=db_session,
            username="audituser",
            email="audit@example.com",
            password="password123"
        )
        
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        db_session.add(program)
        db_session.commit()
        
        # Log the creation
        audit_log = audit_service.log_create(
            db=db_session,
            user_id=user.id,
            entity=program
        )
        
        assert audit_log.user_id == user.id
        assert audit_log.entity_type == "Program"
        assert audit_log.entity_id == program.id
        assert audit_log.operation == "CREATE"
        assert audit_log.after_values is not None
    
    def test_get_entity_history(self, db_session):
        """Test getting entity history."""
        user = authentication_service.create_user(
            db=db_session,
            username="historyuser",
            email="history@example.com",
            password="password123"
        )
        
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=365)).date()
        )
        db_session.add(program)
        db_session.commit()
        
        # Log creation
        audit_service.log_create(
            db=db_session,
            user_id=user.id,
            entity=program
        )
        
        # Get history
        history = audit_service.get_entity_history(
            db=db_session,
            entity_type="Program",
            entity_id=program.id
        )
        
        assert len(history) == 1
        assert history[0].operation == "CREATE"
