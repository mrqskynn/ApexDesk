# SOP-11: Active Directory Account Lockout Resolution

## Overview
Use this procedure when a user sees "The referenced account is currently locked out and may not be logged on to" after 5 failed login attempts within 15 minutes.

## Resolution Steps
1. **Verify Identity**: Confirm the caller's employee ID and username before unlocking any corporate account.
2. **Identify Lockout Source**:
   - Check the IAM / AD Lockout Status dashboard to see which device or IP triggered the bad-password attempts.
   - Common causes include stale passwords saved on a mobile phone, cached credentials in Windows Credential Manager, or an open Remote Desktop / mapped drive session after a recent password change.
3. **Unlock the Account**:
   - Wait 15 minutes for automatic unlock, OR manually unlock the account in Active Directory / Okta after identity verification.
4. **Prevent Immediate Re-Lockout**:
   - Have the user update their password in Outlook Mobile / Teams Mobile / Wi-Fi settings on personal devices if saved.
   - On Windows, clear stale entries in **Control Panel > Credential Manager > Windows Credentials** and restart the laptop while on VPN or office network.

## Escalation Criteria
- Escalate to **SOC** if lockouts originate from unfamiliar external IP addresses or continue immediately after unlocking and clearing local cached credentials (possible brute-force or password spray attack).
