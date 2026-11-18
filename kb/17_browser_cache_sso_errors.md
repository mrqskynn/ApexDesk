# SOP-17: Browser Cache, Cookies & SSO SAML Login Errors

## Overview
Use this procedure when a user encounters infinite redirect loops, "AADSTS" / "SAML Response Invalid" errors, or broken internal web apps in Chrome or Edge.

## Resolution Steps
1. **Test in Incognito / Private Window**:
   - Open an Incognito (`Ctrl + Shift + N`) or InPrivate window and navigate to the app URL.
   - If login succeeds in Incognito, the issue is caused by stale cookies, cached sessions, or a conflicting browser extension.
2. **Clear Site Cookies & Cache**:
   - In Chrome/Edge, click the tune/lock icon left of the address bar -> **Cookies and site data** -> remove cookies for the affected app and `login.microsoftonline.com` / `sso.corp.example.com`.
   - Alternatively, open **Clear browsing data** (`Ctrl + Shift + Del`), select **Cached images and files** and **Cookies**, and clear for the last 7 days.
3. **Verify System Clock & Bookmarks**:
   - Confirm the system clock is accurate within 2 minutes (SAML assertions fail if local clock skew exceeds 5 minutes).
   - Ensure the user is accessing the app via the official SSO portal tile (`https://myapps.corp.example.com`), not an outdated deep-link bookmark.
4. **Disable Conflicting Extensions**: Temporarily disable ad-blockers or cookie blockers on `*.corp.example.com` and update the browser to the latest version.

## Escalation Criteria
- Escalate to **L2 IAM / Application Support** if the error persists in a clean Incognito window across multiple browsers (e.g., `AADSTS50105: User is not assigned to a role for the application` or expired SAML certificate).
