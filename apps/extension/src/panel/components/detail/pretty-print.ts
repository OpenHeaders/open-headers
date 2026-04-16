import { format } from 'prettier/standalone';

type Parser = 'babel' | 'css' | 'html' | 'json';

const PARSER_MAP: Record<string, Parser> = {
  javascript: 'babel',
  css: 'css',
  html: 'html',
  json: 'json',
};

async function getPlugins(parser: Parser) {
  switch (parser) {
    case 'babel': {
      const [babel, estree] = await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]);
      return [babel.default ?? babel, estree.default ?? estree];
    }
    case 'css': {
      const css = await import('prettier/plugins/postcss');
      return [css.default ?? css];
    }
    case 'html': {
      const html = await import('prettier/plugins/html');
      return [html.default ?? html];
    }
    case 'json': {
      const [babel, estree] = await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]);
      return [babel.default ?? babel, estree.default ?? estree];
    }
  }
}

export async function prettyPrintCode(source: string, language: string): Promise<string> {
  const parser = PARSER_MAP[language];
  if (!parser) return source;
  try {
    const plugins = await getPlugins(parser);
    return await format(source, {
      parser,
      plugins,
      printWidth: 80,
      tabWidth: 2,
      singleQuote: true,
    });
  } catch {
    return source;
  }
}
