import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This should be the user's email
    
    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=discord_auth_failed`)
    }
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email || session.user.email !== state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=unauthorized`)
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/discord/callback`,
      }),
    })
    
    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=discord_token_failed`)
    }
    
    const tokenData = await tokenResponse.json()
    
    // Get user info from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })
    
    if (!userResponse.ok) {
      console.error('Discord user fetch failed:', await userResponse.text())
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=discord_user_failed`)
    }
    
    const discordUser = await userResponse.json()
    
    // Update user in database
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        discordId: discordUser.id,
        discordUserId: discordUser.id, // Save the user ID for digest messages
        discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
        discordConnected: new Date(),
      },
    })
    
    // Return success HTML that closes the window
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Discord Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              text-align: center;
              max-width: 400px;
            }
            .icon {
              width: 60px;
              height: 60px;
              margin: 0 auto 20px;
              background: #5865F2;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .icon svg {
              width: 30px;
              height: 30px;
              fill: white;
            }
            h1 {
              margin: 0 0 10px;
              color: #333;
              font-size: 24px;
            }
            p {
              color: #666;
              margin: 0 0 20px;
              font-size: 14px;
            }
            .status {
              color: #5865F2;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">
              <svg viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <h1>Discord Connected!</h1>
            <p>Your Discord account <span class="status">${discordUser.username}#${discordUser.discriminator}</span> has been successfully linked.</p>
            <p style="color: #999; font-size: 12px;">This window will close automatically...</p>
          </div>
          <script>
            // Close the window after showing success
            setTimeout(() => {
              if (window.opener) {
                // Notify parent window about Discord connection
                window.opener.postMessage({
                  type: 'DISCORD_CONNECTED',
                  username: '${discordUser.username}#${discordUser.discriminator}'
                }, '*');
                window.close();
              } else {
                window.location.href = '${process.env.NEXT_PUBLIC_APP_URL}/dashboard';
              }
            }, 2000);
          </script>
        </body>
      </html>
    `
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    console.error('Discord callback error:', error)
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              text-align: center;
              max-width: 400px;
            }
            h1 {
              color: #dc2626;
              font-size: 24px;
              margin: 0 0 10px;
            }
            p {
              color: #666;
              margin: 0 0 20px;
              font-size: 14px;
            }
            a {
              color: #5865F2;
              text-decoration: none;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Connection Failed</h1>
            <p>Unable to connect your Discord account. Please try again.</p>
            <a href="#" onclick="window.close(); return false;">Close Window</a>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `
    
    return new NextResponse(errorHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  }
}
