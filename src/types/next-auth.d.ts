import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      plan: string;
    };
  }

  interface User {
    plan?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    plan: string;
    /** epoch ms of the last lastActiveAt write for this session — throttles the write */
    lastTouch?: number;
  }
}
