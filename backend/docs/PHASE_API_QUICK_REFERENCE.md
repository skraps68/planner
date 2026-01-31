# Phase API Quick Reference

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/phases/batch` | Batch update all phases (primary endpoint) |
| `GET` | `/projects/{id}/phases` | List all phases for a project |
| `GET` | `/phases/{id}` | Get a specific phase |
| `POST` | `/projects/{id}/phases/validate` | Validate phases without saving |
| `GET` | `/phases/{id}/assignments` | Get assignments for a phase |

## Validation Rules

### Timeline Continuity
- ✅ Phases must cover entire project timeline (start to end)
- ✅ No gaps between phases
- ✅ No overlaps between phases
- ✅ First phase starts at project start date
- ✅ Last phase ends at project end date

### Phase Constraints
- ✅ `start_date` ≤ `end_date`
- ✅ Phase dates within project dates
- ✅ Name: 1-100 characters
- ✅ Budgets ≥ 0
- ✅ `total_budget` = `capital_budget` + `expense_budget`

### Deletion Rules
- ❌ Cannot delete if it creates a gap
- ❌ Cannot delete the last phase

## Common Operations

### Create Multi-Phase Project

```bash
POST /api/v1/projects/{project_id}/phases/batch
{
  "phases": [
    {
      "id": null,
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31",
      "capital_budget": 50000,
      "expense_budget": 25000,
      "total_budget": 75000
    },
    {
      "id": null,
      "name": "Execution",
      "start_date": "2024-04-01",
      "end_date": "2024-12-31",
      "capital_budget": 150000,
      "expense_budget": 75000,
      "total_budget": 225000
    }
  ]
}
```

### Update Phase Dates

```bash
POST /api/v1/projects/{project_id}/phases/batch
{
  "phases": [
    {
      "id": "{existing_phase_id}",
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-04-30",  // Extended
      ...
    },
    {
      "id": "{existing_phase_id}",
      "name": "Execution",
      "start_date": "2024-05-01",  // Adjusted
      "end_date": "2024-12-31",
      ...
    }
  ]
}
```

### Validate Before Saving

```bash
POST /api/v1/projects/{project_id}/phases/validate
[
  {
    "id": null,
    "name": "Planning",
    "start_date": "2024-01-01",
    "end_date": "2024-03-31"
  },
  {
    "id": null,
    "name": "Execution",
    "start_date": "2024-04-01",
    "end_date": "2024-12-31"
  }
]

Response:
{
  "is_valid": true,
  "errors": []
}
```

## Error Responses

| Status | Error | Cause |
|--------|-------|-------|
| `404` | Project not found | Invalid project_id |
| `404` | Phase not found | Invalid phase_id |
| `422` | Gap detected | Phases don't cover all dates |
| `422` | Overlap detected | Phases have overlapping dates |
| `422` | Boundary violation | Phase dates outside project dates |
| `422` | Invalid date order | start_date > end_date |
| `422` | Budget mismatch | total ≠ capital + expense |

## Validation Error Examples

### Gap Error
```json
{
  "is_valid": false,
  "errors": [
    {
      "field": "timeline",
      "message": "Gap detected between Planning and Execution",
      "phase_id": null
    }
  ]
}
```

### Overlap Error
```json
{
  "is_valid": false,
  "errors": [
    {
      "field": "timeline",
      "message": "Overlap detected between Development and Testing",
      "phase_id": null
    }
  ]
}
```

### Boundary Error
```json
{
  "is_valid": false,
  "errors": [
    {
      "field": "start_date",
      "message": "Phase dates must fall within project dates (2024-01-01 to 2024-12-31)",
      "phase_id": "uuid"
    }
  ]
}
```

## Default Phase Behavior

### Auto-Creation
When a project is created, a "Default Phase" is automatically created:
- Name: "Default Phase"
- Start: Project start date
- End: Project end date
- Budgets: All zero

### Auto-Sync
If only the default phase exists and project dates change, the phase dates automatically sync.

Once additional phases are created, auto-sync stops.

## Date-Based Relationships

Assignments are implicitly associated with phases by date:

```sql
-- Get assignments for a phase
SELECT * FROM resource_assignments
WHERE project_id = phase.project_id
  AND assignment_date >= phase.start_date
  AND assignment_date <= phase.end_date
```

**Benefits:**
- No foreign key needed
- Assignments move with phase date changes
- Flexible phase reorganization

## Best Practices

### Frontend
1. ✅ Always use batch update endpoint
2. ✅ Validate before saving
3. ✅ Display validation errors inline
4. ✅ Auto-adjust adjacent phases for continuity
5. ✅ Confirm before deleting phases

### Backend
1. ✅ Use date-based queries for assignments
2. ✅ Cache phase data for read-heavy workloads
3. ✅ Validate early in request processing
4. ✅ Wrap operations in transactions
5. ✅ Log all phase modifications

## Migration

To migrate from old enum-based phases:

```bash
cd backend
alembic upgrade head
```

See [PHASE_MIGRATION_RUNBOOK.md](./PHASE_MIGRATION_RUNBOOK.md) for details.

## Resources

- **Full Documentation**: [PHASE_API.md](./PHASE_API.md)
- **Migration Guide**: [PHASE_MIGRATION_RUNBOOK.md](./PHASE_MIGRATION_RUNBOOK.md)
- **Interactive Docs**: `http://localhost:8000/docs`
- **API Index**: [API_DOCUMENTATION_INDEX.md](./API_DOCUMENTATION_INDEX.md)
