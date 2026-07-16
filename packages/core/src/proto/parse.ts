/**
 * Hand-rolled `.proto` census parser — proto3 first, proto2
 * read-tolerant (labels, `extend`, `group` bodies are consumed, never
 * authored). No third-party toolchain: a single tokenizer pass plus a
 * recursive-descent walk over the statement grammar, recording the
 * declaration offset of every named node for outline navigation.
 *
 * The census is structural: option values, reserved ranges, and
 * `extend` blocks are skipped with balanced-delimiter consumption —
 * they carry nothing the spec plane or the codec registry reads. A
 * malformed document throws `ProtoParseError` with the position
 * formatted into the message (the validation strip shows it verbatim).
 */

import {
  type ProtoCensus,
  type ProtoEnum,
  type ProtoEnumValue,
  type ProtoField,
  type ProtoFieldLabel,
  type ProtoImport,
  type ProtoMessage,
  ProtoParseError,
  type ProtoRpc,
  type ProtoService,
  type ProtoStreamingShape,
} from './types';

// ── Tokenizer ──────────────────────────────────────────────────────

interface Token {
  kind: 'ident' | 'string' | 'number' | 'symbol';
  text: string;
  offset: number;
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const SYMBOLS = new Set(['{', '}', '(', ')', '[', ']', '<', '>', '=', ';', ',', '.', '-', '+', '/', ':']);

function positionOf(source: string, offset: number): string {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return `line ${line}, column ${offset - lineStart + 1}`;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) throw new ProtoParseError(`Unterminated block comment at ${positionOf(source, i)}.`, i);
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const start = i;
      i++;
      let text = '';
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\n') break;
        if (source[i] === '\\' && i + 1 < source.length) {
          text += source[i + 1];
          i += 2;
          continue;
        }
        text += source[i];
        i++;
      }
      if (i >= source.length || source[i] !== ch) {
        throw new ProtoParseError(`Unterminated string literal at ${positionOf(source, start)}.`, start);
      }
      i++;
      tokens.push({ kind: 'string', text, offset: start });
      continue;
    }
    if (DIGIT.test(ch) || (ch === '.' && DIGIT.test(source[i + 1] ?? ''))) {
      const start = i;
      while (i < source.length) {
        const c = source[i];
        if (DIGIT.test(c) || /[a-fA-FxX.]/.test(c)) {
          i++;
          continue;
        }
        // Exponent sign — only directly after e/E.
        if ((c === '+' || c === '-') && /[eE]/.test(source[i - 1] ?? '')) {
          i++;
          continue;
        }
        break;
      }
      tokens.push({ kind: 'number', text: source.slice(start, i), offset: start });
      continue;
    }
    if (IDENT_START.test(ch)) {
      const start = i;
      while (i < source.length && IDENT_PART.test(source[i])) i++;
      tokens.push({ kind: 'ident', text: source.slice(start, i), offset: start });
      continue;
    }
    if (SYMBOLS.has(ch)) {
      tokens.push({ kind: 'symbol', text: ch, offset: i });
      i++;
      continue;
    }
    throw new ProtoParseError(`Unexpected character ${JSON.stringify(ch)} at ${positionOf(source, i)}.`, i);
  }
  return tokens;
}

// ── Parser ─────────────────────────────────────────────────────────

class Parser {
  private pos = 0;

  constructor(
    private readonly source: string,
    private readonly tokens: Token[],
  ) {}

  private fail(message: string, offset: number): never {
    throw new ProtoParseError(`${message} at ${positionOf(this.source, offset)}.`, offset);
  }

  private peek(): Token | null {
    return this.tokens[this.pos] ?? null;
  }

  private next(): Token {
    const token = this.tokens[this.pos];
    if (token === undefined) this.fail('Unexpected end of file', this.source.length);
    this.pos++;
    return token;
  }

  private expectSymbol(text: string): Token {
    const token = this.next();
    if (token.kind !== 'symbol' || token.text !== text) {
      this.fail(`Expected \`${text}\` but found \`${token.text}\``, token.offset);
    }
    return token;
  }

  private expectIdent(): Token {
    const token = this.next();
    if (token.kind !== 'ident') this.fail(`Expected a name but found \`${token.text}\``, token.offset);
    return token;
  }

  private expectString(): Token {
    const token = this.next();
    if (token.kind !== 'string') this.fail(`Expected a string literal but found \`${token.text}\``, token.offset);
    return token;
  }

  private eatSymbol(text: string): boolean {
    const token = this.peek();
    if (token !== null && token.kind === 'symbol' && token.text === text) {
      this.pos++;
      return true;
    }
    return false;
  }

  private eatIdent(text: string): boolean {
    const token = this.peek();
    if (token !== null && token.kind === 'ident' && token.text === text) {
      this.pos++;
      return true;
    }
    return false;
  }

  /** Dotted, optionally fully-qualified (leading-dot) type/package name. */
  private dottedName(): string {
    let name = this.eatSymbol('.') ? '.' : '';
    name += this.expectIdent().text;
    while (this.eatSymbol('.')) {
      name += `.${this.expectIdent().text}`;
    }
    return name;
  }

  private integer(): { value: number; offset: number } {
    const negative = this.eatSymbol('-');
    const token = this.next();
    if (token.kind !== 'number') this.fail(`Expected a number but found \`${token.text}\``, token.offset);
    const raw = token.text.toLowerCase().startsWith('0x') ? Number.parseInt(token.text, 16) : Number(token.text);
    if (!Number.isFinite(raw)) this.fail(`Invalid number \`${token.text}\``, token.offset);
    return { value: negative ? -raw : raw, offset: token.offset };
  }

  /**
   * Consume the remainder of a statement whose content the census
   * ignores (`option`, `reserved`, `extensions`): everything up to the
   * terminating `;`, tracking `{}`/`[]`/`()` nesting so aggregate
   * option bodies pass through whole. An aggregate closing at depth 0
   * also ends the statement (trailing `;` optional after `}`).
   */
  private skipStatement(): void {
    let depth = 0;
    while (true) {
      const token = this.next();
      if (token.kind !== 'symbol') continue;
      if (token.text === '{' || token.text === '[' || token.text === '(') depth++;
      else if (token.text === '}' || token.text === ']' || token.text === ')') {
        depth--;
        if (depth < 0) this.fail(`Unbalanced \`${token.text}\``, token.offset);
        if (depth === 0 && token.text === '}') {
          this.eatSymbol(';');
          return;
        }
      } else if (token.text === ';' && depth === 0) return;
    }
  }

  /** Consume a balanced `{ … }` block without interpreting it. */
  private skipBlock(): void {
    this.expectSymbol('{');
    let depth = 1;
    while (depth > 0) {
      const token = this.next();
      if (token.kind !== 'symbol') continue;
      if (token.text === '{') depth++;
      else if (token.text === '}') depth--;
    }
  }

  /** Field options `[ … ]` — skipped with nesting (aggregates allowed). */
  private skipFieldOptions(): void {
    if (!this.eatSymbol('[')) return;
    let depth = 1;
    while (depth > 0) {
      const token = this.next();
      if (token.kind !== 'symbol') continue;
      if (token.text === '[' || token.text === '{' || token.text === '(') depth++;
      else if (token.text === ']' || token.text === '}' || token.text === ')') depth--;
    }
  }

  parse(): ProtoCensus {
    const census: ProtoCensus = {
      syntax: null,
      packageName: null,
      packageOffset: null,
      imports: [],
      messages: [],
      enums: [],
      services: [],
    };
    while (this.peek() !== null) {
      const token = this.next();
      if (token.kind === 'symbol' && token.text === ';') continue;
      if (token.kind !== 'ident') this.fail(`Expected a declaration but found \`${token.text}\``, token.offset);
      switch (token.text) {
        case 'syntax':
        case 'edition': {
          this.expectSymbol('=');
          census.syntax = this.expectString().text;
          this.expectSymbol(';');
          break;
        }
        case 'package': {
          census.packageName = this.dottedName();
          census.packageOffset = token.offset;
          this.expectSymbol(';');
          break;
        }
        case 'import': {
          let modifier: ProtoImport['modifier'] = 'none';
          if (this.eatIdent('public')) modifier = 'public';
          else if (this.eatIdent('weak')) modifier = 'weak';
          const path = this.expectString();
          this.expectSymbol(';');
          census.imports.push({ path: path.text, modifier, offset: token.offset });
          break;
        }
        case 'option': {
          this.skipStatement();
          break;
        }
        case 'message': {
          census.messages.push(this.message(token.offset, census.packageName ?? ''));
          break;
        }
        case 'enum': {
          census.enums.push(this.enum_(token.offset, census.packageName ?? ''));
          break;
        }
        case 'service': {
          census.services.push(this.service(token.offset, census.packageName ?? ''));
          break;
        }
        case 'extend': {
          this.dottedName();
          this.skipBlock();
          break;
        }
        default:
          this.fail(`Unknown declaration \`${token.text}\``, token.offset);
      }
    }
    return census;
  }

  private message(offset: number, parentFullName: string): ProtoMessage {
    const name = this.expectIdent();
    const fullName = parentFullName === '' ? name.text : `${parentFullName}.${name.text}`;
    const message: ProtoMessage = {
      name: name.text,
      fullName,
      fields: [],
      oneofs: [],
      messages: [],
      enums: [],
      offset,
    };
    this.expectSymbol('{');
    while (!this.eatSymbol('}')) {
      this.messageItem(message, fullName, null);
    }
    return message;
  }

  /** One statement inside a message (or oneof) body. */
  private messageItem(message: ProtoMessage, fullName: string, oneofName: string | null): void {
    if (this.eatSymbol(';')) return;
    const token = this.next();
    if (token.kind !== 'ident' && !(token.kind === 'symbol' && token.text === '.')) {
      this.fail(`Expected a field or declaration but found \`${token.text}\``, token.offset);
    }
    if (token.kind === 'ident') {
      switch (token.text) {
        case 'message': {
          message.messages.push(this.message(token.offset, fullName));
          return;
        }
        case 'enum': {
          message.enums.push(this.enum_(token.offset, fullName));
          return;
        }
        case 'oneof': {
          if (oneofName !== null) this.fail('`oneof` cannot nest inside a oneof', token.offset);
          const name = this.expectIdent();
          message.oneofs.push({ name: name.text, offset: token.offset });
          this.expectSymbol('{');
          while (!this.eatSymbol('}')) {
            this.messageItem(message, fullName, name.text);
          }
          return;
        }
        case 'option':
        case 'reserved':
        case 'extensions': {
          this.skipStatement();
          return;
        }
        case 'extend': {
          this.dottedName();
          this.skipBlock();
          return;
        }
        case 'map': {
          this.expectSymbol('<');
          const keyType = this.dottedName();
          this.expectSymbol(',');
          const valueType = this.dottedName();
          this.expectSymbol('>');
          message.fields.push(this.fieldTail(token.offset, 'none', valueType, keyType, oneofName));
          return;
        }
        default:
          break;
      }
    }
    // A field: optional label, then the type (which may start with the
    // token we already consumed — rewind one and let dottedName read it).
    this.pos--;
    let label: ProtoFieldLabel = 'none';
    if (this.eatIdent('repeated')) label = 'repeated';
    else if (this.eatIdent('optional')) label = 'optional';
    else if (this.eatIdent('required')) label = 'required';
    // Proto2 `group` bodies — consumed, recorded as a group-typed field.
    if (this.eatIdent('group')) {
      const name = this.expectIdent();
      this.expectSymbol('=');
      const number = this.integer();
      this.skipBlock();
      message.fields.push({
        name: name.text,
        number: number.value,
        label,
        type: 'group',
        mapKeyType: null,
        oneofName,
        offset: token.offset,
      });
      return;
    }
    const type = this.dottedName();
    message.fields.push(this.fieldTail(token.offset, label, type, null, oneofName));
  }

  /** `name = number [options] ;` — shared by plain and map fields. */
  private fieldTail(
    offset: number,
    label: ProtoFieldLabel,
    type: string,
    mapKeyType: string | null,
    oneofName: string | null,
  ): ProtoField {
    const name = this.expectIdent();
    this.expectSymbol('=');
    const number = this.integer();
    this.skipFieldOptions();
    this.expectSymbol(';');
    return { name: name.text, number: number.value, label, type, mapKeyType, oneofName, offset };
  }

  private enum_(offset: number, parentFullName: string): ProtoEnum {
    const name = this.expectIdent();
    const fullName = parentFullName === '' ? name.text : `${parentFullName}.${name.text}`;
    const values: ProtoEnumValue[] = [];
    this.expectSymbol('{');
    while (!this.eatSymbol('}')) {
      if (this.eatSymbol(';')) continue;
      const entry = this.expectIdent();
      if (entry.text === 'option' || entry.text === 'reserved') {
        this.skipStatement();
        continue;
      }
      this.expectSymbol('=');
      const number = this.integer();
      this.skipFieldOptions();
      this.expectSymbol(';');
      values.push({ name: entry.text, number: number.value, offset: entry.offset });
    }
    return { name: name.text, fullName, values, offset };
  }

  private service(offset: number, packageName: string): ProtoService {
    const name = this.expectIdent();
    const fullName = packageName === '' ? name.text : `${packageName}.${name.text}`;
    const rpcs: ProtoRpc[] = [];
    this.expectSymbol('{');
    while (!this.eatSymbol('}')) {
      if (this.eatSymbol(';')) continue;
      const token = this.expectIdent();
      if (token.text === 'option') {
        this.skipStatement();
        continue;
      }
      if (token.text !== 'rpc') this.fail(`Expected \`rpc\` but found \`${token.text}\``, token.offset);
      rpcs.push(this.rpc(token.offset));
    }
    return { name: name.text, fullName, rpcs, offset };
  }

  private rpc(offset: number): ProtoRpc {
    const name = this.expectIdent();
    this.expectSymbol('(');
    const clientStreaming = this.eatIdent('stream');
    const inputType = this.dottedName();
    this.expectSymbol(')');
    const returnsToken = this.expectIdent();
    if (returnsToken.text !== 'returns') {
      this.fail(`Expected \`returns\` but found \`${returnsToken.text}\``, returnsToken.offset);
    }
    this.expectSymbol('(');
    const serverStreaming = this.eatIdent('stream');
    const outputType = this.dottedName();
    this.expectSymbol(')');
    // Body carries only options — consumed; a plain `;` ends it.
    if (!this.eatSymbol(';')) this.skipBlock();
    const streaming: ProtoStreamingShape =
      clientStreaming && serverStreaming
        ? 'bidi-streaming'
        : clientStreaming
          ? 'client-streaming'
          : serverStreaming
            ? 'server-streaming'
            : 'unary';
    return { name: name.text, inputType, outputType, clientStreaming, serverStreaming, streaming, offset };
  }
}

/**
 * Parse one `.proto` source file into its structural census. Throws
 * `ProtoParseError` (position in the message) on malformed input.
 */
export function parseProto(source: string): ProtoCensus {
  return new Parser(source, tokenize(source)).parse();
}
