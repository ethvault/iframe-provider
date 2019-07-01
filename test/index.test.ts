import { isEmbeddedInIFrame } from '../src';

describe('isEmbeddedInIFrame', () => {
  it('returns false', () => {
    expect(isEmbeddedInIFrame()).toBe(false);
  });
});
