/**
 * GraphQL printer — the AST back to source. Two forms over one walk:
 * PRETTY (the editor's prettify: two-space indent, one selection per
 * line, descriptions on their own lines) and COMPACT (a canonical
 * single-line form with the minimum whitespace the grammar needs — the
 * wire text and content hashes). Both re-parse to the same AST, which
 * the unit matrix pins with parse → print → parse round trips.
 */

import type {
  AstNode,
  DefinitionNode,
  DirectiveNode,
  InputValueDefinitionNode,
  StringValueNode,
  ValueNode,
} from './types';

export interface PrintOptions {
  /** Two-space indented multi-line output (default) vs the compact form. */
  readonly pretty?: boolean;
}

function isWhiteSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t';
}

/** Print a block string the way the spec reads it back — the
 *  indentation algorithm removes what the indent adds. */
export function printBlockString(value: string): string {
  const escaped = value.replace(/"""/g, '\\"""');
  const lines = escaped.split(/\r\n|[\n\r]/g);
  const isSingleLine = lines.length === 1;
  const forceLeadingNewLine =
    lines.length > 1 && lines.slice(1).every((line) => line.length === 0 || isWhiteSpace(line[0]));
  const hasTrailingTripleQuotes = escaped.endsWith('\\"""');
  const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
  const hasTrailingSlash = value.endsWith('\\');
  const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;
  const printAsMultipleLines =
    !isSingleLine || value.length > 70 || forceTrailingNewline || forceLeadingNewLine || hasTrailingTripleQuotes;
  let out = '';
  const skipLeadingNewLine = isSingleLine && isWhiteSpace(value[0]);
  if ((printAsMultipleLines && !skipLeadingNewLine) || forceLeadingNewLine) out += '\n';
  out += escaped;
  if (printAsMultipleLines || forceTrailingNewline) out += '\n';
  return `"""${out}"""`;
}

/** Print a plain string with the spec's escape set. */
export function printString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

class Printer {
  constructor(private readonly pretty: boolean) {}

  private indent(text: string): string {
    return text.replace(/\n/g, '\n  ');
  }

  /** `{ a b }` bodies — one item per line when pretty. */
  private block(items: readonly string[]): string {
    if (items.length === 0) return '';
    if (!this.pretty) return `{${items.join(' ')}}`;
    return `{\n  ${this.indent(items.join('\n'))}\n}`;
  }

  private wrap(open: string, items: readonly string[], close: string, separator = this.pretty ? ', ' : ','): string {
    return items.length === 0 ? '' : `${open}${items.join(separator)}${close}`;
  }

  private join(parts: readonly string[], separator = ' '): string {
    return parts.filter((part) => part !== '').join(separator);
  }

  private description(node: StringValueNode | null): string {
    if (node === null) return '';
    const printed = this.string(node);
    return this.pretty ? `${printed}\n` : `${printed} `;
  }

  private string(node: StringValueNode): string {
    return node.block ? printBlockString(node.value) : printString(node.value);
  }

  private directives(nodes: readonly DirectiveNode[]): string {
    return nodes.map((node) => this.print(node)).join(' ');
  }

  value(node: ValueNode): string {
    return this.print(node);
  }

  print(node: AstNode): string {
    switch (node.kind) {
      case 'Name':
        return node.value;
      case 'Variable':
        return `$${node.name.value}`;
      case 'Document':
        return this.pretty
          ? `${node.definitions.map((definition) => this.print(definition)).join('\n\n')}\n`
          : node.definitions.map((definition) => this.print(definition)).join(' ');
      case 'OperationDefinition': {
        const variables = this.wrap(
          '(',
          node.variableDefinitions.map((v) => this.print(v)),
          ')',
        );
        const shorthand =
          node.operation === 'query' &&
          node.name === null &&
          node.variableDefinitions.length === 0 &&
          node.directives.length === 0;
        if (shorthand) return this.print(node.selectionSet);
        const head = this.join([node.operation, `${node.name === null ? '' : node.name.value}${variables}`], ' ');
        return this.join([head, this.directives(node.directives), this.print(node.selectionSet)]);
      }
      case 'VariableDefinition':
        return this.join([
          `${this.print(node.variable)}: ${this.print(node.type)}`,
          node.defaultValue === null ? '' : `= ${this.print(node.defaultValue)}`,
          this.directives(node.directives),
        ]);
      case 'SelectionSet':
        return this.block(node.selections.map((selection) => this.print(selection)));
      case 'Field': {
        const alias = node.alias === null ? '' : `${node.alias.value}: `;
        const args = this.wrap(
          '(',
          node.arguments.map((arg) => this.print(arg)),
          ')',
        );
        return this.join([
          `${alias}${node.name.value}${args}`,
          this.directives(node.directives),
          node.selectionSet === null ? '' : this.print(node.selectionSet),
        ]);
      }
      case 'Argument':
      case 'ObjectField':
        return `${node.name.value}: ${this.print(node.value)}`;
      case 'FragmentSpread':
        return this.join([`...${node.name.value}`, this.directives(node.directives)]);
      case 'InlineFragment':
        return this.join([
          '...',
          node.typeCondition === null ? '' : `on ${node.typeCondition.name.value}`,
          this.directives(node.directives),
          this.print(node.selectionSet),
        ]);
      case 'FragmentDefinition':
        return this.join([
          `fragment ${node.name.value} on ${node.typeCondition.name.value}`,
          this.directives(node.directives),
          this.print(node.selectionSet),
        ]);
      case 'IntValue':
      case 'FloatValue':
      case 'EnumValue':
        return node.value;
      case 'StringValue':
        return this.string(node);
      case 'BooleanValue':
        return node.value ? 'true' : 'false';
      case 'NullValue':
        return 'null';
      case 'ListValue':
        return `[${node.values.map((value) => this.print(value)).join(this.pretty ? ', ' : ',')}]`;
      case 'ObjectValue': {
        const fields = node.fields.map((field) => this.print(field));
        return this.pretty ? `{ ${fields.join(', ')} }` : `{${fields.join(',')}}`;
      }
      case 'Directive':
        return `@${node.name.value}${this.wrap(
          '(',
          node.arguments.map((arg) => this.print(arg)),
          ')',
        )}`;
      case 'NamedType':
        return node.name.value;
      case 'ListType':
        return `[${this.print(node.type)}]`;
      case 'NonNullType':
        return `${this.print(node.type)}!`;
      case 'SchemaDefinition':
        return this.join([
          `${this.description(node.description)}schema`,
          this.directives(node.directives),
          this.block(node.operationTypes.map((type) => this.print(type))),
        ]);
      case 'SchemaExtension':
        return this.join([
          'extend schema',
          this.directives(node.directives),
          this.block(node.operationTypes.map((type) => this.print(type))),
        ]);
      case 'OperationTypeDefinition':
        return `${node.operation}: ${node.type.name.value}`;
      case 'ScalarTypeDefinition':
        return this.join([
          `${this.description(node.description)}scalar ${node.name.value}`,
          this.directives(node.directives),
        ]);
      case 'ScalarTypeExtension':
        return this.join([`extend scalar ${node.name.value}`, this.directives(node.directives)]);
      case 'ObjectTypeDefinition':
      case 'InterfaceTypeDefinition':
      case 'ObjectTypeExtension':
      case 'InterfaceTypeExtension': {
        const keyword =
          node.kind === 'ObjectTypeDefinition' || node.kind === 'ObjectTypeExtension' ? 'type' : 'interface';
        const extend = node.kind === 'ObjectTypeExtension' || node.kind === 'InterfaceTypeExtension' ? 'extend ' : '';
        const description =
          node.kind === 'ObjectTypeDefinition' || node.kind === 'InterfaceTypeDefinition'
            ? this.description(node.description)
            : '';
        return this.join([
          `${description}${extend}${keyword} ${node.name.value}`,
          this.wrap(
            'implements ',
            node.interfaces.map((type) => this.print(type)),
            '',
            ' & ',
          ),
          this.directives(node.directives),
          this.block(node.fields.map((field) => this.print(field))),
        ]);
      }
      case 'FieldDefinition': {
        const args = this.arguments_(node.arguments);
        return this.join([
          `${this.description(node.description)}${node.name.value}${args}: ${this.print(node.type)}`,
          this.directives(node.directives),
        ]);
      }
      case 'InputValueDefinition':
        return this.join([
          `${this.description(node.description)}${node.name.value}: ${this.print(node.type)}`,
          node.defaultValue === null ? '' : `= ${this.print(node.defaultValue)}`,
          this.directives(node.directives),
        ]);
      case 'UnionTypeDefinition':
      case 'UnionTypeExtension': {
        const head =
          node.kind === 'UnionTypeDefinition' ? `${this.description(node.description)}union` : 'extend union';
        return this.join([
          `${head} ${node.name.value}`,
          this.directives(node.directives),
          this.wrap(
            '= ',
            node.types.map((type) => this.print(type)),
            '',
            ' | ',
          ),
        ]);
      }
      case 'EnumTypeDefinition':
      case 'EnumTypeExtension': {
        const head = node.kind === 'EnumTypeDefinition' ? `${this.description(node.description)}enum` : 'extend enum';
        return this.join([
          `${head} ${node.name.value}`,
          this.directives(node.directives),
          this.block(node.values.map((value) => this.print(value))),
        ]);
      }
      case 'EnumValueDefinition':
        return this.join([`${this.description(node.description)}${node.name.value}`, this.directives(node.directives)]);
      case 'InputObjectTypeDefinition':
      case 'InputObjectTypeExtension': {
        const head =
          node.kind === 'InputObjectTypeDefinition' ? `${this.description(node.description)}input` : 'extend input';
        return this.join([
          `${head} ${node.name.value}`,
          this.directives(node.directives),
          this.block(node.fields.map((field) => this.print(field))),
        ]);
      }
      case 'DirectiveDefinition':
        return this.join([
          `${this.description(node.description)}directive @${node.name.value}${this.arguments_(node.arguments)}`,
          node.repeatable ? 'repeatable' : '',
          `on ${node.locations.map((location) => location.value).join(' | ')}`,
        ]);
    }
  }

  /** SDL argument lists — multi-line when any argument carries a
   *  description, so the description stays on its own line. */
  private arguments_(nodes: readonly InputValueDefinitionNode[]): string {
    if (nodes.length === 0) return '';
    const printed = nodes.map((node) => this.print(node));
    if (this.pretty && nodes.some((node) => node.description !== null)) {
      return `(\n  ${this.indent(printed.join('\n'))}\n)`;
    }
    return `(${printed.join(this.pretty ? ', ' : ',')})`;
  }
}

/** Print any AST node — pretty by default, compact on request. */
export function printNode(node: AstNode, options: PrintOptions = {}): string {
  return new Printer(options.pretty !== false).print(node);
}

/** Print a definition in the compact single-line form. */
export function printCompact(node: DefinitionNode | AstNode): string {
  return new Printer(false).print(node);
}
