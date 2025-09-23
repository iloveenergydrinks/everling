import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      organizationId?: string
      organizationRole?: string
      organizationSlug?: string
      discordId?: string | null
      discordUsername?: string | null
      discordConnected?: Date | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name?: string | null
    discordId?: string | null
    discordUsername?: string | null
    discordConnected?: Date | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string
    organizationRole?: string
    organizationSlug?: string
  }
}

