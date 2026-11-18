# SOP-15: Mobile Device Management (Intune MDM) Enrollment

## Overview
Use this procedure when an employee wants to access corporate email, Teams, or Slack on a company-issued or BYOD iOS/Android phone and needs Intune Company Portal enrollment.

## Resolution Steps
1. **Confirm Device Eligibility**:
   - OS must be supported (iOS 16+ or Android 13+, un-jailbroken and un-rooted).
   - Device must have a 6-digit PIN/passcode or biometric lock enabled.
2. **Install Company Portal**:
   - Direct the user to download **Intune Company Portal** from the Apple App Store or Google Play Store.
3. **Enroll the Device**:
   - Open Company Portal and sign in with corporate email (`first.last@corp.example.com`) and MFA.
   - Follow prompts to install the **Management Profile** (iOS: **Settings > General > VPN & Device Management > Install**) or create the **Android Work Profile**.
4. **Wait for Compliance Sync**:
   - Allow 5-10 minutes for compliance checks (OS version, passcode, encryption) to turn green in Company Portal.
   - Open **Microsoft Outlook** or **Teams** and sign in once compliance shows **In Compliance**.

## Escalation Criteria
- Escalate to **L2 Mobile / Endpoint Engineering** if enrollment fails with `Device Limit Reached`, `Error 0x80180014`, or a non-compliant status that persists after updating OS and passcode settings.
