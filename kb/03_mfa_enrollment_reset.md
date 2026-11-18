# SOP-03: Multi-Factor Authentication (MFA) Enrollment & Reset

## Overview
Use this procedure when a user gets a new phone, loses access to their authenticator app (Microsoft Authenticator / Okta Verify), stops receiving MFA push notifications, or sees "MFA token invalid."

## Resolution Steps
1. **Confirm User Identity**: Because MFA resets bypass a security factor, verify the user's identity via live video call with photo ID or manager approval in the ticketing system.
2. **Check Push Notifications**: If the user still has the old phone, ensure notifications are enabled for the authenticator app, battery saver is not blocking background data, and device time/date is set to **Automatic**.
3. **Use Manual OTP Code**: If push prompts fail to arrive, instruct the user to select **Use a verification code instead** and enter the 6-digit rolling TOTP code from the authenticator app.
4. **Reset MFA Registration**:
   - Open the IAM Admin Console and locate the user profile.
   - Select **Reset Multifactor Authentication** and revoke active refresh sessions.
   - Issue a Temporary Access Pass (TAP) valid for 60 minutes if needed.
5. **Re-enroll New Device**: Guide the user to `https://aka.ms/mfasetup` (or SSO Security Info), scan the QR code in the authenticator app, and approve a test prompt.

## Escalation Criteria
- Escalate to **L2 IAM / Security** if identity cannot be verified per policy, if the user's account shows suspicious MFA prompts from unknown countries, or if hardware FIDO2 YubiKey provisioning is required.
