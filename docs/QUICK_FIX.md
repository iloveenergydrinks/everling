# Quick Fix for Magic Link Chrome Warning

## The Issue
Chrome flags NextAuth's email callback URLs as phishing because they contain:
- Email address in URL parameters
- Token in URL
- Callback URL parameter

Pattern: `/api/auth/callback/email?callbackUrl=...&token=...&email=user@example.com`

## Immediate Workarounds

### For Users Right Now:
1. **Use Google Sign-in** - Works perfectly, no warnings
2. **Use Password Login** - Traditional login works fine
3. **If using magic link**: Click "Details" → "Visit this unsafe site anyway"

### For You (Choose One):

#### Option A: Quick URL Shortener (30 minutes)
1. Sign up for Rebrandly (free): https://rebrandly.com
2. Create API integration
3. Modify email sending to shorten URLs before sending
4. User clicks short link → redirects to full URL → works

#### Option B: Google Search Console (1-3 days)
1. Go to: https://search.google.com/search-console
2. Add property: everling.io
3. Verify ownership (HTML file method)
4. Security & Manual Actions → Request Review
5. Explain: "NextAuth.js standard implementation, false positive"

#### Option C: Switch to OTP Codes (2-3 hours work)
Replace magic links with 6-digit codes:
```
Your sign-in code: 423-891
Enter at: everling.io/verify
```

## Why This Happens
NextAuth's default email provider uses a URL pattern that exactly matches what phishing sites use. Google's algorithm can't distinguish between legitimate use and phishing.

## Recommendation
**Short term**: Use URL shortener (Option A)
**Long term**: Implement OTP codes (Option C) or wait for Google review
