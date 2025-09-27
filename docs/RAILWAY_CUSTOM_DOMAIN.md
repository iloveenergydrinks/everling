# Setting Up Custom Domain (everling.io) on Railway

## Step 1: Add Custom Domain in Railway
1. Go to your Railway project dashboard
2. Click on your **everling** service
3. Go to **Settings** tab
4. Scroll to **Networking** section
5. Click **+ Custom Domain**
6. Enter `everling.io` (or `www.everling.io` if you prefer)
7. Railway will provide you with DNS records to add

## Step 2: Configure DNS Records
Railway will show you one of these options:

### Option A: CNAME Record (if using subdomain like www)
```
Type: CNAME
Name: www
Value: everling-production.up.railway.app
```

### Option B: A Records (if using root domain)
Railway will provide specific IP addresses, like:
```
Type: A
Name: @
Value: [Railway will provide IP]
```

## Step 3: Add DNS Records to Your Domain Provider
1. Go to your domain registrar (where you bought everling.io)
2. Find DNS settings/management
3. Add the records Railway provided
4. DNS propagation can take 5-30 minutes

## Step 4: Verify in Railway
1. Back in Railway, it will automatically detect when DNS is configured
2. Railway will provision an SSL certificate automatically
3. Your app will be accessible at `https://everling.io`

## Step 5: Environment Variables (if needed)
Add to Railway environment variables:
```
NEXTAUTH_URL=https://everling.io
```

## Benefits
- Your app runs at `https://everling.io` instead of Railway's subdomain
- Your existing Google OAuth settings for everling.io will work
- Professional appearance with your own domain
- Automatic SSL certificate from Railway

## Current Google OAuth Settings (Already Configured)
✅ Authorized JavaScript origins:
- `https://everling.io`
- `http://localhost:3000`

✅ Authorized redirect URIs:
- `https://everling.io/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`

Once you set up the custom domain, these will work automatically!
