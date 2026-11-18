# SOP-12: New Hire IT Equipment & Account Onboarding

## Overview
Use this procedure for onboarding a new employee's IT accounts, laptop setup, SSO activation, and first-day access checks.

## Resolution Steps
1. **Verify HR Onboarding Record**: Confirm the new hire's start date, manager, department, and assigned equipment shipment tracking in the IT Asset system (at least 3 business days prior to start date).
2. **Verify Account Provisioning**:
   - Confirm Active Directory, SSO (Okta/Entra ID), Corporate Email (Exchange Online), Slack/Teams, and baseline role-based groups are provisioned.
   - Verify temporary onboarding credentials / activation link were sent to the new hire's personal email or manager.
3. **First-Login Setup**:
   - Walk the new hire through setting their permanent password (minimum 14 characters) and enrolling in MFA (**SOP-03**).
   - Confirm laptop MDM enrollment completes (Windows Autopilot / macOS Jamf DEP) and FileVault/BitLocker encryption is active.
4. **Verify Core Tools**: Test Outlook email, Slack/Teams messaging, corporate VPN connection, and standard department apps.

## Escalation Criteria
- Escalate to **HR People Ops / IAM** if the employee record is missing from the HRIS feed or has an incorrect department/manager assignment.
- Escalate to **IT Asset Management** if the laptop has not shipped or arrived damaged.
