---
sme: Marcus Lee
sme_role: Platform Engineer
sme_email: m.lee@company.com
status: approved
version: "1.2"
last_updated: "2025-04-10"
---

## Overview

Once identity is verified, the customer account is provisioned in the core platform and all downstream systems are notified.

## Provisioning steps

1. Create account record in CRM (auto — triggered by IDV approval event)
2. Assign customer ID and account number
3. Provision portal access — welcome email sent with temporary credentials
4. Sync record to billing system
5. Notify the assigned relationship manager

## System integrations

| System | Action | Owner |
|--------|--------|-------|
| CRM | Create contact + account | Platform |
| Billing | Create billing profile | Finance Ops |
| Portal | Send welcome email | Comms |

## Verification

After setup, run the account health check script to confirm all integrations succeeded. Flag any failures to Platform Engineering via the `#onboarding-ops` channel.
