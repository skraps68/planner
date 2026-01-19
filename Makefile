# Program and Project Management System - Development Makefile

.PHONY: help start stop reset test lint format install-dev

# Default target
help:
	@echo "Program and Project Management System - Development Commands"
	@echo ""
	@echo "Available commands:"
	@echo "  start       - Start development environment"
	@echo "  stop        - Stop development environment"
	@echo "  reset       - Reset development environment (removes all data)"
	@echo "  test        - Run tests"
	@echo "  lint        - Run linting"
	@echo "  format      - Format code"
	@echo "  install-dev - Install development dependencies"
	@echo "  logs        - View application logs"
	@echo "  shell       - Open shell in application container"
	@echo ""

# Development environment
start:
	@./scripts/start-dev.sh

stop:
	@./scripts/stop-dev.sh

reset:
	@./scripts/reset-dev.sh

# Testing
test:
	@echo "Running tests..."
	@docker-compose exec app pytest

test-cov:
	@echo "Running tests with coverage..."
	@docker-compose exec app pytest --cov=app --cov-report=html

# Code quality
lint:
	@echo "Running linting..."
	@docker-compose exec app flake8 app tests
	@docker-compose exec app mypy app

format:
	@echo "Formatting code..."
	@docker-compose exec app black app tests
	@docker-compose exec app isort app tests

# Development utilities
logs:
	@docker-compose logs -f app

shell:
	@docker-compose exec app bash

db-shell:
	@docker-compose exec db psql -U postgres -d planner

# Database migrations
migrate:
	@echo "Running database migrations..."
	@docker-compose exec app alembic upgrade head

migration:
	@echo "Creating new migration..."
	@read -p "Migration message: " msg; \
	docker-compose exec app alembic revision --autogenerate -m "$$msg"

# Installation
install-dev:
	@echo "Installing development dependencies..."
	@pip install -r backend/requirements.txt