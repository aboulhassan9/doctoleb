import { z } from 'zod';

const PHONE_REGEX = /^\+?[\d\s-]{8,20}$/;

export const blankToNull = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }

  return value;
};

export const nullableTrimmedString = (maxLength = 2000) => z.preprocess(
  blankToNull,
  z.string().trim().max(maxLength).nullable()
);

export const nullablePhone = z.preprocess(
  blankToNull,
  z.string().trim().regex(PHONE_REGEX, 'Please enter a valid phone number.').nullable()
);

export const nullableNumber = ({ integer = false, min = null, max = null } = {}) => z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const normalizedValue = Number(value);
    return Number.isNaN(normalizedValue) ? value : normalizedValue;
  },
  (() => {
    let schema = integer ? z.number().int() : z.number();
    if (typeof min === 'number') schema = schema.min(min);
    if (typeof max === 'number') schema = schema.max(max);
    return schema.nullable();
  })()
);

export const optionalClientRequestId = z.string().uuid().optional().nullable();

/**
 * Parse a value with a Zod schema, returning { data, error } envelope.
 * @param {z.ZodType} schema
 * @param {unknown} payload
 * @returns {{ data: unknown, error: string | null }}
 */
export function parseWithSchema(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      data: null,
      error: result.error.issues[0]?.message || 'Invalid request payload.',
    };
  }

  return {
    data: result.data,
    error: null,
  };
}
