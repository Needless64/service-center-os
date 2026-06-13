# Fix Slot Duration and Lead Time Issues

## Issues Identified:

1. **Slot duration is 6 minutes** (showing 12:06, 12:12, 12:18...) instead of 60 minutes (12:00, 13:00, 14:00...)
2. **Lead time is 30 minutes** instead of required 1 hour (current IST time + 1 hour)
3. **11 AM slot showing at 11:13 AM** - should be filtered out with 1-hour lead time

## Root Causes:

1. Branch in Sanity database has `slotDurationMinutes: 6` instead of 60
2. `BOOKING_LEAD_MINUTES = 30` in slotHelper.ts (line 6) should be 60

## Tasks:

- [x] Create seed-branch.ts script to fix branch configuration in database
- [ ] Fix BOOKING_LEAD_MINUTES from 30 to 60 in slotHelper.ts
- [ ] Run seed-branch.ts to update branch with correct slotDurationMinutes: 60
- [ ] Verify the fix works correctly
