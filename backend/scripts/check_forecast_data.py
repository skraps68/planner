"""
Check forecast data calculation for Mobile Application Development project.
"""
import sys
import os
from datetime import date
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.project import Project
from app.services.forecasting import ForecastingService


def check_forecast():
    """Check forecast calculation for Mobile Application Development project."""
    db: Session = SessionLocal()
    
    try:
        # Find the Mobile Application Development project
        project = db.query(Project).filter(
            Project.name == "Mobile Application Development"
        ).first()
        
        if not project:
            print("Error: Mobile Application Development project not found")
            return
        
        print(f"Found project: {project.name}")
        print(f"Project ID: {project.id}")
        
        # Calculate forecast using a date in the middle of the project
        # This simulates viewing the forecast as if we were in October 2024
        as_of_date = date(2024, 10, 15)  # Middle of project
        
        print(f"Calculating forecast as of: {as_of_date}")
        
        forecasting_service = ForecastingService()
        forecast_data = forecasting_service.calculate_project_forecast(
            db=db,
            project_id=project.id,
            as_of_date=as_of_date
        )
        
        print("\nForecast Data:")
        print(f"Total Budget: ${forecast_data.total_budget}")
        print(f"Capital Budget: ${forecast_data.capital_budget}")
        print(f"Expense Budget: ${forecast_data.expense_budget}")
        print(f"\nTotal Actual: ${forecast_data.total_actual}")
        print(f"Capital Actual: ${forecast_data.capital_actual}")
        print(f"Expense Actual: ${forecast_data.expense_actual}")
        print(f"\nTotal Forecast: ${forecast_data.total_forecast}")
        print(f"Capital Forecast: ${forecast_data.capital_forecast}")
        print(f"Expense Forecast: ${forecast_data.expense_forecast}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("Checking forecast data for Mobile Application Development project...")
    check_forecast()
    print("\nDone!")
