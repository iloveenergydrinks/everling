# Fix Google OAuth for Production (Railway)

## The Issue
Google OAuth is trying to redirect to your Railway production URL but it's not in your authorized redirect URIs list.

## Solution - Add these URIs to Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID (Everling.io)
5. Add these to **Authorized redirect URIs**:
   ```
   https://everling-production.up.railway.app/api/auth/callback/google
   ```
6. Also add to **Authorized JavaScript origins**:
   ```
   https://everling-production.up.railway.app
   ```

## Your Current Settings
You currently have:
- Authorized JavaScript origins:
  - https://everling.io
  - http://localhost:3000
- Authorized redirect URIs:
  - https://everling.io/api/auth/callback/google
  - http://localhost:3000/api/auth/callback/google

## What You Need to Add
Add these additional URIs:
- Authorized JavaScript origins:
  - **https://everling-production.up.railway.app** (Railway production)
- Authorized redirect URIs:
  - **https://everling-production.up.railway.app/api/auth/callback/google** (Railway production)

## Optional: Custom Domain
If you want to use everling.io as your custom domain on Railway:
1. Set up custom domain in Railway settings
2. Update your DNS records to point to Railway
3. Then your existing Google OAuth settings for everling.io will work

## After Adding the URIs
1. Click **Save** in Google Cloud Console
2. Wait a few minutes for changes to propagate
3. Try signing in with Google again from your Railway app

The error should be resolved!
