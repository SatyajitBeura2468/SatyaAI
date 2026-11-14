import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/markdown';

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe('Markdown renderer', () => {
  it('renders bold, italic and inline code', () => {
    expect(html('The **mole** is *useful* for `n = m/M`')).toContain('<strong>mole</strong>');
    expect(html('The **mole** is *useful* for `n = m/M`')).toContain('<em>useful</em>');
    expect(html('The **mole** is *useful* for `n = m/M`')).toContain('<code>n = m/M</code>');
  });
  it('renders bullet and numbered lists', () => {
    expect(html('- one\n- two')).toMatch(/<ul><li>one<\/li><li>two<\/li><\/ul>/);
    expect(html('1. first\n2. second')).toMatch(/<ol><li>first<\/li><li>second<\/li><\/ol>/);
  });
  it('renders fenced code blocks, even if the closing fence has not streamed in yet', () => {
    expect(html('```py\nprint(1)\n```')).toContain('<pre><code>print(1)</code></pre>');
    expect(html('```py\nprint(1)')).toContain('<pre><code>print(1)</code></pre>');
  });
  it('renders headings and keeps paragraphs separate', () => {
    expect(html('## Title\n\nHello\n\nWorld')).toContain('md-h2');
    expect((html('Hello\n\nWorld').match(/<p>/g) || []).length).toBe(2);
  });
  it('never injects HTML: tags in model output are escaped', () => {
    const out = html('<script>alert(1)</script> and <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });
  it('does not treat 2 * 3 * 4 or snake_case as formatting', () => {
    expect(html('2 * 3 * 4 and molar_mass_value')).not.toContain('<em>');
  });
  it('a line starting with bold is a paragraph, not a bullet', () => {
    expect(html('**Note:** careful')).toContain('<p><strong>Note:</strong> careful</p>');
  });
});
