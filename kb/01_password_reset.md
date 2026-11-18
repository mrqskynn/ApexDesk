# SOP-01: Active Directory & SSO Password Reset

## Overview
Use this procedure when an employee forgets their Active Directory (AD) / Single Sign-On (SSO) password, receives an "Invalid credentials" or "Password expired" error, or needs to perform a voluntary password rotation.

## Resolution Steps
1. **Verify Identity**: Confirm the user's full name, employee ID, and corporate username (`first.last@corp.example.com`) before initiating any reset.
2. **Self-Service Portal (SSPR)**: Direct the user to `https://password.corp.example.com` and click **Forgot Password**.
3. **Complete MFA Verification**: Have the user verify via their registered authenticator push notification or backup SMS code.
4. **Set New Password**: Ensure the new password meets complexity requirements:
   - Minimum 14 characters
   - At least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character
   - Must not match the last 12 passwords or contain the user's name
5. **Re-sync Cached Credentials (Remote Users)**: If off-site, instruct the user to connect to the corporate VPN after resetting, then lock (`Win + L`) and unlock Windows using the new password to update cached credentials.
6. **Verify Access**: Confirm the user can sign in to SSO, Outlook, and Windows without errors.

## Escalation Criteria
- Escalate to **L2 Identity & Access Management (IAM)** if the user has no active MFA device enrolled or SSPR returns a directory sync error (`AD-SYNC-409`).
- Escalate immediately to **Security Operations (SOC)** if the user reports unauthorized password change notifications they did not initiate.
