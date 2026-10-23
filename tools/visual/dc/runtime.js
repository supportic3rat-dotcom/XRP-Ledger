// Verification-only renderer for the design's .dc.html files (the prototype runtime, support.js, isn't in the
// reference folder). Renders <x-dc> templates with {{…}} interpolation, <sc-if>, <sc-for>, <dc-import> and the
// file's DCLogic component, and wires its event handlers so states can be clicked through. Never used by the apps.
class DCLogic {
  constructor(props) {
    this.props = props;
    this.state = {};
  }
  setState(patch) {
    const prev = this.state;
    this.state = { ...this.state, ...(typeof patch === 'function' ? patch(this.state, this.props) : patch) };
    this.__rerender?.(prev);
  }
}
window.DCLogic = DCLogic;

const parse = async (src) => {
  const text = await (await fetch(src)).text();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const script = doc.querySelector('script[data-dc-script]');
  const xdc = doc.querySelector('x-dc');
  const propsSpec = script ? JSON.parse(script.getAttribute('data-props') || '{}') : {};
  const defaults = Object.fromEntries(Object.entries(propsSpec).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.default]));
  const Component = script ? new Function('DCLogic', `${script.textContent}\nreturn typeof Component !== 'undefined' ? Component : null;`)(DCLogic) : null;
  return { xdc, defaults, Component };
};

const evaluate = (expr, scope) => {
  try {
    return new Function('scope', `with (scope) { return (${expr}); }`)(scope);
  } catch {
    return undefined;
  }
};
const ONLY = /^\{\{([\s\S]+?)\}\}$/;
const interp = (str, scope) => str.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => {
  const v = evaluate(e, scope);
  return v === undefined || v === null || v === false ? '' : String(v);
});
const BOOL = new Set(['disabled', 'checked', 'selected', 'hidden', 'readonly', 'required', 'open']);
const EVENTS = { onclick: 'click', onchange: 'input', onkeydown: 'keydown', oninput: 'input', onblur: 'blur', onfocus: 'focus', onsubmit: 'submit' };

const imports = new Map();

const renderNodes = async (nodes, scope, out, refs) => {
  for (const node of nodes) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interp(node.textContent, scope)));
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'helmet') continue;
    if (tag === 'sc-if') {
      if (evaluate(node.getAttribute('value').replace(ONLY, '$1'), scope)) await renderNodes([...node.childNodes], scope, out, refs);
      continue;
    }
    if (tag === 'sc-for') {
      const list = evaluate(node.getAttribute('list').replace(ONLY, '$1'), scope) || [];
      const as = node.getAttribute('as') || 'item';
      for (let i = 0; i < list.length; i++) await renderNodes([...node.childNodes], Object.assign(Object.create(scope), { [as]: list[i], index: i }), out, refs);
      continue;
    }
    if (tag === 'dc-import') {
      const props = {};
      for (const a of node.attributes) {
        if (a.name === 'name' || a.name.startsWith('hint-')) continue;
        const m = a.value.match(ONLY);
        props[a.name] = m ? evaluate(m[1], scope) : interp(a.value, scope);
      }
      const host = document.createElement('div');
      out.appendChild(host);
      await mount(`${node.getAttribute('name')}.dc.html`, props, host, {});
      continue;
    }
    const el = document.createElementNS(node.namespaceURI, node.localName);
    for (const a of node.attributes) {
      const name = a.name.toLowerCase();
      const m = a.value.match(ONLY);
      if (EVENTS[name]) {
        const fn = m ? evaluate(m[1], scope) : null;
        if (typeof fn === 'function') el.addEventListener(EVENTS[name], (e) => fn(e));
        continue;
      }
      if (name === 'ref') {
        const fn = m ? evaluate(m[1], scope) : null;
        if (typeof fn === 'function') refs.push(() => fn(el));
        continue;
      }
      if (name.startsWith('hint-')) continue;
      if (BOOL.has(name) && m) {
        if (evaluate(m[1], scope)) el.setAttribute(a.name, '');
        continue;
      }
      if (name === 'value' && m) {
        refs.push(() => {
          el.value = evaluate(m[1], scope) ?? '';
        });
        continue;
      }
      el.setAttribute(a.name, m ? (() => {
        const v = evaluate(m[1], scope);
        return v === undefined || v === null ? '' : String(v);
      })() : interp(a.value, scope));
    }
    await renderNodes([...(tag === 'template' ? node.content.childNodes : node.childNodes)], scope, el, refs);
    out.appendChild(el);
  }
};

const mount = async (src, props, host, initialState) => {
  if (!imports.has(src)) imports.set(src, await parse(new URL(src, window.__dcBase).href));
  const { xdc, defaults, Component } = imports.get(src);
  for (const h of xdc.querySelectorAll('helmet > *')) {
    const key = h.outerHTML;
    if (![...document.head.children].some((c) => c.outerHTML === key)) document.head.appendChild(h.cloneNode(true));
  }
  const allProps = { ...defaults, ...props };
  const inst = Component ? new Component(allProps) : null;
  if (inst) Object.assign(inst.state, initialState);
  const draw = async (prev) => {
    const vals = inst ? inst.renderVals() : {};
    const scope = Object.assign(Object.create(null), allProps, vals);
    const frag = document.createDocumentFragment();
    const refs = [];
    const nodes = [...xdc.childNodes].filter((n) => !(n.nodeType === 1 && n.tagName.toLowerCase() === 'helmet'));
    await renderNodes(nodes, scope, frag, refs);
    host.replaceChildren(frag);
    refs.forEach((r) => r());
    if (prev && inst.componentDidUpdate) inst.componentDidUpdate(inst.props, prev);
  };
  if (inst) inst.__rerender = (prev) => void draw(prev);
  await draw(null);
  if (inst?.componentDidMount) inst.componentDidMount();
  return inst;
};

// view.html?src=<path to .dc.html>&props=<json>&state=<json>
const q = new URLSearchParams(location.search);
window.__dcBase = new URL(q.get('src'), location.href).href;
window.__dc = await mount(new URL(q.get('src'), location.href).href, JSON.parse(q.get('props') || '{}'), document.getElementById('root'), JSON.parse(q.get('state') || '{}'));
document.body.setAttribute('data-dc-ready', '1');
