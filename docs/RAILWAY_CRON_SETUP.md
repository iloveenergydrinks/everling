# 🚂 Railway Cron Setup for Maintenance Tasks

## Option 1: Railway Cron Service (Recommended)

### 1. Create Cron Service in Railway

1. **In your Railway project** → Click **"+ New"**
2. **Choose "Empty Service"**
3. **Connect same GitHub repo** (`iloveenergydrinks/everling`)
4. **Name it**: `everling-cron`

### 2. Configure the Cron Service

**In the cron service settings:**

#### **Environment Variables:**
```env
APP_URL=https://everling-production.up.railway.app
CRON_SECRET=your-secret-key-here
```

#### **Cron Schedule:**
```
0 * * * *
```
(Every hour to handle all timezones)

#### **Start Command:**
```bash
node cron.js
```

#### **Deploy Settings:**
- **Builder**: Nixpacks
- **Service Type**: Cron
- **Restart Policy**: On Failure

### 3. How It Works

```
Every hour → Railway triggers cron service → 
Runs maintenance tasks:
1. Sends daily digests to users in matching timezones
2. Cleans up expired short links
```

## Option 2: GitHub Actions (Already Set Up)

Your `.github/workflows/daily-digest.yml` is already configured and now handles:
- Daily digest emails/SMS
- Expired short link cleanup

### Setup GitHub Secrets:
1. **Go to your repo** → Settings → Secrets and variables → Actions
2. **Add secrets:**
   - `APP_URL`: `https://everling-production.up.railway.app`
   - `CRON_SECRET`: Same as in Railway

### How to Enable:
- **GitHub Actions runs free** for public repos
- **Runs every hour** automatically
- **No additional Railway service needed**

## Option 3: External Cron (Simplest)

### Use cron-job.org (Free):
1. **Sign up** at [cron-job.org](https://cron-job.org)
2. **Create job:**
   - **URL**: `https://everling-production.up.railway.app/api/cron/daily-digest?secret=your-secret`
   - **Schedule**: `0 * * * *` (every hour)
   - **Method**: GET

## Recommended Setup

For **Everling.io**, I recommend **GitHub Actions** because:
- ✅ **Already configured** in your repo
- ✅ **Free** for public repos
- ✅ **Reliable** and well-tested
- ✅ **No extra Railway services** needed
- ✅ **Easy to monitor** in GitHub

## Environment Variables Needed

Make sure your **main Railway service** has:

```env
# Database (auto-added by Railway)
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=your-32-char-secret
NEXTAUTH_URL=https://everling-production.up.railway.app

# SMS (Twilio)
SMS_MODE=production
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Email (Postmark)
POSTMARK_SERVER_TOKEN=your-postmark-token
EMAIL_FROM=noreply@everling.io
NEXT_PUBLIC_EMAIL_DOMAIN=everling.io

# AI
ANTHROPIC_API_KEY=your-anthropic-key

# Cron Security
CRON_SECRET=your-secret-key

# App
NEXT_PUBLIC_APP_URL=https://everling-production.up.railway.app
```

## Test Your Cron

Once deployed, test manually:
```bash
curl "https://everling-production.up.railway.app/api/cron/daily-digest?secret=your-secret"
```

Should return:
```json
{
  "success": true,
  "timestamp": "2025-09-15T12:00:00.000Z",
  "summary": {
    "total": 1,
    "processed": 1
  }
}
```

Your daily digest system will then run automatically every hour! 🎉
