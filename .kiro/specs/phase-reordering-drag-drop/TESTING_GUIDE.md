# Testing Guide: Automatic Phase Date Adjustment

## Quick Reference

This guide provides step-by-step instructions for testing the automatic phase date adjustment feature.

## Feature Overview

When project start/end dates are modified, the system automatically adjusts boundary phase dates:
- **First phase start date** → Updated to match project start date
- **Last phase end date** → Updated to match project end date
- **User notification** → Displays which phases were adjusted

## Prerequisites

- Backend server running
- Frontend development server running
- Test project with multiple phases (or use existing project)

## Test Scenarios

### Scenario 1: Update Project Start Date

**Setup:**
- Project: 2024-01-01 to 2024-12-31
- Phases: Planning (2024-01-01 to 2024-03-31), Development (2024-04-01 to 2024-12-31)

**Steps:**
1. Navigate to project detail page
2. Click "Phases" tab
3. Click pencil icon to edit
4. Change project start date to 2024-02-01
5. Click save

**Expected Result:**
- Success notification appears
- Message: "Project dates updated. Phase adjustments: "Planning" start date updated to 2/1/2024"
- Planning phase start date now shows 2024-02-01
- Development phase unchanged

### Scenario 2: Update Project End Date

**Setup:**
- Project: 2024-01-01 to 2024-12-31
- Phases: Planning (2024-01-01 to 2024-06-30), Execution (2024-07-01 to 2024-12-31)

**Steps:**
1. Navigate to project detail page
2. Click "Phases" tab
3. Click pencil icon to edit
4. Change project end date to 2024-11-30
5. Click save

**Expected Result:**
- Success notification appears
- Message: "Project dates updated. Phase adjustments: "Execution" end date updated to 11/30/2024"
- Execution phase end date now shows 2024-11-30
- Planning phase unchanged

### Scenario 3: Update Both Dates

**Setup:**
- Project: 2024-01-01 to 2024-12-31
- Phases: Phase 1 (2024-01-01 to 2024-06-30), Phase 2 (2024-07-01 to 2024-12-31)

**Steps:**
1. Navigate to project detail page
2. Click "Phases" tab
3. Click pencil icon to edit
4. Change project start date to 2024-02-01
5. Change project end date to 2024-11-30
6. Click save

**Expected Result:**
- Success notification appears
- Message: "Project dates updated. Phase adjustments: "Phase 1" start date updated to 2/1/2024; "Phase 2" end date updated to 11/30/2024"
- Phase 1 start date now shows 2024-02-01
- Phase 2 end date now shows 2024-11-30

### Scenario 4: Default Phase

**Setup:**
- Project: 2024-01-01 to 2024-12-31
- Phases: Default Phase (2024-01-01 to 2024-12-31)

**Steps:**
1. Navigate to project detail page
2. Click "Phases" tab
3. Click pencil icon to edit
4. Change project start date to 2024-02-01
5. Change project end date to 2024-11-30
6. Click save

**Expected Result:**
- Success notification appears
- Message: "Project dates updated. Phase adjustments: "Default Phase" dates updated to match project dates"
- Default Phase now shows 2024-02-01 to 2024-11-30

### Scenario 5: No Adjustment Needed

**Setup:**
- Project: 2024-01-01 to 2024-12-31
- Phases: Phase 1 (2024-01-01 to 2024-06-30), Phase 2 (2024-07-01 to 2024-12-31)

**Steps:**
1. Navigate to project detail page
2. Click "Phases" tab
3. Click pencil icon to edit
4. Change project manager (don't change dates)
5. Click save

**Expected Result:**
- Success notification appears
- Message: "Project updated successfully" (no phase adjustments mentioned)
- No phase dates changed

### Scenario 6: Error Handling

**Steps:**
1. Navigate to project detail page
2. Click "Phases" tab
3. Click pencil icon to edit
4. Change project start date to be AFTER end date
5. Click save

**Expected Result:**
- Error notification appears
- Message: "Failed to update project dates" or validation error
- No changes saved

## Verification Checklist

After each test scenario, verify:

- [ ] Notification appears in bottom-right corner
- [ ] Notification message is clear and accurate
- [ ] Notification auto-dismisses after 6 seconds
- [ ] Phase list reflects updated dates
- [ ] Project dates reflect changes
- [ ] Database contains correct dates (check via API or database tool)
- [ ] No console errors in browser
- [ ] No server errors in backend logs

## API Testing

You can also test the API directly using curl or Postman:

```bash
# Update project dates
curl -X PUT http://localhost:8000/api/v1/projects/{project_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "start_date": "2024-02-01",
    "end_date": "2024-11-30"
  }'
```

**Expected Response:**
```json
{
  "id": "...",
  "name": "...",
  "start_date": "2024-02-01",
  "end_date": "2024-11-30",
  "phases": [...],
  "phase_adjustments": [
    {
      "phase_name": "Planning",
      "field": "start_date",
      "old_value": "2024-01-01",
      "new_value": "2024-02-01"
    },
    {
      "phase_name": "Closure",
      "field": "end_date",
      "old_value": "2024-12-31",
      "new_value": "2024-11-30"
    }
  ]
}
```

## Database Verification

To verify changes in the database:

```sql
-- Check project dates
SELECT id, name, start_date, end_date 
FROM projects 
WHERE id = '{project_id}';

-- Check phase dates
SELECT id, name, start_date, end_date 
FROM project_phases 
WHERE project_id = '{project_id}'
ORDER BY start_date;
```

## Common Issues

### Issue: Notification doesn't appear
- Check browser console for errors
- Verify API response includes phase_adjustments
- Check snackbar state in React DevTools

### Issue: Phase dates don't update
- Verify API response is successful
- Check if refetch() is called after update
- Verify database contains updated dates

### Issue: Wrong phases adjusted
- Check phase sorting logic (should sort by start_date)
- Verify first/last phase identification
- Check for multiple phases with same start date

### Issue: Notification message incorrect
- Verify phase_adjustments structure in API response
- Check message building logic in handleProjectDateChange
- Verify date formatting

## Performance Testing

For projects with many phases:

1. Create project with 10+ phases
2. Update project dates
3. Verify:
   - Response time < 1 second
   - Only boundary phases updated
   - No unnecessary database queries
   - UI remains responsive

## Regression Testing

After making changes, verify:

1. Existing phase editing still works
2. Boundary date editing still works
3. Drag-and-drop reordering still works
4. Phase validation still works
5. Other project updates still work

## Automated Testing

To run automated tests (when available):

```bash
# Backend tests
cd backend
source venv/bin/activate
pytest tests/unit/test_services.py::TestProjectService::test_update_project -v
pytest tests/integration/test_project_api.py::test_update_project -v

# Frontend tests
cd frontend
npm test -- ProjectDetailPage
```

## Test Data Setup

To create test data:

```python
# Create project with multiple phases
project = create_project(
    name="Test Project",
    start_date="2024-01-01",
    end_date="2024-12-31"
)

# Create phases
create_phase(project_id, "Planning", "2024-01-01", "2024-03-31")
create_phase(project_id, "Development", "2024-04-01", "2024-09-30")
create_phase(project_id, "Testing", "2024-10-01", "2024-12-31")
```

## Cleanup

After testing:

1. Delete test projects if needed
2. Clear browser cache if issues persist
3. Reset database to known state if needed
4. Document any bugs found

## Bug Reporting Template

If you find a bug:

```
**Title:** [Brief description]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Environment:**
- Browser: [Chrome/Firefox/Safari]
- OS: [Windows/Mac/Linux]
- Backend version: [version]
- Frontend version: [version]

**Screenshots:**
[Attach screenshots if applicable]

**Console Errors:**
[Paste any console errors]

**Additional Context:**
[Any other relevant information]
```
