---
sme: Marcus Lee
sme_role: Platform Engineer
sme_email: m.lee@company.com
status: approved
version: "1.0"
last_updated: "2025-03-15"
---

## Overview

The verification outcome is recorded in the core platform and the customer onboarding process is notified to proceed or halt.

## Steps

1. Record outcome (approved / rejected) and reason code in the case system
2. Update applicant record in CRM with verification status
3. Send event to onboarding workflow (approved → continue to account setup, rejected → notify applicant)
4. Archive document images per retention policy (7 years)
