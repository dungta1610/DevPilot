/**
 * Runs before each e2e test file (jest `setupFiles`), before AppModule and
 * PrismaClient are imported. Points the suite at an isolated test database and
 * a deterministic JWT secret so tokens we sign are accepted by JwtStrategy.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/devpilot_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-secret';
process.env.JWT_EXPIRES_IN = '7d';
process.env.FRONTEND_URL = 'http://localhost:3000';
