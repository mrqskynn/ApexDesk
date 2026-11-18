# SOP-09: Network Shared Drive & SharePoint Access

## Overview
Use this procedure when a user cannot access a departmental network drive (`S:\`, `P:\`), receives "Access Denied" on SharePoint/OneDrive folders, or needs mapped drives restored.

## Resolution Steps
1. **Verify VPN / Corporate Network**: On-premises SMB shares (`\\filesrv.corp.example.com\...`) require the user to be on the office network or connected to the corporate VPN.
2. **Confirm Group Membership & Approval**:
   - Identify the exact UNC path or SharePoint site URL and whether **Read-Only** or **Read/Write** access is requested.
   - Check if the user is a member of the corresponding AD security group or SharePoint group.
   - If the user lacks access, obtain written approval from the folder/data owner or department manager before granting permissions.
3. **Remap Network Drive (Windows)**:
   - Open File Explorer -> **This PC > Map network drive**.
   - Choose the standard drive letter, enter `\\filesrv.corp.example.com\<share>`, and check **Reconnect at sign-in**.
4. **Refresh Kerberos / SharePoint Session**: Have the user run `klist purge` (or sign out and back in to Office 365) after a new permission group is added, as group tokens update on next authentication.

## Escalation Criteria
- Escalate to **L2 Storage / SharePoint Admins** if the user is already in the correct AD/SharePoint group after re-authenticating and still gets `Access Denied`, or if a file share appears offline for an entire department.
