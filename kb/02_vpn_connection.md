# SOP-02: Corporate VPN Connection & Troubleshooting

## Overview
Use this procedure when a remote employee cannot connect to the corporate VPN (GlobalProtect / Cisco AnyConnect), experiences frequent disconnects, or cannot reach internal intranet resources while connected.

## Resolution Steps
1. **Check Local Internet**: Ask the user to verify basic internet connectivity by loading a public website (e.g., `https://status.corp.example.com`). Hotel or airport captive portals must be accepted before launching the VPN.
2. **Select the Nearest Gateway**: Open the VPN client, click **Change Gateway**, and choose the closest regional endpoint (`us-east-vpn`, `us-west-vpn`, or `eu-central-vpn`).
3. **Refresh VPN Client & SSO Token**:
   - Click **Disconnect** and **Sign Out** in the VPN client.
   - Completely quit the client from the system tray/menu bar, reopen it, and click **Connect**.
   - Approve the MFA push prompt within 60 seconds.
4. **Flush DNS & Reset Adapter**: If connected but internal sites fail to load:
   - Windows: Run `ipconfig /flushdns` in Command Prompt.
   - macOS: Run `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.
5. **Test Alternative Network**: Have the user test via a mobile hotspot to rule out ISP or home router firewall blocks on UDP port 4501 / TCP port 443.

## Escalation Criteria
- Escalate to **L2 Network Engineering** if the user receives `Certificate Validation Failed`, `Error 789`, or if multiple users report outages on the same VPN gateway.
- Escalate to **Endpoint Engineering** if the virtual VPN network adapter is missing or corrupted after a client restart.
