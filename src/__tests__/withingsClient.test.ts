import { describe, it, expect, beforeEach } from '@jest/globals';
import { MeasureType } from '../types.js';

describe('WithingsClient Types', () => {
  it('should have correct MeasureType values', () => {
    expect(MeasureType.WEIGHT).toBe(1);
    expect(MeasureType.FAT_MASS_WEIGHT).toBe(5);
    expect(MeasureType.MUSCLE_MASS).toBe(6);
    expect(MeasureType.BONE_MASS).toBe(8);
  });

  it('should export all required measure types', () => {
    expect(MeasureType.HYDRATION).toBeDefined();
    expect(MeasureType.FAT_MASS_PERCENTAGE).toBeDefined();
    expect(MeasureType.MUSCLE_MASS_PERCENTAGE).toBeDefined();
    expect(MeasureType.VISCERAL_FAT_INDEX).toBeDefined();
  });
});