# SOP-10: Reporting Phishing & Suspicious Emails

## Overview
Use this procedure when an employee receives a suspicious email, unsolicited attachment, fake executive request, or accidentally clicks a malicious link or enters credentials on an untrusted site.

## Resolution Steps
1. **Do Not Interact Further**: Instruct the user NOT to reply to the sender, forward the email normally, open attachments, or click any additional links.
2. **Use the Report Phishing Button**:
   - In Microsoft Outlook (desktop, web, or mobile), select the message and click **Report Phishing** (or **Report Message > Phishing**) in the toolbar.
   - This automatically forwards headers to the Security Operations Center (SOC) and moves the message out of the Inbox.
3. **Assess Exposure**: Ask the user two critical questions:
   - Did you click any link inside the email?
   - Did you enter your username/password, approve an MFA prompt, or download/open an attachment?
4. **Immediate Containment (If Clicked or Credentials Entered)**:
   - Immediately reset the user's AD/SSO password per **SOP-01** and revoke all active SSO sessions.
   - Disconnect the laptop from the network (turn off Wi-Fi / unplug Ethernet) if an attachment was executed.

## Escalation Criteria
- **Immediately escalate as a P1/High-Priority Security Incident to SOC** if the user entered credentials, approved an unexpected MFA prompt, ran an attachment, or if the phishing campaign targets multiple employees.
