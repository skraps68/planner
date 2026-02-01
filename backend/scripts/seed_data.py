"""
Seed data script for development and testing.
Creates sample programs, projects, workers, users with role/scope assignments.
"""
import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, Worker, WorkerType, ResourceType
from app.models.rate import Rate
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType
from app.services.authentication import AuthenticationService


def clear_database(db: Session):
    """Clear all data from the database."""
    print("Clearing existing data...")
    
    # Delete in reverse order of dependencies
    db.query(Actual).delete()
    db.query(ResourceAssignment).delete()
    db.query(ScopeAssignment).delete()
    db.query(UserRole).delete()
    db.query(User).delete()
    db.query(Rate).delete()
    db.query(Worker).delete()
    db.query(WorkerType).delete()
    db.query(Resource).delete()
    db.query(ProjectPhase).delete()
    db.query(Project).delete()
    db.query(Program).delete()
    
    db.commit()
    print("Database cleared.")


def create_programs(db: Session) -> dict:
    """Create sample programs."""
    print("Creating programs...")
    
    programs = {
        "digital_transformation": Program(
            id=uuid4(),
            name="Digital Transformation Initiative",
            business_sponsor="Jane Smith",
            program_manager="John Doe",
            technical_lead="Alice Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2025, 12, 31),
            description="Enterprise-wide digital transformation program"
        ),
        "infrastructure_modernization": Program(
            id=uuid4(),
            name="Infrastructure Modernization",
            business_sponsor="Bob Wilson",
            program_manager="Carol Davis",
            technical_lead="David Brown",
            start_date=date(2024, 6, 1),
            end_date=date(2026, 5, 31),
            description="Modernize IT infrastructure and cloud migration"
        ),
        "customer_experience": Program(
            id=uuid4(),
            name="Customer Experience Enhancement",
            business_sponsor="Emily Taylor",
            program_manager="Frank Miller",
            technical_lead="Grace Lee",
            start_date=date(2024, 3, 1),
            end_date=date(2025, 8, 31),
            description="Improve customer-facing applications and services"
        ),
    }
    
    for program in programs.values():
        db.add(program)
    
    db.commit()
    print(f"Created {len(programs)} programs.")
    return programs


def create_projects(db: Session, programs: dict) -> dict:
    """Create sample projects with phases."""
    print("Creating projects...")
    
    projects = {
        "mobile_app": Project(
            id=uuid4(),
            program_id=programs["digital_transformation"].id,
            name="Mobile Application Development",
            business_sponsor="Jane Smith",
            project_manager="Sarah Connor",
            technical_lead="Kyle Reese",
            start_date=date(2024, 2, 1),
            end_date=date(2025, 6, 30),
            cost_center_code="CC-001",
            description="Develop new mobile application for customers"
        ),
        "web_portal": Project(
            id=uuid4(),
            program_id=programs["digital_transformation"].id,
            name="Web Portal Redesign",
            business_sponsor="Jane Smith",
            project_manager="Michael Scott",
            technical_lead="Dwight Schrute",
            start_date=date(2024, 4, 1),
            end_date=date(2025, 3, 31),
            cost_center_code="CC-002",
            description="Redesign customer web portal with modern UI"
        ),
        "cloud_migration": Project(
            id=uuid4(),
            program_id=programs["infrastructure_modernization"].id,
            name="Cloud Migration Phase 1",
            business_sponsor="Bob Wilson",
            project_manager="Tony Stark",
            technical_lead="Bruce Banner",
            start_date=date(2024, 7, 1),
            end_date=date(2025, 12, 31),
            cost_center_code="CC-003",
            description="Migrate core applications to AWS cloud"
        ),
        "data_center": Project(
            id=uuid4(),
            program_id=programs["infrastructure_modernization"].id,
            name="Data Center Consolidation",
            business_sponsor="Bob Wilson",
            project_manager="Steve Rogers",
            technical_lead="Natasha Romanoff",
            start_date=date(2024, 9, 1),
            end_date=date(2026, 3, 31),
            cost_center_code="CC-004",
            description="Consolidate regional data centers"
        ),
        "crm_upgrade": Project(
            id=uuid4(),
            program_id=programs["customer_experience"].id,
            name="CRM System Upgrade",
            business_sponsor="Emily Taylor",
            project_manager="Peter Parker",
            technical_lead="Mary Jane",
            start_date=date(2024, 4, 1),
            end_date=date(2025, 6, 30),
            cost_center_code="CC-005",
            description="Upgrade CRM system to latest version"
        ),
    }
    
    for project in projects.values():
        db.add(project)
    
    db.commit()
    
    # Create project phases
    print("Creating project phases...")
    phases = {}
    
    # Mobile App project - create 3 phases with different budgets
    mobile_project = projects["mobile_app"]
    mobile_phases = [
        ProjectPhase(
            id=uuid4(),
            project_id=mobile_project.id,
            name="Planning & Design",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 5, 31),
            capital_budget=Decimal("150000.00"),
            expense_budget=Decimal("100000.00"),
            total_budget=Decimal("250000.00")
        ),
        ProjectPhase(
            id=uuid4(),
            project_id=mobile_project.id,
            name="Development",
            start_date=date(2024, 6, 1),
            end_date=date(2024, 12, 31),
            capital_budget=Decimal("400000.00"),
            expense_budget=Decimal("200000.00"),
            total_budget=Decimal("600000.00")
        ),
        ProjectPhase(
            id=uuid4(),
            project_id=mobile_project.id,
            name="Testing & Deployment",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 6, 30),
            capital_budget=Decimal("100000.00"),
            expense_budget=Decimal("150000.00"),
            total_budget=Decimal("250000.00")
        ),
    ]
    
    for i, phase in enumerate(mobile_phases):
        db.add(phase)
        phases[f"mobile_app_phase_{i+1}"] = phase
    
    # Other projects - create default phases
    for key, project in projects.items():
        if key != "mobile_app":
            default_phase = ProjectPhase(
                id=uuid4(),
                project_id=project.id,
                name="Default Phase",
                start_date=project.start_date,
                end_date=project.end_date,
                capital_budget=Decimal("350000.00"),
                expense_budget=Decimal("250000.00"),
                total_budget=Decimal("600000.00")
            )
            db.add(default_phase)
            phases[f"{key}_default"] = default_phase
    
    db.commit()
    print(f"Created {len(projects)} projects with {len(phases)} phases.")
    return projects, phases


def create_worker_types_and_rates(db: Session) -> dict:
    """Create worker types with historical rates."""
    print("Creating worker types and rates...")
    
    worker_types = {
        "senior_engineer": WorkerType(
            id=uuid4(),
            type="Senior Software Engineer",
            description="Experienced software engineer with 5+ years"
        ),
        "engineer": WorkerType(
            id=uuid4(),
            type="Software Engineer",
            description="Software engineer with 2-5 years experience"
        ),
        "junior_engineer": WorkerType(
            id=uuid4(),
            type="Junior Software Engineer",
            description="Entry-level software engineer"
        ),
        "architect": WorkerType(
            id=uuid4(),
            type="Solutions Architect",
            description="Technical architect and system designer"
        ),
        "project_manager": WorkerType(
            id=uuid4(),
            type="Project Manager",
            description="Project management professional"
        ),
        "business_analyst": WorkerType(
            id=uuid4(),
            type="Business Analyst",
            description="Business analysis and requirements specialist"
        ),
    }
    
    for wt in worker_types.values():
        db.add(wt)
    
    db.commit()
    
    # Create rates with historical data
    rates = []
    rate_data = {
        "senior_engineer": [
            (Decimal("1200.00"), date(2023, 1, 1), date(2023, 12, 31)),
            (Decimal("1250.00"), date(2024, 1, 1), None),
        ],
        "engineer": [
            (Decimal("900.00"), date(2023, 1, 1), date(2023, 12, 31)),
            (Decimal("950.00"), date(2024, 1, 1), None),
        ],
        "junior_engineer": [
            (Decimal("600.00"), date(2023, 1, 1), date(2023, 12, 31)),
            (Decimal("650.00"), date(2024, 1, 1), None),
        ],
        "architect": [
            (Decimal("1500.00"), date(2023, 1, 1), date(2023, 12, 31)),
            (Decimal("1600.00"), date(2024, 1, 1), None),
        ],
        "project_manager": [
            (Decimal("1100.00"), date(2023, 1, 1), date(2023, 12, 31)),
            (Decimal("1150.00"), date(2024, 1, 1), None),
        ],
        "business_analyst": [
            (Decimal("850.00"), date(2023, 1, 1), date(2023, 12, 31)),
            (Decimal("900.00"), date(2024, 1, 1), None),
        ],
    }
    
    for wt_key, rate_list in rate_data.items():
        for rate_amount, start_date, end_date in rate_list:
            rate = Rate(
                id=uuid4(),
                worker_type_id=worker_types[wt_key].id,
                rate_amount=rate_amount,
                start_date=start_date,
                end_date=end_date
            )
            db.add(rate)
            rates.append(rate)
    
    db.commit()
    print(f"Created {len(worker_types)} worker types with {len(rates)} rates.")
    return worker_types


def create_workers(db: Session, worker_types: dict) -> dict:
    """Create sample workers."""
    print("Creating workers...")
    
    workers = {
        "john_smith": Worker(
            id=uuid4(),
            external_id="EMP001",
            name="John Smith",
            worker_type_id=worker_types["senior_engineer"].id
        ),
        "jane_doe": Worker(
            id=uuid4(),
            external_id="EMP002",
            name="Jane Doe",
            worker_type_id=worker_types["architect"].id
        ),
        "bob_johnson": Worker(
            id=uuid4(),
            external_id="EMP003",
            name="Bob Johnson",
            worker_type_id=worker_types["engineer"].id
        ),
        "alice_williams": Worker(
            id=uuid4(),
            external_id="EMP004",
            name="Alice Williams",
            worker_type_id=worker_types["engineer"].id
        ),
        "charlie_brown": Worker(
            id=uuid4(),
            external_id="EMP005",
            name="Charlie Brown",
            worker_type_id=worker_types["junior_engineer"].id
        ),
        "diana_prince": Worker(
            id=uuid4(),
            external_id="EMP006",
            name="Diana Prince",
            worker_type_id=worker_types["project_manager"].id
        ),
        "evan_peters": Worker(
            id=uuid4(),
            external_id="EMP007",
            name="Evan Peters",
            worker_type_id=worker_types["business_analyst"].id
        ),
    }
    
    for worker in workers.values():
        db.add(worker)
    
    db.commit()
    print(f"Created {len(workers)} workers.")
    return workers


def create_resources(db: Session) -> dict:
    """Create sample non-labor resources."""
    print("Creating resources...")
    
    resources = {
        "aws_services": Resource(
            id=uuid4(),
            name="AWS Cloud Services",
            resource_type=ResourceType.NON_LABOR,
            description="Amazon Web Services cloud infrastructure"
        ),
        "software_licenses": Resource(
            id=uuid4(),
            name="Software Licenses",
            resource_type=ResourceType.NON_LABOR,
            description="Enterprise software licenses"
        ),
        "hardware": Resource(
            id=uuid4(),
            name="Server Hardware",
            resource_type=ResourceType.NON_LABOR,
            description="Physical server equipment"
        ),
    }
    
    for resource in resources.values():
        db.add(resource)
    
    db.commit()
    print(f"Created {len(resources)} non-labor resources.")
    return resources


def create_labor_resources_for_workers(db: Session, workers: dict) -> dict:
    """Create labor resources for each worker."""
    print("Creating labor resources for workers...")
    
    labor_resources = {}
    for worker_key, worker in workers.items():
        labor_resource = Resource(
            id=uuid4(),
            name=worker.name,
            resource_type=ResourceType.LABOR,
            description=f"Labor resource for {worker.name} ({worker.external_id})"
        )
        db.add(labor_resource)
        labor_resources[worker_key] = labor_resource
    
    db.commit()
    print(f"Created {len(labor_resources)} labor resources.")
    return labor_resources


def create_resource_assignments(db: Session, labor_resources: dict, projects: dict, phases: dict):
    """Create sample resource assignments."""
    print("Creating resource assignments...")
    
    assignments = []
    
    # Mobile app project - Phase 1: Planning & Design (Feb-May 2024)
    # Phase association is implicit based on assignment_date falling within phase date range
    start_date = date(2024, 2, 1)
    
    for i in range(120):  # 120 days (4 months)
        assignment_date = start_date + timedelta(days=i)
        if assignment_date > date(2024, 5, 31):
            break
        
        # John Smith - 50% allocation in planning phase
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["john_smith"].id,
            project_id=projects["mobile_app"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("50.00"),
            capital_percentage=Decimal("60.00"),
            expense_percentage=Decimal("40.00")
        ))
        
        # Jane Doe - 75% allocation in planning phase (architect)
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["jane_doe"].id,
            project_id=projects["mobile_app"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("75.00"),
            capital_percentage=Decimal("70.00"),
            expense_percentage=Decimal("30.00")
        ))
    
    # Mobile app project - Phase 2: Development (Jun-Dec 2024)
    # Phase association is implicit based on assignment_date falling within phase date range
    start_date = date(2024, 6, 1)
    
    for i in range(214):  # 214 days (7 months)
        assignment_date = start_date + timedelta(days=i)
        if assignment_date > date(2024, 12, 31):
            break
        
        # John Smith - 100% allocation in development phase
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["john_smith"].id,
            project_id=projects["mobile_app"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("100.00"),
            capital_percentage=Decimal("80.00"),
            expense_percentage=Decimal("20.00")
        ))
        
        # Bob Johnson - 100% allocation in development phase
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["bob_johnson"].id,
            project_id=projects["mobile_app"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("100.00"),
            capital_percentage=Decimal("85.00"),
            expense_percentage=Decimal("15.00")
        ))
        
        # Alice Williams - 75% allocation in development phase
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["alice_williams"].id,
            project_id=projects["mobile_app"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("75.00"),
            capital_percentage=Decimal("80.00"),
            expense_percentage=Decimal("20.00")
        ))
    
    # Mobile app project - Phase 3: Testing & Deployment (Jan-Jun 2025)
    # Phase association is implicit based on assignment_date falling within phase date range
    start_date = date(2025, 1, 1)
    
    for i in range(181):  # 181 days (6 months)
        assignment_date = start_date + timedelta(days=i)
        if assignment_date > date(2025, 6, 30):
            break
        
        # Bob Johnson - 50% allocation in testing phase
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["bob_johnson"].id,
            project_id=projects["mobile_app"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("50.00"),
            capital_percentage=Decimal("40.00"),
            expense_percentage=Decimal("60.00")
        ))
        
        # Charlie Brown - 100% allocation in testing phase
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["charlie_brown"].id,
            project_id=projects["mobile_app"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("100.00"),
            capital_percentage=Decimal("30.00"),
            expense_percentage=Decimal("70.00")
        ))
    
    # Web portal project assignments
    start_date = date(2024, 4, 1)
    
    for i in range(60):  # 60 days of assignments
        assignment_date = start_date + timedelta(days=i)
        
        # Alice Williams - 100% allocation, 50% capital / 50% expense
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["alice_williams"].id,
            project_id=projects["web_portal"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("100.00"),
            capital_percentage=Decimal("50.00"),
            expense_percentage=Decimal("50.00")
        ))
        
        # Charlie Brown - 25% allocation, 80% capital / 20% expense
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["charlie_brown"].id,
            project_id=projects["web_portal"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("25.00"),
            capital_percentage=Decimal("80.00"),
            expense_percentage=Decimal("20.00")
        ))
    
    # Cloud migration project assignments
    start_date = date(2024, 7, 1)
    
    for i in range(120):  # 120 days of assignments
        assignment_date = start_date + timedelta(days=i)
        
        # Jane Doe - 80% allocation, 90% capital / 10% expense
        assignments.append(ResourceAssignment(
            id=uuid4(),
            resource_id=labor_resources["jane_doe"].id,
            project_id=projects["cloud_migration"].id,
            assignment_date=assignment_date,
            allocation_percentage=Decimal("80.00"),
            capital_percentage=Decimal("90.00"),
            expense_percentage=Decimal("10.00")
        ))
    
    for assignment in assignments:
        db.add(assignment)
    
    db.commit()
    print(f"Created {len(assignments)} resource assignments.")


def create_actuals(db: Session, workers: dict, projects: dict):
    """Create sample actual work records."""
    print("Creating actuals...")
    
    actuals = []
    
    # Mobile app actuals - Phase 1: Planning & Design (Feb-Apr 2024)
    start_date = date(2024, 2, 1)
    for i in range(90):  # 90 days of actuals in phase 1
        actual_date = start_date + timedelta(days=i)
        if actual_date > date(2024, 5, 31):
            break
        
        # John Smith actuals - 50% allocation
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["mobile_app"].id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=actual_date,
            allocation_percentage=Decimal("50.00"),
            actual_cost=Decimal("625.00"),  # 1250 * 0.50
            capital_amount=Decimal("375.00"),  # 60% capital
            expense_amount=Decimal("250.00")   # 40% expense
        ))
        
        # Jane Doe actuals - 75% allocation (architect)
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["mobile_app"].id,
            external_worker_id="EMP002",
            worker_name="Jane Doe",
            actual_date=actual_date,
            allocation_percentage=Decimal("75.00"),
            actual_cost=Decimal("1200.00"),  # 1600 * 0.75
            capital_amount=Decimal("840.00"),  # 70% capital
            expense_amount=Decimal("360.00")   # 30% expense
        ))
    
    # Mobile app actuals - Phase 2: Development (Jun-Sep 2024)
    start_date = date(2024, 6, 1)
    for i in range(122):  # 122 days of actuals in phase 2
        actual_date = start_date + timedelta(days=i)
        if actual_date > date(2024, 9, 30):
            break
        
        # John Smith actuals - 100% allocation
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["mobile_app"].id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=actual_date,
            allocation_percentage=Decimal("100.00"),
            actual_cost=Decimal("1250.00"),  # 1250 * 1.00
            capital_amount=Decimal("1000.00"),  # 80% capital
            expense_amount=Decimal("250.00")   # 20% expense
        ))
        
        # Bob Johnson actuals - 100% allocation
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["mobile_app"].id,
            external_worker_id="EMP003",
            worker_name="Bob Johnson",
            actual_date=actual_date,
            allocation_percentage=Decimal("100.00"),
            actual_cost=Decimal("950.00"),  # 950 * 1.00
            capital_amount=Decimal("807.50"),  # 85% capital
            expense_amount=Decimal("142.50")   # 15% expense
        ))
        
        # Alice Williams actuals - 75% allocation
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["mobile_app"].id,
            external_worker_id="EMP004",
            worker_name="Alice Williams",
            actual_date=actual_date,
            allocation_percentage=Decimal("75.00"),
            actual_cost=Decimal("712.50"),  # 950 * 0.75
            capital_amount=Decimal("570.00"),  # 80% capital
            expense_amount=Decimal("142.50")   # 20% expense
        ))
    
    # Mobile app actuals - Phase 3: Testing & Deployment (Jan-Feb 2025)
    start_date = date(2025, 1, 1)
    for i in range(60):  # 60 days of actuals in phase 3
        actual_date = start_date + timedelta(days=i)
        if actual_date > date(2025, 3, 1):
            break
        
        # Bob Johnson actuals - 50% allocation
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["mobile_app"].id,
            external_worker_id="EMP003",
            worker_name="Bob Johnson",
            actual_date=actual_date,
            allocation_percentage=Decimal("50.00"),
            actual_cost=Decimal("475.00"),  # 950 * 0.50
            capital_amount=Decimal("190.00"),  # 40% capital
            expense_amount=Decimal("285.00")   # 60% expense
        ))
        
        # Charlie Brown actuals - 100% allocation
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["mobile_app"].id,
            external_worker_id="EMP005",
            worker_name="Charlie Brown",
            actual_date=actual_date,
            allocation_percentage=Decimal("100.00"),
            actual_cost=Decimal("650.00"),  # 650 * 1.00
            capital_amount=Decimal("195.00"),  # 30% capital
            expense_amount=Decimal("455.00")   # 70% expense
        ))
    
    # Web portal actuals
    start_date = date(2024, 4, 1)
    for i in range(20):  # 20 days of actuals
        actual_date = start_date + timedelta(days=i)
        
        # Alice Williams actuals - 100% allocation
        actuals.append(Actual(
            id=uuid4(),
            project_id=projects["web_portal"].id,
            external_worker_id="EMP004",
            worker_name="Alice Williams",
            actual_date=actual_date,
            allocation_percentage=Decimal("100.00"),
            actual_cost=Decimal("950.00"),  # 950 * 1.00
            capital_amount=Decimal("475.00"),  # 50% capital
            expense_amount=Decimal("475.00")   # 50% expense
        ))
    
    for actual in actuals:
        db.add(actual)
    
    db.commit()
    print(f"Created {len(actuals)} actual records.")


def create_users_with_roles_and_scopes(db: Session, programs: dict, projects: dict):
    """Create users with various role and scope assignments."""
    print("Creating users with roles and scopes...")
    
    auth_service = AuthenticationService()
    
    # Admin user with global scope
    admin_user = User(
        id=uuid4(),
        username="admin",
        email="admin@example.com",
        password_hash=auth_service.hash_password("admin123"),
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    
    admin_role = UserRole(
        id=uuid4(),
        user_id=admin_user.id,
        role_type=RoleType.ADMIN,
        is_active=True
    )
    db.add(admin_role)
    db.commit()
    
    admin_scope = ScopeAssignment(
        id=uuid4(),
        user_role_id=admin_role.id,
        scope_type=ScopeType.GLOBAL,
        is_active=True
    )
    db.add(admin_scope)
    
    # Program manager with program-level scope
    pm_user = User(
        id=uuid4(),
        username="program_mgr",
        email="pm@example.com",
        password_hash=auth_service.hash_password("pm123"),
        is_active=True
    )
    db.add(pm_user)
    db.commit()
    
    pm_role = UserRole(
        id=uuid4(),
        user_id=pm_user.id,
        role_type=RoleType.PROGRAM_MANAGER,
        is_active=True
    )
    db.add(pm_role)
    db.commit()
    
    # Scope for Digital Transformation program
    pm_scope = ScopeAssignment(
        id=uuid4(),
        user_role_id=pm_role.id,
        program_id=programs["digital_transformation"].id,
        scope_type=ScopeType.PROGRAM,
        is_active=True
    )
    db.add(pm_scope)
    
    # Project manager with project-level scope
    proj_mgr_user = User(
        id=uuid4(),
        username="project_mgr",
        email="projmgr@example.com",
        password_hash=auth_service.hash_password("proj123"),
        is_active=True
    )
    db.add(proj_mgr_user)
    db.commit()
    
    proj_mgr_role = UserRole(
        id=uuid4(),
        user_id=proj_mgr_user.id,
        role_type=RoleType.PROJECT_MANAGER,
        is_active=True
    )
    db.add(proj_mgr_role)
    db.commit()
    
    # Scope for Mobile App project only
    proj_mgr_scope = ScopeAssignment(
        id=uuid4(),
        user_role_id=proj_mgr_role.id,
        project_id=projects["mobile_app"].id,
        scope_type=ScopeType.PROJECT,
        is_active=True
    )
    db.add(proj_mgr_scope)
    
    # Finance manager with multiple program scopes
    finance_user = User(
        id=uuid4(),
        username="finance_mgr",
        email="finance@example.com",
        password_hash=auth_service.hash_password("finance123"),
        is_active=True
    )
    db.add(finance_user)
    db.commit()
    
    finance_role = UserRole(
        id=uuid4(),
        user_id=finance_user.id,
        role_type=RoleType.FINANCE_MANAGER,
        is_active=True
    )
    db.add(finance_role)
    db.commit()
    
    # Scope for Digital Transformation program
    finance_scope1 = ScopeAssignment(
        id=uuid4(),
        user_role_id=finance_role.id,
        program_id=programs["digital_transformation"].id,
        scope_type=ScopeType.PROGRAM,
        is_active=True
    )
    db.add(finance_scope1)
    
    # Scope for Infrastructure Modernization program
    finance_scope2 = ScopeAssignment(
        id=uuid4(),
        user_role_id=finance_role.id,
        program_id=programs["infrastructure_modernization"].id,
        scope_type=ScopeType.PROGRAM,
        is_active=True
    )
    db.add(finance_scope2)
    
    # Resource manager with mixed scopes
    resource_user = User(
        id=uuid4(),
        username="resource_mgr",
        email="resource@example.com",
        password_hash=auth_service.hash_password("resource123"),
        is_active=True
    )
    db.add(resource_user)
    db.commit()
    
    resource_role = UserRole(
        id=uuid4(),
        user_id=resource_user.id,
        role_type=RoleType.RESOURCE_MANAGER,
        is_active=True
    )
    db.add(resource_role)
    db.commit()
    
    # Program scope for Infrastructure Modernization
    resource_scope1 = ScopeAssignment(
        id=uuid4(),
        user_role_id=resource_role.id,
        program_id=programs["infrastructure_modernization"].id,
        scope_type=ScopeType.PROGRAM,
        is_active=True
    )
    db.add(resource_scope1)
    
    # Project scope for CRM Upgrade (in different program)
    resource_scope2 = ScopeAssignment(
        id=uuid4(),
        user_role_id=resource_role.id,
        project_id=projects["crm_upgrade"].id,
        scope_type=ScopeType.PROJECT,
        is_active=True
    )
    db.add(resource_scope2)
    
    # Viewer with limited project scope
    viewer_user = User(
        id=uuid4(),
        username="viewer",
        email="viewer@example.com",
        password_hash=auth_service.hash_password("viewer123"),
        is_active=True
    )
    db.add(viewer_user)
    db.commit()
    
    viewer_role = UserRole(
        id=uuid4(),
        user_id=viewer_user.id,
        role_type=RoleType.VIEWER,
        is_active=True
    )
    db.add(viewer_role)
    db.commit()
    
    # Scope for Web Portal project only
    viewer_scope = ScopeAssignment(
        id=uuid4(),
        user_role_id=viewer_role.id,
        project_id=projects["web_portal"].id,
        scope_type=ScopeType.PROJECT,
        is_active=True
    )
    db.add(viewer_scope)
    
    # Multi-role user
    multi_user = User(
        id=uuid4(),
        username="multi_role",
        email="multi@example.com",
        password_hash=auth_service.hash_password("multi123"),
        is_active=True
    )
    db.add(multi_user)
    db.commit()
    
    # First role: Project Manager for Mobile App
    multi_role1 = UserRole(
        id=uuid4(),
        user_id=multi_user.id,
        role_type=RoleType.PROJECT_MANAGER,
        is_active=True
    )
    db.add(multi_role1)
    db.commit()
    
    multi_scope1 = ScopeAssignment(
        id=uuid4(),
        user_role_id=multi_role1.id,
        project_id=projects["mobile_app"].id,
        scope_type=ScopeType.PROJECT,
        is_active=True
    )
    db.add(multi_scope1)
    
    # Second role: Finance Manager for Customer Experience program
    multi_role2 = UserRole(
        id=uuid4(),
        user_id=multi_user.id,
        role_type=RoleType.FINANCE_MANAGER,
        is_active=False  # Not currently active
    )
    db.add(multi_role2)
    db.commit()
    
    multi_scope2 = ScopeAssignment(
        id=uuid4(),
        user_role_id=multi_role2.id,
        program_id=programs["customer_experience"].id,
        scope_type=ScopeType.PROGRAM,
        is_active=True
    )
    db.add(multi_scope2)
    
    db.commit()
    print("Created 7 users with various role and scope assignments.")


def main():
    """Main seed data creation function."""
    print("=" * 60)
    print("Starting seed data creation...")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Clear existing data
        clear_database(db)
        
        # Create all seed data
        programs = create_programs(db)
        projects, phases = create_projects(db, programs)
        worker_types = create_worker_types_and_rates(db)
        workers = create_workers(db, worker_types)
        resources = create_resources(db)
        labor_resources = create_labor_resources_for_workers(db, workers)
        create_resource_assignments(db, labor_resources, projects, phases)
        create_actuals(db, workers, projects)
        create_users_with_roles_and_scopes(db, programs, projects)
        
        print("=" * 60)
        print("Seed data creation completed successfully!")
        print("=" * 60)
        print("\nTest Users:")
        print("  admin / admin123 - Admin with global scope")
        print("  program_mgr / pm123 - Program Manager for Digital Transformation")
        print("  project_mgr / proj123 - Project Manager for Mobile App only")
        print("  finance_mgr / finance123 - Finance Manager for 2 programs")
        print("  resource_mgr / resource123 - Resource Manager with mixed scopes")
        print("  viewer / viewer123 - Viewer for Web Portal only")
        print("  multi_role / multi123 - User with multiple roles")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error creating seed data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
