// Carrega o script de index.html num contexto isolado do Node, com um DOM mínimo,
// e devolve as funções de cálculo para os testes. Cada chamada cria um app novo.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = path.join(__dirname, '..', 'index.html');

function scriptDoSite() {
  const html = fs.readFileSync(HTML, 'utf8');
  const ini = html.indexOf('<script>');
  const fim = html.indexOf('</script>', ini);
  if (ini < 0 || fim < 0) throw new Error('Script principal não encontrado em index.html');
  return html.slice(ini + '<script>'.length, fim);
}

function elementoFalso(id) {
  return {
    id, innerHTML: '', textContent: '', hidden: false, style: {}, dataset: {}, value: '',
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    scrollIntoView() {}, getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 }; }
  };
}

function carregarApp(guardado = null) {
  const els = {};
  const memoria = guardado ? { 'escala5x2:v3': JSON.stringify(guardado) } : {};
  const document = {
    getElementById: (id) => els[id] || (els[id] = elementoFalso(id)),
    documentElement: { style: {}, dataset: {}, scrollHeight: 0, classList: { toggle() {}, add() {}, remove() {} } },
    body: { dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } },
    head: { appendChild() {} },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return elementoFalso(''); }
  };
  const localStorage = {
    getItem: (k) => (k in memoria ? memoria[k] : null),
    setItem: (k, v) => { memoria[k] = String(v); },
    removeItem: (k) => { delete memoria[k]; }
  };
  const window = { XLSX: require('xlsx'), scrollTo() {}, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const { jsPDF } = require('jspdf');
  require('jspdf-autotable');
  window.jspdf = { jsPDF };
  const ctx = vm.createContext({
    window, document, localStorage, console, Intl, Math, Date, JSON, Number, String, Array, Object, Set, Map, Promise,
    setTimeout, clearTimeout, isFinite, parseFloat, parseInt, innerHeight: 800, innerWidth: 1280, scrollBy() {}, scrollTo() {},
    navigator: { userAgent: 'node' }, location: { hash: '', href: 'file:///x', pathname: '/x', search: '' }, history: { replaceState() {} }, requestAnimationFrame: (f) => f(), getComputedStyle: () => ({})
  });
  // Expõe o que os testes usam; o código do site não muda
  const exporta = `
;globalThis.__app = {
  compute, analisar, combinacoesSetor, alternativasSetor, transicao, normalizar, blank, horarioVazio, novoSetor, buildSchedule, opcoesEscalaHTML,
  renderResults, renderForms, alternativas, montarPDF, montarExcel, resumoCenario, custoNoturno, diasAlta, feriadosAno,
  get state() { return state; }, set state(v) { state = v; },
  get cenarios() { return cenarios; }, set cenarios(v) { cenarios = v; },
  ui, els: null
};`;
  vm.runInContext(scriptDoSite() + exporta, ctx, { filename: 'index.html#script' });
  const app = ctx.__app;
  app.els = els;
  return app;
}

module.exports = { carregarApp, HTML };
