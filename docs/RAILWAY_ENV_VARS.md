# Required Environment Variables for Production

## Critical: Set NEXTAUTH_URL in Railway

**In Railway Dashboard:**
1. Go to your **everling** service
2. Click on **Variables** tab
3. Add these environment variables:

```
NEXTAUTH_URL=https://everling.io
```

This tells NextAuth to use your custom domain for all callbacks, regardless of the actual URL Railway is using.

## Why This Matters
- Without `NEXTAUTH_URL`, NextAuth auto-detects the URL from the request
- On Railway, it would detect `everling-production.up.railway.app`
- This causes the redirect_uri_mismatch error
- Setting `NEXTAUTH_URL=https://everling.io` forces NextAuth to use your domain

## Other Required Environment Variables
Make sure you also have:
- `NEXTAUTH_SECRET` (generate with: openssl rand -base64 32)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` (your PostgreSQL connection string)
- All your other API keys (Postmark, Twilio, etc.)

## Two-Step Solution:

### Step 1: Set NEXTAUTH_URL (Immediate)
Add `NEXTAUTH_URL=https://everling.io` to Railway variables NOW.
This might help even before setting up the custom domain.

### Step 2: Configure Custom Domain (Recommended)
Set up everling.io as a custom domain on Railway so your app actually runs at that URL.

## Testing
After setting `NEXTAUTH_URL`:
1. Railway will automatically redeploy
2. Try Google login again
3. The callback URL should now be `https://everling.io/api/auth/callback/google`
4. This matches your Google OAuth configuration!
