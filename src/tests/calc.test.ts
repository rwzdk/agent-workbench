import { describe, expect, it } from 'vitest';
import { evaluateExpression } from '../lib/calc';

describe('evaluateExpression', () => {
  it('基础四则运算与优先级', () => {
    expect(evaluateExpression('1 + 2 * 3')).toBe(7);
    expect(evaluateExpression('10 - 4 / 2')).toBe(8);
  });

  it('括号改变优先级', () => {
    expect(evaluateExpression('(1 + 2) * 3')).toBe(9);
    expect(evaluateExpression('((2 + 3) * (4 - 1))')).toBe(15);
  });

  it('幂运算右结合', () => {
    expect(evaluateExpression('2 ^ 3 ^ 2')).toBe(512);
  });

  it('一元负号优先级低于幂运算', () => {
    expect(evaluateExpression('-2 ^ 2')).toBe(-4);
    expect(evaluateExpression('-(3 + 4)')).toBe(-7);
  });

  it('取模', () => {
    expect(evaluateExpression('10 % 3')).toBe(1);
  });

  it('小数运算', () => {
    expect(evaluateExpression('1.5 * 2')).toBe(3);
  });

  it('空白字符被忽略', () => {
    expect(evaluateExpression('  1   +  2 ')).toBe(3);
  });

  it('空表达式报错', () => {
    expect(() => evaluateExpression('   ')).toThrow();
  });

  it('非法字符报错', () => {
    expect(() => evaluateExpression('1 + a')).toThrow();
  });

  it('不完整表达式报错', () => {
    expect(() => evaluateExpression('(1 + 2')).toThrow();
    expect(() => evaluateExpression('1 +')).toThrow();
  });

  it('除以 0 / 对 0 取模报错', () => {
    expect(() => evaluateExpression('1 / 0')).toThrow();
    expect(() => evaluateExpression('5 % 0')).toThrow();
  });
});
