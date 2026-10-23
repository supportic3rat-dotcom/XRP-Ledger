"""Convert a design .dc.html template into JSX, section by section.

One-off porting aid for apps/web: every attribute, style and text run is carried over exactly, so the
React markup renders like the reference. {{expr}} becomes `v.expr` (or the loop variable), <sc-if>
becomes a conditional, <sc-for> a map, <dc-import> a component. Usage:
    python3 tools/dc2jsx.py reference/design-source/project/Main.dc.html out_dir
"""
import json
import re
import sys
from html.parser import HTMLParser

VOID = {'input', 'br', 'img', 'hr', 'meta', 'link'}
ATTR = {'class': 'className', 'for': 'htmlFor', 'tabindex': 'tabIndex', 'viewbox': 'viewBox', 'onclick': 'onClick',
        'onchange': 'onChange', 'onkeydown': 'onKeyDown', 'inputmode': 'inputMode', 'autocomplete': 'autoComplete',
        'spellcheck': 'spellCheck', 'preserveaspectratio': 'preserveAspectRatio', 'onmousemove': 'onMouseMove',
        'onmouseleave': 'onMouseLeave', 'readonly': 'readOnly'}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.children = tag, attrs, parent, []


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)

    def handle_comment(self, data):
        self.cur.children.append(Node('#comment', [('text', data)], self.cur))


EXPR = re.compile(r'\{\{\s*(.+?)\s*\}\}')


def expr(e, loops):
    e = e.strip()
    if e in ('true', 'false', 'null') or re.fullmatch(r'-?\d+(\.\d+)?', e):
        return e
    root = re.match(r'[A-Za-z_$][\w$]*', e).group(0)
    return e if root in loops else f'v.{e}'


def interp(s, loops):
    """Attribute or style value → JS expression string."""
    m = EXPR.fullmatch(s.strip())
    if m:
        return expr(m.group(1), loops)
    if not EXPR.search(s):
        return json.dumps(s, ensure_ascii=False)
    out = EXPR.sub(lambda m: '${' + expr(m.group(1), loops) + '}', s.replace('`', '\\`'))
    return '`' + out + '`'


def style_obj(s, loops):
    parts = []
    for decl in [d for d in s.split(';') if d.strip()]:
        k, _, val = decl.partition(':')
        k = k.strip()
        key = json.dumps(k) if k.startswith('--') else re.sub(r'-([a-z])', lambda m: m.group(1).upper(), k)
        if key.startswith('Webkit'):
            pass
        parts.append(f'{key}: {interp(val.strip(), loops)}')
    return '{ ' + ', '.join(parts) + ' }'


def attrs_jsx(n, loops):
    out = []
    for k, val in n.attrs:
        if k.startswith('hint-') or k == 'data-dc-script':
            continue
        name = ATTR.get(k, k)
        if val is None:
            out.append(name)
            continue
        if k == 'style':
            out.append(f'style={{{style_obj(val, loops)}}}')
            continue
        js = interp(val, loops)
        if js.startswith('"') and not js.startswith('"{'):
            out.append(f'{name}={js}')
        else:
            out.append(f'{name}={{{js}}}')
    return (' ' + ' '.join(out)) if out else ''


def text_jsx(t, loops):
    if not t:
        return ''
    collapsed = re.sub(r'\s+', ' ', t)
    if collapsed == ' ':
        return "{' '}"
    parts = []
    pos = 0
    for m in EXPR.finditer(collapsed):
        parts.append(('t', collapsed[pos:m.start()]))
        parts.append(('e', expr(m.group(1), loops)))
        pos = m.end()
    parts.append(('t', collapsed[pos:]))
    out = ''
    for kind, val in parts:
        if kind == 'e':
            out += '{' + val + '}'
            continue
        if not val:
            continue
        lead = val.startswith(' ')
        trail = val.endswith(' ') and len(val) > 1
        core = val.strip()
        esc = core.replace('{', "{'{'}").replace('}', "{'}'}").replace('<', '&lt;').replace('>', '&gt;')
        out += ("{' '}" if lead else '') + esc + ("{' '}" if trail else '')
    return out


FLEX_CLASSES = {'app', 'sidebar', 'nav', 'side-foot', 'nav-item', 'account-btn', 'card-head', 'btn', 'link-btn', 'icon-btn', 'seg',
                'seg-btn', 'row', 'col-head', 'glyph', 'tx-ic', 'chg', 'status', 'banner', 'field', 'input-wrap', 'readonly', 'kv',
                'kv-row', 'overlay', 'dlg-head', 'dlg-body', 'dlg-foot', 'steps', 'step', 'menu', 'menu-item', 'toast',
                'accordion-btn', 'toggle'}


def is_flex(n):
    """Whitespace between children is invisible in flex/grid/svg/table/list containers (and at their edges)."""
    while n is not None and n.tag in ('sc-if', 'sc-for'):
        n = n.parent
    if n is None or n.tag == '#root':
        return False
    if n.tag in ('svg', 'ul', 'ol', 'dl', 'table', 'thead', 'tbody', 'tr', 'select'):
        return True
    a = dict(n.attrs)
    if re.search(r'display:\s*(inline-)?(flex|grid)', a.get('style') or ''):
        return True
    return bool(set((a.get('class') or '').replace('{{', ' ').split()) & FLEX_CLASSES)


def jsx(n, loops, ind):
    pad = '  ' * ind
    if isinstance(n, str):
        return ''
    if n.tag == '#comment':
        return f"{pad}{{/* {n.attrs[0][1].strip()} */}}"
    a = dict(n.attrs)
    if n.tag == 'sc-if':
        body = children(n, loops, ind + 1)
        return f"{pad}{{{interp(a['value'], loops)} ? (\n{pad}  <>\n{body}\n{pad}  </>\n{pad}) : null}}"
    if n.tag == 'sc-for':
        var = a.get('as', 'item')
        body = children(n, loops | {var}, ind + 2)
        return f"{pad}{{{interp(a['list'], loops)}.map(({var}, index) => (\n{pad}  <Fragment key={{index}}>\n{body}\n{pad}  </Fragment>\n{pad}))}}"
    if n.tag == 'dc-import':
        props = ' '.join(f'{k}={{{interp(val, loops)}}}' for k, val in n.attrs if k not in ('name',) and not k.startswith('hint-'))
        return f"{pad}<{a['name']} {props} />"
    tag = n.tag
    if tag in VOID:
        return f'{pad}<{tag}{attrs_jsx(n, loops)} />'
    body = children(n, loops, ind + 1)
    if not body.strip():
        return f'{pad}<{tag}{attrs_jsx(n, loops)}></{tag}>'
    return f'{pad}<{tag}{attrs_jsx(n, loops)}>\n{body}\n{pad}</{tag}>'


def children(n, loops, ind):
    flex = is_flex(n)
    pad = '  ' * ind
    parts = []
    for c in n.children:
        if isinstance(c, str):
            t = c.strip() if flex else c
            if flex and not t:
                continue
            j = text_jsx(t, loops)
            if j.strip():
                parts.append(pad + j)
        else:
            parts.append(jsx(c, loops, ind))
    return '\n'.join(p for p in parts if p.strip())


if __name__ == '__main__':
    src, out_dir = sys.argv[1], sys.argv[2]
    text = open(src, encoding='utf-8').read()
    body = text[text.index('</helmet>') + len('</helmet>'): text.index('</x-dc>')]
    t = Tree()
    t.feed(body)
    app = next(c for c in t.root.children if not isinstance(c, str) and c.tag == 'div')
    print(jsx(app, set(), 0))


def emit_sections(src, out_dir, sections):
    """sections: list of (ComponentName, predicate(node) -> bool, children_only)."""
    import os
    text = open(src, encoding='utf-8').read()
    body = text[text.index('</helmet>') + len('</helmet>'): text.index('</x-dc>')]
    t = Tree()
    t.feed(body)
    found = {}

    def walk(n):
        if isinstance(n, str):
            return
        for name, pred, only_children in sections:
            if name not in found and pred(n):
                found[name] = (n, only_children)
                return
        for c in n.children:
            walk(c)

    walk(t.root)
    os.makedirs(out_dir, exist_ok=True)
    for name, (n, only_children) in found.items():
        markup = children(n, set(), 2) if only_children else jsx(n, set(), 2)
        imports = ["import type { Vals } from '@/lib/useDashboard';"]
        if 'Fragment' in markup:
            imports.insert(0, "import { Fragment } from 'react';")
        if 'PerformanceChart' in markup:
            imports.append("import { PerformanceChart } from '../PerformanceChart';")
        with open(f'{out_dir}/{name}.tsx', 'w', encoding='utf-8') as f:
            f.write('\n'.join(imports) + '\n\n')
            f.write(f'/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */\n')
            f.write(f'export const {name} = ({{ v }}: {{ v: Vals }}) => (\n  <>\n{markup}\n  </>\n);\n')
    return sorted(found)
