# SOP-04: Standard & Licensed Software Access Requests

## Overview
Use this procedure when an employee requests installation of software or access to a SaaS application (e.g., Slack, VS Code, Figma, Adobe Creative Cloud, Jira, Tableau).

## Resolution Steps
1. **Check Self-Service App Store**:
   - Windows: Open **Company Portal** and search for the approved application.
   - macOS: Open **Self Service** and check if the app is available for one-click install.
2. **Classify the Request**:
   - **Standard Freeware** (VS Code, Chrome, Zoom, 7-Zip): Can be installed directly via Company Portal / Self Service without manager approval.
   - **Paid / Licensed Software** (Adobe CC, Figma Editor, Tableau Creator, JetBrains): Requires manager approval and cost-center verification.
3. **Submit Access Ticket**: If the app requires a license or SSO group assignment, create a ticket with:
   - Software name and version/tier required
   - Business justification
   - Direct manager's name/email for approval
4. **Provision After Approval**: Once manager approval is recorded, add the user to the corresponding AD/Okta entitlement group and notify the user to sign out and back in to refresh SSO tiles.

## Escalation Criteria
- Escalate to **Security Architecture** if the user requests unapproved third-party software, browser extensions requiring broad permissions, or local administrator rights.
- Escalate to **IT Procurement** if all seat licenses in the pool are exhausted.
