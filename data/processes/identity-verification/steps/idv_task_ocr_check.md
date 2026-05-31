---
sme: Priya Nair
sme_role: Compliance Officer
sme_email: p.nair@company.com
status: approved
version: "1.1"
last_updated: "2025-03-20"
---

## Overview

The submitted documents are scanned using OCR to extract key fields (name, DOB, document number, expiry) and compared against the application form data.

## Process

1. System receives document images from the onboarding portal
2. OCR engine extracts fields and confidence scores
3. Extracted data is compared to application form fields
4. If confidence score > 90% and data matches — auto-pass
5. If confidence score < 90% or data mismatch — escalate to manual review

## Acceptance criteria

- Name match (fuzzy, ≥ 95% similarity)
- DOB exact match
- Document not expired
- Document type accepted (passport or driver's licence)
