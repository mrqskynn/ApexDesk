# SOP-08: Slow Laptop Performance & High CPU/RAM Usage

## Overview
Use this procedure when an employee reports sluggish performance, frozen applications, loud cooling fans, or high CPU/memory utilization on a Windows or macOS laptop.

## Resolution Steps
1. **Check System Uptime & Pending Updates**:
   - Check uptime in Task Manager (Performance tab) or Activity Monitor. If uptime exceeds 7 days, instruct the user to perform a full **Restart** (not Sleep/Shut Down with Fast Startup).
   - Check **Windows Update** or **macOS Software Update** for pending reboots.
2. **Identify Resource-Heavy Processes**:
   - Windows: Open Task Manager (`Ctrl + Shift + Esc`), sort by **CPU** and **Memory**, and end hung browser tabs or duplicate helper processes.
   - macOS: Open **Activity Monitor** and quit non-responsive apps consuming >80% CPU.
3. **Check Free Disk Space**: Ensure at least **15% or 25 GB** of free SSD space is available; low disk space severely degrades virtual memory swapping. Clear `%TEMP%`, Downloads, and browser caches if disk is nearly full.
4. **Disable Unnecessary Startup Apps**: Open **Task Manager > Startup apps** (or macOS **Login Items**) and disable non-essential auto-launch tools.
5. **Run Hardware & Antivirus Quick Scan**: Confirm Endpoint Detection & Response (EDR) is not mid-full-scan and run built-in battery/thermal diagnostics if CPU stays throttled at 0.4 GHz.

## Escalation Criteria
- Escalate to **Desktop Support / Hardware** if disk usage remains at 100% with SMART warnings, battery is swollen/failing, free space cannot be recovered, or performance remains unusable after a clean reboot.
- Escalate to **SOC** if an unknown executable is consuming high CPU or making suspicious outbound connections.
