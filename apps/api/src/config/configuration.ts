export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  github: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  frontendUrl: string;
  restate: {
    /** Restate ingress base URL — where review workflows are submitted. */
    ingressUrl: string;
    /** Bearer token for Restate Cloud ingress (empty for local Restate). */
    apiKey: string;
  };
  /** Shared secret the agent service presents on internal progress callbacks. */
  internalSecret: string;
}

/**
 * Typed configuration factory consumed by `@nestjs/config`. Values are read
 * from validated environment variables (see ./validation.ts).
 */
export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL as string,
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL ??
      'http://localhost:3001/auth/github/callback',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  restate: {
    ingressUrl: process.env.RESTATE_INGRESS_URL ?? 'http://localhost:8080',
    apiKey: process.env.RESTATE_API_KEY ?? '',
  },
  internalSecret: process.env.API_INTERNAL_SECRET ?? 'dev-internal-secret',
});
