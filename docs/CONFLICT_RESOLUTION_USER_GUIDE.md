# Conflict Resolution User Guide

## What is a Conflict?

A conflict occurs when you try to save changes to something (like a portfolio, project, or resource assignment) that another user has already modified. This prevents your changes from accidentally overwriting someone else's work.

### Why Do Conflicts Happen?

Conflicts happen when:
1. You open a portfolio (for example)
2. Another user opens the same portfolio
3. The other user saves their changes first
4. You try to save your changes

The system detects that the portfolio has changed since you opened it and prevents your save to avoid losing the other user's work.

## What You'll See

When a conflict occurs, you'll see a dialog box with:

### Conflict Dialog

```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Update Conflict                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  This portfolio was modified by another user while  │
│  you were editing. Your changes have not been saved.│
│                                                      │
│  Your Changes:                                       │
│  • Name: "Digital Transformation 2024"              │
│  • Owner: "Jane Smith"                              │
│                                                      │
│  Current State (saved by other user):               │
│  • Name: "Digital Transformation Portfolio"         │
│  • Owner: "John Doe"                                │
│                                                      │
│  What would you like to do?                         │
│                                                      │
│  [ Refresh & Retry ]  [ Cancel ]                    │
└─────────────────────────────────────────────────────┘
```

### What the Dialog Shows

1. **Warning Message**: Explains that someone else modified the item
2. **Your Changes**: Shows what you tried to change
3. **Current State**: Shows what's currently saved (including the other user's changes)
4. **Action Buttons**: Options for what to do next

## How to Resolve Conflicts

You have two options when a conflict occurs:

### Option 1: Refresh & Retry (Recommended)

This option:
1. Loads the latest version of the item (with the other user's changes)
2. Keeps your changes in the form
3. Lets you review both sets of changes
4. Allows you to decide what to keep

**Steps:**
1. Click "Refresh & Retry"
2. Review the current state (what the other user changed)
3. Review your changes (still in the form)
4. Decide which changes to keep:
   - Keep your changes (overwrite the other user's work)
   - Keep their changes (discard your work)
   - Merge both (combine the changes)
5. Click "Save" again

**Example:**
```
Other user changed: Owner from "Jane Smith" to "John Doe"
You changed: Name from "Digital Transformation" to "Digital Transformation 2024"

After refresh:
- Owner shows "John Doe" (their change)
- Name shows "Digital Transformation 2024" (your change)

You can now save both changes together.
```

### Option 2: Cancel

This option:
1. Closes the conflict dialog
2. Discards your changes
3. Leaves the item as the other user saved it

**When to use:**
- You realize the other user's changes are correct
- Your changes are no longer needed
- You want to start over

## Common Scenarios

### Scenario 1: Simple Field Update

**Situation**: You and a colleague both update the same portfolio's description.

**What Happens**:
1. You both open the portfolio at 2:00 PM
2. Your colleague saves at 2:05 PM (changes description)
3. You try to save at 2:06 PM
4. Conflict dialog appears

**Resolution**:
1. Click "Refresh & Retry"
2. See your colleague's new description
3. Decide if you want to keep it or replace it with yours
4. Save again

### Scenario 2: Multiple Field Updates

**Situation**: You update a project's name while someone else updates its dates.

**What Happens**:
1. You both open the project
2. They save date changes
3. You try to save name changes
4. Conflict dialog appears

**Resolution**:
1. Click "Refresh & Retry"
2. See their date changes (keep these)
3. Your name change is still in the form (keep this too)
4. Save to apply both changes

### Scenario 3: Resource Assignment Calendar

**Situation**: You're updating multiple resource assignments, and someone else updates one of them.

**What Happens**:
1. You modify 10 assignments in the calendar
2. Someone else modifies 1 of those assignments
3. You click "Save All"
4. 9 assignments save successfully
5. 1 assignment shows a conflict

**Resolution**:
1. A dialog shows which assignments succeeded and which failed
2. For the failed assignment, you see:
   - What you tried to change
   - What the other user changed
3. Click "Retry Failed" to try again with the latest data
4. Or click "Cancel" to keep the other user's changes

## Best Practices

### To Avoid Conflicts

1. **Communicate**: Let your team know when you're editing shared items
2. **Work Quickly**: Don't leave items open for long periods
3. **Refresh Before Editing**: Reload the page before making changes
4. **Save Frequently**: Save your work often to reduce conflict windows

### When Conflicts Occur

1. **Don't Panic**: Conflicts are normal and your work is not lost
2. **Read Carefully**: Review both sets of changes before deciding
3. **Communicate**: Talk to the other user if needed
4. **Merge Thoughtfully**: Consider both users' intentions

### For Administrators

1. **Monitor Conflicts**: Check how often conflicts occur
2. **Identify Hotspots**: Find items that conflict frequently
3. **Adjust Workflows**: Consider splitting work to reduce conflicts
4. **Train Users**: Ensure users understand conflict resolution

## Frequently Asked Questions

### Q: Will my changes be lost?

**A**: No. When you click "Refresh & Retry", your changes remain in the form. You can review them and save again.

### Q: Can I see who made the other changes?

**A**: The system tracks who made changes, but this information is not currently shown in the conflict dialog. Check the audit log or ask your team.

### Q: What if I keep getting conflicts on the same item?

**A**: This means multiple people are editing it simultaneously. Coordinate with your team to avoid working on the same item at the same time.

### Q: Can I force my changes to save?

**A**: Yes. After clicking "Refresh & Retry", you can overwrite the other user's changes by saving again. However, this will discard their work, so use this carefully.

### Q: What happens if I click Cancel?

**A**: Your changes are discarded, and the item remains as the other user saved it. You'll need to start over if you want to make changes.

### Q: Do conflicts happen on all items?

**A**: Conflicts can occur on any item that multiple users can edit:
- Portfolios
- Programs
- Projects
- Project Phases
- Resources
- Resource Assignments
- Rates
- Actuals
- Users and Roles

### Q: How long do I have to resolve a conflict?

**A**: There's no time limit. The conflict dialog will stay open until you click a button. However, the longer you wait, the more likely someone else will make additional changes.

### Q: Can conflicts happen in bulk operations?

**A**: Yes. When updating multiple items at once (like in the Resource Assignment Calendar), some items may succeed while others conflict. The system will show you which items succeeded and which need attention.

## Technical Details (For Advanced Users)

### How Conflict Detection Works

The system uses "optimistic locking" with version numbers:

1. Each item has a version number (starts at 1)
2. When you open an item, you receive its current version
3. When you save, you send that version number back
4. The system checks: does the version match?
   - **Yes**: Save succeeds, version increments
   - **No**: Conflict detected, save fails

### Version Numbers

You might see version numbers in the UI or API responses:

```json
{
  "id": "123",
  "name": "My Portfolio",
  "version": 5
}
```

The version number tells you how many times the item has been updated:
- Version 1: Original (never updated)
- Version 5: Updated 4 times

### API Responses

If you're using the API directly, conflicts return HTTP status code 409:

```json
{
  "detail": {
    "error": "conflict",
    "message": "The portfolio was modified by another user...",
    "current_state": { ... }
  }
}
```

## Examples with Screenshots

### Example 1: Portfolio Name Conflict

**Before Conflict:**
```
You see:
┌─────────────────────────────┐
│ Edit Portfolio              │
├─────────────────────────────┤
│ Name: Digital Transform     │
│ Owner: Jane Smith           │
│                             │
│ [Save] [Cancel]             │
└─────────────────────────────┘

You change name to: "Digital Transformation 2024"
```

**After Conflict:**
```
You see:
┌─────────────────────────────────────────────────────┐
│  ⚠️  Update Conflict                                │
├─────────────────────────────────────────────────────┤
│  Your Changes:                                       │
│  • Name: "Digital Transformation 2024"              │
│                                                      │
│  Current State:                                      │
│  • Name: "Digital Transformation Portfolio"         │
│  • Owner: "John Doe" (also changed!)                │
│                                                      │
│  [ Refresh & Retry ]  [ Cancel ]                    │
└─────────────────────────────────────────────────────┘
```

**After Refresh & Retry:**
```
Form now shows:
┌─────────────────────────────┐
│ Edit Portfolio              │
├─────────────────────────────┤
│ Name: Digital Transform...  │  ← Your change still here
│ Owner: John Doe             │  ← Their change loaded
│                             │
│ [Save] [Cancel]             │
└─────────────────────────────┘

You can now save both changes together.
```

### Example 2: Resource Assignment Bulk Update

**Before Conflict:**
```
Calendar view showing 10 assignments:
┌────────────────────────────────────────┐
│ Resource Assignment Calendar           │
├────────────────────────────────────────┤
│ Assignment 1: 50% capital, 50% expense │ ← You modified
│ Assignment 2: 60% capital, 40% expense │ ← You modified
│ Assignment 3: 70% capital, 30% expense │ ← You modified
│ ...                                    │
│ Assignment 10: 80% capital, 20% expense│ ← You modified
│                                        │
│ [Save All]                             │
└────────────────────────────────────────┘
```

**After Conflict:**
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Bulk Update Results                            │
├─────────────────────────────────────────────────────┤
│  ✓ 9 assignments saved successfully                 │
│  ✗ 1 assignment failed (conflict)                   │
│                                                      │
│  Failed Assignment:                                  │
│  • Assignment 2                                      │
│  • Your change: 60% capital, 40% expense            │
│  • Current state: 55% capital, 45% expense          │
│                                                      │
│  [ Retry Failed ]  [ Cancel ]                       │
└─────────────────────────────────────────────────────┘
```

## Getting Help

If you're having trouble with conflicts:

1. **Check this guide**: Review the scenarios and best practices
2. **Ask your team**: They may know who made the conflicting changes
3. **Contact support**: If conflicts happen frequently or seem wrong
4. **Check the audit log**: See the history of changes to an item

## Summary

**Remember:**
- Conflicts protect your work and others' work
- Your changes are not lost when a conflict occurs
- "Refresh & Retry" lets you merge changes
- Communication with your team prevents conflicts

Conflicts are a normal part of collaborative work. The system is designed to help you resolve them quickly and safely.
