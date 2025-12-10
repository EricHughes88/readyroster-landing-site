// next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      role?: "Coach" | "Parent" | "Athlete" | "Admin";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User {
    id: string;
    role?: "Coach" | "Parent" | "Athlete" | "Admin";
    name?: string | null;
    email?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "Coach" | "Parent" | "Athlete" | "Admin";
    name?: string | null;
    email?: string | null;
  }
}
