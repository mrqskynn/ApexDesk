# SOP-07: Corporate Wi-Fi (CorpNet) & Guest Network Troubleshooting

## Overview
Use this procedure when an employee's corporate laptop cannot connect to `CorpNet`, repeatedly prompts for a Wi-Fi password, or connects without internet access.

## Resolution Steps
1. **Verify Correct SSID**:
   - Corporate-managed laptops must connect to **`CorpNet`** (802.1X certificate/SSO auth).
   - Personal devices and visitors must use **`CorpGuest`** and accept the captive portal terms.
2. **Toggle Wi-Fi & Forget Network**:
   - Turn Wi-Fi off for 10 seconds, then back on.
   - Right-click `CorpNet` -> **Forget**, then reconnect so the laptop re-negotiates its machine certificate.
3. **Check IP & DNS Configuration**:
   - Run `ipconfig /all` (Windows) or check **System Settings > Network** (macOS) to confirm a valid corporate DHCP IP (`10.x.x.x`), not a self-assigned `169.254.x.x` address.
   - Run `ipconfig /release && ipconfig /renew` if an invalid IP is assigned.
4. **Verify System Clock & Certificate**: Ensure system date/time are accurate; a skewed clock causes 802.1X RADIUS certificate validation to fail.
5. **Run Network Reset**: If drivers appear hung, run Windows **Network Reset** or test with a USB-C Ethernet adapter to isolate Wi-Fi hardware vs. switch port issues.

## Escalation Criteria
- Escalate to **L2 Network Infrastructure** if multiple employees in the same room/floor lose `CorpNet` connectivity (suspected access point or RADIUS outage).
- Escalate to **Desktop Support** if Wi-Fi adapter shows `Code 10` / hardware failure in Device Manager.
