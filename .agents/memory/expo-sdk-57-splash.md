---
name: Expo SDK 57 splash configuration
description: Splash-screen configuration for Orbit Rush Mobile's Expo SDK 57 schema.
---

For Orbit Rush Mobile, configure the splash image and background through the `expo-splash-screen` plugin in static `app.json`; the current Expo schema rejects a top-level `splash` key.

**Why:** The generic Expo splash shape is not accepted by this project's Expo SDK 57 config validation, while the plugin config passes the compatibility check.

**How to apply:** When changing the mobile splash asset or background, edit the plugin options and run `CI=1 pnpm exec expo install --check` before restarting the Expo workflow.
