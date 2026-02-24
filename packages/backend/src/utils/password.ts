import * as argon2 from 'argon2';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('PasswordUtils');

const DEFAULT_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveArgon2Type = (value: string | undefined): 0 | 1 | 2 => {
  if (!value) return DEFAULT_OPTIONS.type as 0 | 1 | 2;
  const normalized = value.toLowerCase();
  if (normalized === 'argon2i') return argon2.argon2i;
  if (normalized === 'argon2d') return argon2.argon2d;
  return argon2.argon2id;
};

const buildOptions = (): argon2.Options => {
  return {
    type: resolveArgon2Type(process.env.ARGON2_TYPE),
    memoryCost: parseNumber(process.env.ARGON2_MEMORY_COST, DEFAULT_OPTIONS.memoryCost),
    timeCost: parseNumber(process.env.ARGON2_TIME_COST, DEFAULT_OPTIONS.timeCost),
    parallelism: parseNumber(process.env.ARGON2_PARALLELISM, DEFAULT_OPTIONS.parallelism),
  };
};

export const hashPassword = async (password: string): Promise<string> => {
  const options = buildOptions();
  try {
    // @ts-ignore - argon2 library type variance
    return await argon2.hash(password, options);
  } catch (error) {
    logger.warn({ error, options }, 'Argon2 hashing failed with configured options, retrying defaults');
    return await argon2.hash(password);
  }
};
