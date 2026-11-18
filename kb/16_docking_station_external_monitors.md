# SOP-16: Docking Station & External Monitor Troubleshooting

## Overview
Use this procedure when external monitors connected via a USB-C / Thunderbolt docking station show "No Signal", flicker, or fail to charge the laptop or recognize USB peripherals.

## Resolution Steps
1. **Verify Physical Cables & Power**:
   - Confirm the docking station's own AC power brick is firmly plugged into a live wall outlet (not just powered by the laptop).
   - Check that the USB-C / Thunderbolt cable is plugged into the **upstream host port** on the dock and a Thunderbolt/DisplayPort-capable USB-C port on the laptop.
2. **Power Cycle the Dock (Hard Reset)**:
   - Unplug the dock from the laptop and disconnect the dock's AC power cable for 30 seconds.
   - Reconnect AC power first, wait 10 seconds, then plug the USB-C cable back into the laptop.
3. **Verify Display Settings & Input Source**:
   - Press `Win + P` (Windows) and select **Extend**, or check **System Settings > Displays** (macOS).
   - On the monitor itself, use the physical OSD buttons to verify the active input matches the connected cable (DisplayPort vs. HDMI).
4. **Update Dock Firmware & Graphics Drivers**: Run **Dell Command | Update / Lenovo Vantage / Windows Update** to install pending Thunderbolt and DisplayLink drivers, then reboot.

## Escalation Criteria
- Escalate to **Desktop Support / Facilities** if a monitor remains dead when tested directly with a known-good HDMI/USB-C cable, or if the dock emits heat/burning odor or fails across multiple laptops.
