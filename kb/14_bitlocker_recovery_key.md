# SOP-14: BitLocker & FileVault Disk Encryption Recovery

## Overview
Use this procedure when a Windows laptop prompts for a 48-digit BitLocker recovery key on startup, or a macOS laptop requests a FileVault recovery key after an OS update or hardware change.

## Resolution Steps
1. **Verify User & Device Ownership**: Confirm the employee's identity (corporate ID + manager confirmation or live video check) and obtain the laptop's **Asset Tag / Serial Number** or the **Recovery Key ID** (first 8 characters shown on the BitLocker screen).
2. **Check Common Causes**: Ask if a USB dock/drive was plugged in during boot or a BIOS/UEFI firmware update just ran. Removing an external USB device and rebooting once often resolves false triggers.
3. **Retrieve Recovery Key**:
   - For Windows (BitLocker): Look up the device in **Microsoft Intune / Entra ID > Devices > Recovery keys** matching the 8-character Key ID.
   - For macOS (FileVault): Look up the personal recovery key stored in **Jamf Pro > Computer Inventory > Security**.
4. **Read Key Safely & Verify Boot**: Provide the recovery key over a verified channel (live call or approved secondary contact), have the user enter it, and confirm the OS boots cleanly to the desktop.
5. **Rotate Recovery Key**: Trigger a BitLocker/FileVault recovery key rotation in Intune/Jamf after successful unlock.

## Escalation Criteria
- Escalate to **L2 Endpoint Engineering** if no recovery key is recorded in Intune/Jamf or the drive fails to unlock with the matching Key ID.
- Escalate to **SOC** if BitLocker triggered unexpectedly alongside signs of physical tampering.
