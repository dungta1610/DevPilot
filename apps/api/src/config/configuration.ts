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
});
