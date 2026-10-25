type Token = { type: 'num'; value: number } | { type: 'op'; value: string };

const OPERATORS = '+-*/%^()';

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < input.length && /[0-9.]/.test(input[i])) num += input[i++];
      if (!/^\d+(\.\d+)?$/.test(num)) throw new Error(`无法解析的数字：${num}`);
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    if (OPERATORS.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    throw new Error(`非法字符：${ch}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private peekOp(): string | undefined {
    const t = this.peek();
    return t?.type === 'op' ? t.value : undefined;
  }

  private nextOp(): string {
    const t = this.next();
    if (!t || t.type !== 'op') throw new Error('解析错误：期望运算符');
    return t.value;
  }

  private expectOp(value: string) {
    if (this.nextOp() !== value) throw new Error(`期望 "${value}"`);
  }

  parse(): number {
    if (this.tokens.length === 0) throw new Error('表达式为空');
    const value = this.expr();
    if (this.pos !== this.tokens.length) throw new Error('表达式存在多余部分');
    if (!Number.isFinite(value)) throw new Error('结果超出可计算范围');
    return value;
  }

  // expr := term (('+' | '-') term)*
  private expr(): number {
    let left = this.term();
    let op = this.peekOp();
    while (op === '+' || op === '-') {
      this.next();
      const right = this.term();
      left = op === '+' ? left + right : left - right;
      op = this.peekOp();
    }
    return left;
  }

  // term := factor (('*' | '/' | '%') factor)*
  private term(): number {
    let left = this.factor();
    let op = this.peekOp();
    while (op === '*' || op === '/' || op === '%') {
      this.next();
      const right = this.factor();
      if (op === '*') left *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('除数不能为 0');
        left /= right;
      } else {
        if (right === 0) throw new Error('模数不能为 0');
        left %= right;
      }
      op = this.peekOp();
    }
    return left;
  }

  // factor := '-' factor | power；负号优先级低于幂运算，-2^2 === -(2^2)
  private factor(): number {
    if (this.peekOp() === '-') {
      this.next();
      return -this.factor();
    }
    return this.power();
  }

  // power := primary ('^' power)?；右结合，2^3^2 === 2^(3^2)
  private power(): number {
    const base = this.primary();
    if (this.peekOp() === '^') {
      this.next();
      return Math.pow(base, this.power());
    }
    return base;
  }

  private primary(): number {
    const t = this.next();
    if (!t) throw new Error('表达式不完整');
    if (t.type === 'num') return t.value;
    if (t.value === '(') {
      const value = this.expr();
      this.expectOp(')');
      return value;
    }
    throw new Error(`意外的符号：${t.value}`);
  }
}

export function evaluateExpression(input: string): number {
  return new Parser(tokenize(input)).parse();
}
