# How to Find GOOGLE_CLIENT_SECRET

## Quick Steps:

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com
   - Make sure you're in the **churchgtp** project

2. **Navigate to Credentials**
   - Click "APIs & Services" in left menu
   - Click "Credentials"

3. **Find OAuth 2.0 Client IDs**
   - Look for "OAuth 2.0 Client IDs" section
   - If you see one listed, click the **pencil/edit icon** to view Client ID and Client secret

4. **If you don't have one, create it:**
   - Click "+ CREATE CREDENTIALS" button
   - Select "OAuth client ID"
   - Application type: **Web application**
   - Name: "Futures Pulse Resources" (or any name)
   - Authorized redirect URIs: `https://futures.pulse.com/api/google/callback`
   - Click "CREATE"
   - **IMPORTANT**: Copy the Client ID and Client secret immediately (the secret won't be shown again!)

5. **Copy the values:**
   - Client ID looks like: `123456789-abc123.apps.googleusercontent.com`
   - Client secret looks like: `GOCSPX-xxxxxxxxxxxxx` or just a long random string

## What to Update in Railway:

- `GOOGLE_CLIENT_ID` = Your OAuth Client ID
- `GOOGLE_CLIENT_SECRET` = Your OAuth Client Secret

**Note**: The Client ID you currently have (`108076784412235784668`) is from your service account, NOT the OAuth client. You need separate OAuth credentials for the Resources page to work.

