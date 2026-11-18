# SOP-18: Lost or Stolen Corporate Laptop or Mobile Device

## Overview
Use this urgent procedure immediately when an employee reports a lost, misplaced, or stolen corporate laptop, smartphone, tablet, or hardware security key (YubiKey).

## Resolution Steps
1. **Treat as High Priority Security Incident**: Gather the following details immediately:
   - Employee name, username, and callback phone number
   - Device type, asset tag/serial number (check Asset Inventory if unknown)
   - Approximate time and location the device was last seen (e.g., airport, rideshare, hotel, office)
   - Whether a police report has been filed (required for theft)
2. **Lock Account & Revoke Active Sessions**:
   - Immediately revoke all active SSO refresh tokens and disable/suspend the user's AD/SSO sessions until a new device or verified rotation occurs.
   - Deactivate any lost FIDO2 hardware key in the IAM console.
3. **Trigger Remote Lock / Wipe**:
   - In **Microsoft Intune** or **Jamf Pro**, issue an immediate **Remote Lock** (and **Remote Wipe** if theft is confirmed or per SOC instruction).
   - Confirm full-disk encryption (BitLocker / FileVault) status is recorded as compliant in MDM.
4. **Log Security Ticket & Arrange Replacement**: Create an urgent ticket linked to SOC and initiate replacement hardware dispatch with IT Asset Management.

## Escalation Criteria
- **Mandatory immediate escalation to Security Operations (SOC)** on ALL lost or stolen device reports—do not delay containment waiting for manager approval.
