import { NextAuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/email"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { ServerClient } from 'postmark'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt", // Back to JWT for better compatibility
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
    verifyRequest: "/login", // Redirect here after magic link is sent
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "noreply@everling.io",
      // Use Postmark for sending magic links
      sendVerificationRequest: async ({ identifier: email, url, provider }) => {
        if (!process.env.POSTMARK_SERVER_TOKEN) {
          console.log('[MOCK EMAIL] Would send magic link to:', email)
          return
        }

        const postmark = new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
        
        try {
          await postmark.sendEmail({
            From: provider.from as string,
            To: email,
            Subject: 'Sign in to Everling.io',
            HtmlBody: `
              <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333; margin-bottom: 20px;">Sign in to Everling.io</h1>
                <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
                  Click the link below to sign in to your account. This link will expire in 24 hours.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${url}" 
                     style="display: inline-block; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                    Sign in to Everling.io
                  </a>
                </div>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                  If you didn't request this email, you can safely ignore it.
                </p>
              </div>
            `,
            TextBody: `Sign in to Everling.io\n\nClick this link to sign in: ${url}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this email, you can safely ignore it.`,
            MessageStream: 'outbound'
          })
        } catch (error) {
          console.error('Failed to send magic link:', error)
          throw error
        }
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          },
          include: {
            organizations: {
              include: {
                organization: true
              }
            }
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign-ins - NextAuth adapter will handle user creation
      // We only need to handle linking for existing users
      
      if (account?.provider === "google" && user.email) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          })
          
          if (existingUser) {
            // Check if this Google account is already linked
            const existingAccount = await prisma.account.findFirst({
              where: {
                userId: existingUser.id,
                provider: account.provider,
                providerAccountId: account.providerAccountId
              }
            })
            
            if (!existingAccount) {
              // Link the Google account to the existing user
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  refresh_token: account.refresh_token,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                }
              })
            }
            
            // Update user.id to match existing user
            user.id = existingUser.id
          }
        } catch (error) {
          console.error('Error linking Google account:', error)
          // Don't fail the sign-in, just log the error
        }
      }
      
      // Always return true to allow sign-in
      return true
    },
    async jwt({ token, user, trigger, session, account }) {
      // Always check for user in database and set organization
      const email = user?.email || token.email
      
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: email as string },
          include: {
            organizations: {
              include: {
                organization: true
              }
            }
          }
        })

        if (dbUser) {
          token.userId = dbUser.id
          token.email = dbUser.email
          token.name = dbUser.name
          
          // If user has no organization, create one
          if (dbUser.organizations.length === 0) {
            // Generate a unique organization slug from email
            const emailPrefix = (email as string).split('@')[0]
            let slug = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '')
            
            // Check if slug exists and make it unique
            let counter = 0
            let finalSlug = slug
            while (await prisma.organization.findUnique({ where: { slug: finalSlug } })) {
              counter++
              finalSlug = `${slug}${counter}`
            }
            
            // Create organization and member
            const org = await prisma.organization.create({
              data: {
                name: dbUser.name || emailPrefix,
                slug: finalSlug,
                emailPrefix: finalSlug,
                members: {
                  create: {
                    userId: dbUser.id,
                    role: 'admin'
                  }
                }
              }
            })
            
            token.organizationId = org.id
            token.organizationRole = 'admin'
            token.organizationSlug = org.slug
          } else if (dbUser.organizations.length > 0) {
            token.organizationId = dbUser.organizations[0].organizationId
            token.organizationRole = dbUser.organizations[0].role
            token.organizationSlug = dbUser.organizations[0].organization.slug
          }
        }
      }

      if (trigger === "update" && session) {
        token = { ...token, ...session }
      }

      return token
    },
    async redirect({ url, baseUrl }) {
      // Always redirect to dashboard after successful auth
      if (url.includes("/dashboard")) {
        return url
      }
      
      // Default to dashboard for any auth success
      return `${baseUrl}/dashboard`
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string || token.sub!
        session.user.organizationId = token.organizationId as string
        session.user.organizationRole = token.organizationRole as string
        session.user.organizationSlug = token.organizationSlug as string
      }

      return session
    }
  },
}

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()

  if (!session?.user?.email) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email
    },
    include: {
      organizations: {
        include: {
          organization: true
        }
      }
    }
  })

  return user
}
