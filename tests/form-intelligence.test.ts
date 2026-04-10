import { describe, it, expect } from 'vitest';
import { autoCorrectAnswer } from '../src/core/form-intelligence';

describe('autoCorrectAnswer', () => {
  it('extracts number from text for number fields', () => {
    expect(autoCorrectAnswer('number', 'Mais de 10 anos', 'Please enter a number')).toBe('10');
    expect(autoCorrectAnswer('number', '5+ years', 'Invalid value')).toBe('5');
  });

  it('extracts max from error message for number fields', () => {
    expect(autoCorrectAnswer('number', '150', 'Maximum 100 characters')).toBe('100');
  });

  it('picks best option via word-score for select fields', () => {
    const options = ['Less than 1 year', '1-2 years', '3-5 years', 'More than 5 years'];
    const result = autoCorrectAnswer('select', '4 years experience', 'Invalid selection', options);
    expect(result).toBe('3-5 years');
  });

  it('returns current value unchanged when no correction possible', () => {
    expect(autoCorrectAnswer('text', 'hello', 'Some error')).toBe('hello');
  });
});
