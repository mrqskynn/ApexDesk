# SOP-05: Corporate Email & Microsoft Outlook Setup

## Overview
Use this procedure when setting up corporate email in Microsoft Outlook (desktop or mobile), resolving "Disconnected" or "Need Password" status in Outlook, or fixing delayed mail sync.

## Resolution Steps
1. **Verify Webmail Access First**: Ask the user to sign in at `https://outlook.office.com` to confirm the mailbox is active and the issue is specific to the desktop/mobile client.
2. **Configure Outlook Desktop**:
   - Launch Outlook and enter the user's corporate email (`first.last@corp.example.com`).
   - Complete the SSO and MFA prompt when redirected to the corporate login window.
   - Wait 5-10 minutes for initial mailbox caching.
3. **Fix "Need Password" or Sync Stuck**:
   - In Outlook, go to **File > Account Settings** and sign out of stale accounts.
   - Close Outlook, open **Windows Credential Manager**, and remove cached `MicrosoftOffice16_Data` or `Outlook` entries.
   - Reopen Outlook and authenticate again.
4. **Create a Fresh Outlook Profile**: If crashes persist, open **Control Panel > Mail > Show Profiles**, add a new profile named `CorpProfile`, set it as default, and re-add the Exchange account.
5. **Mobile Email Setup**: Instruct users to install the **Microsoft Outlook** mobile app (native Mail apps are blocked by Conditional Access) and enroll via Intune Company Portal if prompted.

## Escalation Criteria
- Escalate to **L2 Messaging / Exchange Admins** if Outlook Web (`OWA`) fails with `500 Mailbox Not Found`, if shared mailbox permissions fail to propagate after 2 hours, or if mail flow rules are rejecting legitimate messages.
