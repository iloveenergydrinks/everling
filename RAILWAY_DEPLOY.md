# 🚂 Railway Deployment Guide

## Quick Deploy (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Choose **"Deploy from GitHub repo"**
4. Select your repository
5. Railway will auto-detect Next.js

### 3. Add PostgreSQL Database

In Railway dashboard:
1. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically connects it to your app

### 4. Set Environment Variables

Click on your app service, go to **Variables** tab, add:

```env
# Database (auto-added by Railway)
DATABASE_URL=[Automatically set by Railway]

# Auth
NEXTAUTH_SECRET=your-random-secret-here-32-chars
NEXTAUTH_URL=https://your-app.railway.app

# SMS (Twilio)
SMS_MODE=production
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=[Your Twilio Auth Token]
TWILIO_PHONE_NUMBER=+1234567890

# Cron Security
CRON_SECRET=your-cron-secret-key

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
```

### 5. Deploy!

Railway will automatically:
- Build your app
- Run Prisma migrations
- Start the server

## 📅 Setting Up Daily SMS Digest (8am)

Railway doesn't have built-in cron, so use **GitHub Actions**:

### Create `.github/workflows/daily-digest.yml`:

```yaml
name: Daily SMS Digest
on:
  schedule:
    # 8am UTC (adjust for your timezone)
    - cron: '0 8 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  send-digest:
    runs-on: ubuntu-latest
    steps:
      - name: Send Daily Digest
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/daily-digest?secret=${{ secrets.CRON_SECRET }}"
```

### Add GitHub Secrets:
1. Go to your repo → Settings → Secrets
2. Add:
   - `APP_URL`: `https://your-app.railway.app`
   - `CRON_SECRET`: Same as in Railway

## 🔧 Production Optimizations

### Update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
```

### Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "postinstall": "prisma generate"
  }
}
```

## 🎯 Post-Deploy Checklist

### 1. Set up Twilio Webhook
In Twilio Console:
1. Go to your phone number settings
2. Set webhook URL: `https://your-app.railway.app/api/webhooks/sms`
3. Method: POST

### 2. Verify Phone Numbers (if still on Twilio trial)
Add verified numbers in Twilio Console

### 3. Test Everything
```bash
# Test daily digest
curl https://your-app.railway.app/api/cron/daily-digest?secret=your-secret

# Check app
open https://your-app.railway.app
```

## 🚀 Railway Features You Get

- **Auto-deploy** on git push
- **Free SSL** certificate
- **PostgreSQL** included
- **Automatic restarts** on crash
- **Zero config** deploys
- **Great logs** viewer
- **$5/month** includes everything

## 🐛 Troubleshooting

### Database Connection Issues
- Railway auto-injects DATABASE_URL
- Check logs in Railway dashboard

### Build Failures
```bash
# Check locally first
npm run build
```

### Prisma Issues
- Railway runs migrations automatically
- Check `railway.json` has the right commands

### SMS Not Sending
- Verify Twilio credentials
- Check SMS_MODE=production
- Look at Railway logs

## 📊 Monitor Your App

In Railway Dashboard:
- **Logs**: Real-time application logs
- **Metrics**: CPU, Memory, Network
- **Deployments**: History and rollback

## 🎉 You're Live!

Your minimalist task manager is now:
- ✅ Deployed on Railway
- ✅ Database connected
- ✅ SMS reminders working
- ✅ Daily digest at 8am
- ✅ Auto-deploy on git push

Share your Railway URL and start managing tasks! 🚀
