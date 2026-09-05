/**
 * Printer — the exact pretty and compact forms (the editor's prettify
 * and the wire's canonical text), string escaping, and the block-string
 * printer's edge cases.
 */

import { printBlockString, printCompact, printNode, printString } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from './helpers';

describe('graphql printer — pretty', () => {
  it('prints an operation with two-space indentation and one selection per line', () => {
    const source =
      'query Users($first:Int=10,$role:Role){users(first:$first,role:$role)@include(if:true){edges{node{id ...F}}}}fragment F on User{name}';
    expect(printNode(parseOrThrow(source))).toBe(
      [
        'query Users($first: Int = 10, $role: Role) {',
        '  users(first: $first, role: $role) @include(if: true) {',
        '    edges {',
        '      node {',
        '        id',
        '        ...F',
        '      }',
        '    }',
        '  }',
        '}',
        '',
        'fragment F on User {',
        '  name',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('prints the shorthand query without the keyword', () => {
    expect(printNode(parseOrThrow('query{a}'))).toBe('{\n  a\n}\n');
  });

  it('prints SDL with descriptions on their own lines and argument descriptions multi-line', () => {
    const source =
      '"""Desc""" type T implements A & B @d { "f desc" f("a desc" a: Int = 1, b: String): [T!]! @deprecated }';
    expect(printNode(parseOrThrow(source))).toBe(
      [
        '"""Desc"""',
        'type T implements A & B @d {',
        '  "f desc"',
        '  f(',
        '    "a desc"',
        '    a: Int = 1',
        '    b: String',
        '  ): [T!]! @deprecated',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('prints union members, enum values, inputs and directive definitions', () => {
    const source =
      'union U = A | B enum E { A B } input I { a: Int = 1 } directive @d(a: Int) repeatable on FIELD | QUERY extend union U = C';
    expect(printNode(parseOrThrow(source))).toBe(
      [
        'union U = A | B',
        '',
        'enum E {',
        '  A',
        '  B',
        '}',
        '',
        'input I {',
        '  a: Int = 1',
        '}',
        '',
        'directive @d(a: Int) repeatable on FIELD | QUERY',
        '',
        'extend union U = C',
        '',
      ].join('\n'),
    );
  });
});

describe('graphql printer — compact', () => {
  it('prints the minimum-whitespace form', () => {
    const source =
      'query Q($a: Int = 1) @d { u: user(id: $a, f: { x: [1, 2] }) { id ... on User @skip(if: false) { name } } }';
    expect(printCompact(parseOrThrow(source))).toBe(
      'query Q($a: Int = 1) @d {u: user(id: $a,f: {x: [1,2]}) {id ... on User @skip(if: false) {name}}}',
    );
  });
});

describe('graphql printer — strings', () => {
  it('escapes the spec set', () => {
    expect(printString('a"b\\c\nd\te')).toBe('"a\\"b\\\\c\\nd\\te\\u0007"');
  });

  it('prints a short block string on one line', () => {
    expect(printBlockString('hello')).toBe('"""hello"""');
  });

  it('prints multi-line block strings with the leading newline', () => {
    expect(printBlockString('a\nb')).toBe('"""\na\nb\n"""');
  });

  it('escapes triple quotes and forces the multi-line form for trailing quotes', () => {
    expect(printBlockString('say """hi"""')).toBe('"""\nsay \\"""hi\\"""\n"""');
    expect(printBlockString('ends"')).toBe('"""\nends"\n"""');
  });
});
