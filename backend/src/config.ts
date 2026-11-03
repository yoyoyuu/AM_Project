import 'dotenv/config';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 3000),
};
