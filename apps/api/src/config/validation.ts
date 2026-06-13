import * as Joi from 'joi';

/**
 * Joi schema for environment variables.
 *
 * - DATABASE_URL and JWT_SECRET are always required.
 * - GitHub OAuth + FRONTEND_URL are required in production, optional otherwise
 *   (so the app can boot in dev/test without a real GitHub app).
 */
const requiredInProd = (schema: Joi.StringSchema) =>
  Joi.alternatives().conditional('NODE_ENV', {
    is: 'production',
    then: schema.required(),
    otherwise: schema.optional().allow(''),
  });

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),

  DATABASE_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  GITHUB_CLIENT_ID: requiredInProd(Joi.string()),
  GITHUB_CLIENT_SECRET: requiredInProd(Joi.string()),
  GITHUB_CALLBACK_URL: Joi.string().default(
    'http://localhost:3001/auth/github/callback',
  ),

  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
});
