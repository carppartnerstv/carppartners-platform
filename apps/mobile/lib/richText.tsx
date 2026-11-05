import React from 'react';
import { Text, Linking } from 'react-native';
import { colors } from '../theme';

// Parser mínimo para el HTML ya sanitizado en el backend al guardar (ver
// RICH_TEXT_SANITIZE_OPTIONS en admin.js) — solo admite las etiquetas que
// esa sanitización permite: p, br, strong/b, em/i, s, u, a, ul/ol/li.
// Produce un array de nodos <Text> anidados pensado para usarse como
// children de un <Text> ya existente (incluido uno con numberOfLines, p.
// ej. ReadMoreText) — así el recorte de líneas sigue funcionando sobre el
// conjunto, el equivalente más cercano en RN al line-clamp CSS de la web.
function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

interface InlineState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  href: string | null;
}

const BASE_STATE: InlineState = { bold: false, italic: false, underline: false, strike: false, href: null };
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'a']);

export function renderRichText(html: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let key = 0;
  const stack: InlineState[] = [BASE_STATE];
  const current = () => stack[stack.length - 1];
  const listTypeStack: Array<'ul' | 'ol'> = [];
  const olCounters: number[] = [];

  const pushText = (raw: string) => {
    const text = decodeEntities(raw);
    if (!text) return;
    const st = current();
    const style: Record<string, unknown> = {};
    if (st.bold) style.fontFamily = 'Inter_700Bold';
    if (st.italic) style.fontStyle = 'italic';
    if (st.underline && st.strike) style.textDecorationLine = 'underline line-through';
    else if (st.underline) style.textDecorationLine = 'underline';
    else if (st.strike) style.textDecorationLine = 'line-through';
    if (st.href) style.color = colors.brandBright;
    nodes.push(
      <Text key={key++} style={style} onPress={st.href ? () => Linking.openURL(st.href as string) : undefined}>
        {text}
      </Text>,
    );
  };

  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token[0] !== '<') {
      pushText(token);
      continue;
    }
    const closing = token[1] === '/';
    const tagMatch = token.match(/^<\/?\s*([a-zA-Z0-9]+)/);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : '';

    if (tag === 'br') {
      nodes.push('\n');
      continue;
    }
    if (tag === 'p') {
      if (closing) nodes.push('\n');
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (closing) {
        listTypeStack.pop();
        if (tag === 'ol') olCounters.pop();
      } else {
        listTypeStack.push(tag);
        if (tag === 'ol') olCounters.push(0);
      }
      continue;
    }
    if (tag === 'li') {
      if (closing) {
        nodes.push('\n');
      } else {
        const type = listTypeStack[listTypeStack.length - 1];
        if (type === 'ol') {
          olCounters[olCounters.length - 1] += 1;
          nodes.push(`${olCounters[olCounters.length - 1]}. `);
        } else {
          nodes.push('• ');
        }
      }
      continue;
    }
    if (INLINE_TAGS.has(tag)) {
      if (!closing) {
        const next: InlineState = { ...current() };
        if (tag === 'strong' || tag === 'b') next.bold = true;
        if (tag === 'em' || tag === 'i') next.italic = true;
        if (tag === 'u') next.underline = true;
        if (tag === 's') next.strike = true;
        if (tag === 'a') {
          const hrefMatch = token.match(/href="([^"]*)"/);
          next.href = hrefMatch ? hrefMatch[1] : null;
        }
        stack.push(next);
      } else if (stack.length > 1) {
        stack.pop();
      }
    }
    // Cualquier otra etiqueta (no debería aparecer tras el sanitizado del
    // backend) se ignora sin tocar la pila — su contenido se sigue
    // renderizando al nivel de estilo actual.
  }

  while (nodes.length > 0 && nodes[nodes.length - 1] === '\n') nodes.pop();
  return nodes;
}
