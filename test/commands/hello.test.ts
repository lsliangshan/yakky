import { describe, it, expect } from 'vitest';
import { hello } from '../../src/commands/hello.js';

describe('hello command', () => {
  it('should return default greeting', () => {
    const result = hello();
    expect(result).toBe('Hello, world!');
  });

  it('should greet a named person', () => {
    const result = hello('Yakky');
    expect(result).toBe('Hello, Yakky!');
  });

  it('should use custom greeting', () => {
    const result = hello('Yakky', { greeting: 'Hi' });
    expect(result).toBe('Hi, Yakky!');
  });
});
