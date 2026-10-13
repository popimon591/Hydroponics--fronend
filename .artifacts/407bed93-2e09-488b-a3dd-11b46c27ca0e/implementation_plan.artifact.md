# Implementation Plan - Smart Alerts & Summary Parameters

This plan addresses the flickering issue, adds real-time notifications for alarms, and exposes "Daily Light Hours" and "DLI" as summary parameters in the UI.

## User Review Required

> [!TIP]
> **Silent Updates**: I will change the app to refresh numbers in the background without any flickering or loading spinners.
> **Summary Parameters**: I will add "Daily Light Hours" and "DLI" to your device dashboard. These will show you how much light your plants have received throughout the day.
> **Notifications**: A popup will appear at the top of your screen as soon as a new critical alarm is detected.

## Proposed Changes

### 1. Frontend: Expose Summary Parameters
#### [MODIFY] [telemetry.js](file:///D:/siya-projects/Hydro-Project2/Hydroponics--fronend/src/lib/telemetry.js)
- Add `daily_light_hours` and `daily_dli` to the `ATTRIBUTES` array.
- Assign appropriate units (`hrs` and `mol/m²/d`) and target ranges for these summaries.

### 2. Frontend: Fix Flickering (Silent Refresh)
#### [MODIFY] [Readings.jsx](file:///D:/siya-projects/Hydro-Project2/Hydroponics--fronend/src/pages/Readings.jsx)
- Modify `loadReadings` to be "silent" during automatic intervals.
- The user will only see a loading state on the very first visit to the page.

#### [MODIFY] [DevicesDashboard.jsx](file:///D:/siya-projects/Hydro-Project2/Hydroponics--fronend/src/pages/DevicesDashboard.jsx)
- Implement silent background polling for the device list and alarms.

### 3. Frontend: Real-Time Alarm Notifications
#### [MODIFY] [DevicesDashboard.jsx](file:///D:/siya-projects/Hydro-Project2/Hydroponics--fronend/src/pages/DevicesDashboard.jsx)
- Compare current alarms with previous ones in each poll.
- Trigger a `toast.error()` or `toast.warning()` when a new alarm is found.

## Verification Plan

### Automated Tests
- Verify that `ATTRIBUTES` contains the new summary keys.
- Ensure polling logic does not reset the `refreshing` state to true.

### Manual Verification
- **Visual Check**: Verify "Daily Light Hours" appears in the sensor grid for a device.
- **Refresh Check**: Verify the app updates numbers every 30 seconds without the screen flickering.
- **Notification Check**: Simulate an alarm and verify the popup appears instantly.
