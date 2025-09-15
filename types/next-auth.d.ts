import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      organizationId?: string
      organizationRole?: string
      organizationSlug?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string
    organizationRole?: string
    organizationSlug?: string
  }
}
