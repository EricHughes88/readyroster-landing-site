// next-auth.d.ts (make sure tsconfig.json includes this file)
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string; // optional so we can build it conditionally
      role?: "Coach" | "Parent" | "Athlete" | "Admin";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string; // what authorize() returns must include id
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
