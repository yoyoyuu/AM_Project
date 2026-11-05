import {
  searchHandleSchema,
  serviceSchema,
  tosSchema,
} from '../schemas';

describe('serviceSchema', () => {
  const validService = {
    title: 'Ilustración personalizada',
    description: 'Una descripción opcional.',
    price_mxn: 500,
    delivery_days: 7,
  };

  it('accepts valid service data', () => {
    expect(serviceSchema.safeParse(validService).success).toBe(true);
  });

  it('accepts title, price, and delivery values at their boundaries', () => {
    expect(
      serviceSchema.safeParse({
        ...validService,
        title: 'a'.repeat(3),
        price_mxn: 1,
        delivery_days: 1,
      }).success,
    ).toBe(true);
    expect(
      serviceSchema.safeParse({
        ...validService,
        title: 'a'.repeat(80),
        delivery_days: 365,
      }).success,
    ).toBe(true);
  });

  it('accepts a nullable or omitted description', () => {
    expect(
      serviceSchema.safeParse({ ...validService, description: null }).success,
    ).toBe(true);
    expect(
      serviceSchema.safeParse(
        Object.fromEntries(
          Object.entries(validService).filter(([key]) => key !== 'description'),
        ),
      ).success,
    ).toBe(true);
  });

  it('rejects empty and out-of-range service fields', () => {
    expect(
      serviceSchema.safeParse({
        title: '',
        description: 'a'.repeat(1001),
        price_mxn: 0,
        delivery_days: 366,
      }).success,
    ).toBe(false);
    expect(
      serviceSchema.safeParse({
        ...validService,
        title: 'a'.repeat(81),
        price_mxn: 1.5,
        delivery_days: 0,
      }).success,
    ).toBe(false);
  });
});

describe('tosSchema', () => {
  it('accepts exactly 10 and 5000 characters', () => {
    expect(tosSchema.safeParse({ content: 'a'.repeat(10) }).success).toBe(
      true,
    );
    expect(tosSchema.safeParse({ content: 'a'.repeat(5000) }).success).toBe(
      true,
    );
  });

  it('rejects empty and out-of-range content', () => {
    expect(tosSchema.safeParse({ content: '' }).success).toBe(false);
    expect(tosSchema.safeParse({ content: 'a'.repeat(9) }).success).toBe(
      false,
    );
    expect(tosSchema.safeParse({ content: 'a'.repeat(5001) }).success).toBe(
      false,
    );
  });
});

describe('searchHandleSchema', () => {
  it('normalizes a leading at sign', () => {
    expect(searchHandleSchema.parse({ query: '@artist' }).query).toBe('artist');
  });

  it('accepts a handle without an at sign', () => {
    expect(searchHandleSchema.parse({ query: 'artist' }).query).toBe('artist');
  });

  it('rejects an empty search', () => {
    expect(searchHandleSchema.safeParse({ query: '' }).success).toBe(false);
  });
});
