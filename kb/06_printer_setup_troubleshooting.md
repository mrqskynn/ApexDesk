# SOP-06: Network Printer Setup & Print Queue Troubleshooting

## Overview
Use this procedure when an employee needs to add an office multifunction printer, print jobs are stuck in the queue, or badge/Follow-Me printing fails.

## Resolution Steps
1. **Confirm Network Connection**: Ensure the laptop is connected to the corporate office Wi-Fi (`CorpNet`) or wired Ethernet—not the `CorpGuest` network.
2. **Add Follow-Me Print Queue**:
   - Windows: Open **Settings > Bluetooth & devices > Printers & scanners > Add device**, or run `\\printsrv.corp.example.com\FollowMe-Color` from the Run dialog (`Win + R`).
   - macOS: Open **System Settings > Printers & Scanners > Add Printer**, select `FollowMe-Color` via IPP/AirPrint.
3. **Clear Stuck Print Jobs**:
   - Open the print queue window and cancel all stalled documents.
   - On Windows, restart the **Print Spooler** service (`services.msc` > Print Spooler > Restart) or run `net stop spooler && net start spooler` as an elevated user if available.
4. **Badge Release / Paper Jam Check**:
   - Verify the employee badge is registered by tapping it at the printer console and entering SSO credentials once to link the badge.
   - Check the printer LCD screen for paper jams, empty trays, or low toner alerts.

## Escalation Criteria
- Escalate to **Workplace Facilities / Hardware Support** if the printer displays a physical hardware error code (fuser error, maintenance kit required) or has no network link light.
- Escalate to **L2 Print Server Admins** if `printsrv.corp.example.com` is unreachable for multiple users on the floor.
