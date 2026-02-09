# Resource Assignment Migration - Quick Reference

## Migration Summary

**Migration ID:** `7c6a22c3f524`  
**Type:** Breaking Change  
**Impact:** Database schema, Backend API, Frontend

## Quick Commands

### Run Migration
```bash
cd backend
alembic upgrade head
```

### Verify Migration
```bash
alembic current  # Should show: 7c6a22c3f524
python verify_assignment_migration.py
```

### Rollback Migration
```bash
cd backend
alembic downgrade -1
```

## What Changed

| Before | After |
|--------|-------|
| `allocation_percentage` column exists | Column removed |
| `capital + expense = 100` | `capital + expense <= 100` |
| Single project validation | Cross-project validation |

## Schema Changes

### Removed
- ❌ Column: `allocation_percentage`
- ❌ Constraint: `check_accounting_split`

### Added
- ✅ Constraint: `check_allocation_sum`

### Preserved
- ✓ Column: `capital_percentage`
- ✓ Column: `expense_percentage`
- ✓ All existing data

## Validation Checklist

- [ ] Database backup completed
- [ ] Migration applied successfully
- [ ] Schema changes verified
- [ ] Data integrity confirmed
- [ ] API starts without errors
- [ ] Sample requests work
- [ ] Frontend loads correctly

## Rollback Checklist

- [ ] Application stopped
- [ ] Downgrade executed
- [ ] Schema restored
- [ ] Data verified
- [ ] Previous code deployed
- [ ] Application restarted

## Common Issues

### Migration Fails
**Check:** Existing data violates new constraint  
**Fix:** Query and fix data before migration

### API Fails to Start
**Check:** Code still references `allocation_percentage`  
**Fix:** Verify all code changes deployed

### Tests Fail
**Check:** Test database not migrated  
**Fix:** Run `alembic upgrade head` on test database

## Support

- **Full Guide:** `backend/docs/RESOURCE_ASSIGNMENT_MIGRATION_GUIDE.md`
- **Spec Docs:** `.kiro/specs/resource-assignment-refactor/`
- **Migration File:** `backend/alembic/versions/7c6a22c3f524_remove_allocation_percentage_from_.py`
