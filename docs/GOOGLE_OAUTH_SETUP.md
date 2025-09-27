# Google OAuth Setup for Everling.io

## Prerequisites
You need to set up Google OAuth to enable "Sign in with Google" functionality.

## Setup Steps

### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 2. Enable Google+ API
1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 3. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type
   - Fill in the required fields:
     - App name: Everling.io
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Save and continue

### 4. Configure OAuth Client
1. Application type: "Web application"
2. Name: "Everling.io"
3. Authorized JavaScript origins:
   - For local development: `http://localhost:3000`
   - For production: `https://your-domain.com`
4. Authorized redirect URIs:
   - For local development: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://your-domain.com/api/auth/callback/google`
5. Click "Create"

### 5. Get Your Credentials
After creating, you'll get:
- **Client ID**: Copy this
- **Client Secret**: Copy this

### 6. Add to Environment Variables

Add these to your `.env.local` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

For Railway deployment, add these as environment variables in your Railway project settings.

## Testing

1. Restart your development server
2. Go to the login page
3. Click "Continue with Google"
4. You should be redirected to Google's OAuth consent screen
5. After authorization, you'll be redirected back to the dashboard

## Production Deployment

For Railway:
1. Go to your Railway project settings
2. Navigate to "Variables"
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
4. Deploy your application

## Important Notes

- The first time a user signs in with Google, an organization will be automatically created for them using their email prefix
- The organization email will be in the format: `emailprefix@everling.io`
- If the email prefix is already taken, a number will be appended (e.g., `john1@everling.io`)
- Users can still forward emails to their organization email to create tasks

## Troubleshooting

### "Error: Invalid redirect_uri"
- Make sure your redirect URI in Google Console exactly matches your app's URL
- Include the full path: `/api/auth/callback/google`

### "Error: Access blocked"
- Your OAuth consent screen might need verification if you're using sensitive scopes
- For development, add test users in the OAuth consent screen settings

### Users not getting organizations created
- Check the server logs for any database errors
- Ensure the Prisma schema is up to date
- Verify the JWT callback in `lib/auth.ts` is running correctly
