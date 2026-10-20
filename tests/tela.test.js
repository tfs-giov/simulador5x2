// Testes de tela no Chromium: fluxo de preenchimento, cenários, acessibilidade (axe-core) e teclado.
// Rodar: npm run test:tela. Usa o Chromium indicado em CHROMIUM_PATH ou o pré-instalado do ambiente.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { HTML } = require('./app');

const PADRAO = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const executavel = process.env.CHROMIUM_PATH || (fs.existsSync(PADRAO) ? PADRAO : undefined);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TELAS = { celular: { width: 390, height: 800, mob: true }, computador: { width: 1280, height: 900, mob: false } };

// A página publicada recebe o esqueleto de documento na publicação; aqui ele é montado igual
const pagina = path.join(os.tmpdir(), 'escala5x2-teste.html');
fs.writeFileSync(pagina, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${fs.readFileSync(HTML, 'utf8')}</body></html>`);

let navegador;
test.before(async () => { navegador = await chromium.launch({ executablePath: executavel }); });
test.after(async () => { await navegador?.close(); });

async function abrir(tela, { modo = 'completo', contexto } = {}) {
  const t = TELAS[tela];
  const ctx = contexto || await navegador.newContext({ viewport: { width: t.width, height: t.height }, isMobile: t.mob, hasTouch: t.mob });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.addInitScript((m) => { if (!localStorage.getItem('escala5x2:modo')) localStorage.setItem('escala5x2:modo', m); localStorage.setItem('escala5x2:aviso', '1'); }, modo);
  await p.goto('file://' + pagina);
  return { p, ctx, erros };
}
// Abre "Mais análises" no resultado (linha do tempo, cenários, compartilhar)
async function abreMais(p) {
  if (await p.$('#results .mais-det')) return;
  await p.click('#results [data-act="det"][data-k="mais"]');
  await p.waitForSelector('#results .mais-det');
}
async function preencher(p, { fim = '20:00', func = '4', minimo = '2' } = {}) {
  for (const i of [0, 1, 2, 3, 4, 5, 6]) await p.click(`#loja [data-act="dia"][data-i="${i}"]`);
  await p.fill('#loja-ini', '08:00');
  await p.fill('#loja-fim', fim);
  const sid = await p.$eval('.setor input[data-p="nome"]', (e) => e.dataset.s);
  await p.fill(`#${sid}-n`, 'Loja');
  await p.fill(`#${sid}-q`, func);
  await p.fill(`#${sid}-sal`, '2000');
  await p.fill(`#${sid}-m`, minimo);
  await p.waitForTimeout(150);
  return sid;
}
const rolagemLateral = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const tela of Object.keys(TELAS)) {
  test(`${tela}: preencher mostra o resultado, sem rolagem lateral nem erros`, async () => {
    const { p, ctx, erros } = await abrir(tela);
    await preencher(p);
    const contratacoes = await p.$eval('#results .tile .v', (e) => e.textContent);
    assert.match(contratacoes, /^\d+$/);
    assert.equal(await rolagemLateral(p), 0);
    // Pergunta dos feriados no passo 1 fica igual à escolha nas premissas
    await p.click('#feriadoQ [data-act="feriado"][data-v="dobro"]');
    await p.click('#results [data-act="det"][data-k="prem"]');
    await p.click('#results [data-act="feriado"][data-v="folga"]');
    assert.equal(await p.$eval('#feriadoQ [aria-pressed="true"]', (e) => e.dataset.v), 'folga');
    // Análises extras ficam recolhidas e abrem num clique
    await abreMais(p);
    assert.ok(await p.$('#sec-tl'), 'linha do tempo dentro de Mais análises');
    assert.deepEqual(erros, []);
    await ctx.close();
  });

  test(`${tela}: acessibilidade sem violações (axe-core)`, async () => {
    const { p, ctx } = await abrir(tela);
    const audita = async () => {
      await p.addScriptTag({ content: AXE });
      return p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }))
        .violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`));
    };
    assert.deepEqual(await audita(), [], 'página vazia');
    const sid = await preencher(p, { fim: '22:00' });
    await p.click('#advBtn');
    await p.click('[data-act="det"][data-k="prem"]');
    await p.click(`[data-act="det"][data-k="s${sid}"]`);
    await p.$$eval('footer details, #results .detail details', (ds) => ds.forEach((d) => { d.open = true; }));
    assert.deepEqual(await audita(), [], 'página preenchida');
    await p.click('#btnContraste');
    assert.deepEqual(await audita(), [], 'alto contraste');
    await ctx.close();
  });
}

test('cenários: guardar, recarregar, abrir e voltar à simulação anterior', async () => {
  const { p, ctx, erros } = await abrir('computador');
  await preencher(p);
  await abreMais(p);
  await p.fill('#cenNome', 'Sete dias');
  await p.click('[data-act="cenSalvar"]');
  await p.click('#loja [data-act="dia"][data-i="6"]'); // fecha domingo
  await p.fill('#cenNome', 'Sem domingo');
  await p.click('[data-act="cenSalvar"]');
  assert.deepEqual(await p.$$eval('table.cen thead th', (t) => t.map((x) => x.textContent)), ['', 'Atual', 'Sete dias', 'Sem domingo']);
  await p.reload();
  assert.deepEqual(await p.evaluate(() => cenarios.map((c) => c.nome)), ['Sete dias', 'Sem domingo']);
  await abreMais(p);
  await p.click('[data-act="cenAbrir"][data-i="0"]');
  assert.equal(await p.evaluate(() => state.loja.dias[6]), true, 'abriu o cenário com domingo');
  await p.click('[data-act="cenVoltar"]');
  assert.equal(await p.evaluate(() => state.loja.dias[6]), false, 'voltou à simulação sem domingo');
  await p.click('[data-act="cenApagar"][data-i="1"]');
  assert.deepEqual(await p.evaluate(() => cenarios.map((c) => c.nome)), ['Sete dias']);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('escala: dias de alta demanda e opções que só aparecem quando mudam algo', async () => {
  const { p, ctx } = await abrir('computador');
  await preencher(p, { fim: '17:00', func: '8', minimo: '3' });
  await p.click('[data-act="alta"][data-i="5"]');
  assert.equal(await p.$eval('[data-act="alta"][data-i="5"]', (e) => e.getAttribute('aria-pressed')), 'true');
  const folgasSabado = await p.evaluate(() => compute().res[0].grupos.reduce((a, g) => a + g.sched.weeks.reduce((b, grid) => b + grid.filter((r) => r[5] === 'F').length, 0), 0));
  assert.equal(folgasSabado, 0);
  // Segunda a sexta: as folgas caem no fim de semana fechado, então as opções somem
  await p.click('#loja [data-act="dia"][data-i="5"]');
  await p.click('#loja [data-act="dia"][data-i="6"]');
  await p.waitForTimeout(150);
  assert.equal(await p.$('#turnosEx [data-act="equilibrar"]'), null);
  assert.equal(await p.$('#turnosEx [data-act="seguidas"]'), null);
  await ctx.close();
});

test('teclado: o elemento com foco nunca fica escondido sob a barra ou o topo fixos', async () => {
  const { p, ctx } = await abrir('computador');
  await preencher(p);
  await p.evaluate(() => { scrollTo(0, 0); document.querySelector('.a11y a').focus(); });
  const escondidos = new Set();
  for (let i = 0; i < 120; i++) {
    await p.keyboard.press('Tab');
    const x = await p.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body || e.closest('.topbar, .a11y, #bar')) return null;
      const r = e.getBoundingClientRect(), bar = document.getElementById('bar'), topo = document.querySelector('.topbar').getBoundingClientRect();
      const sobBarra = !bar.hidden && r.bottom > bar.getBoundingClientRect().top + 1;
      const sobTopo = r.top < topo.bottom - 1;
      return sobBarra || sobTopo ? (e.id || e.dataset.act || e.tagName) : '';
    });
    if (x) escondidos.add(x);
  }
  assert.deepEqual([...escondidos], []);
  await ctx.close();
});

test('passo a passo: avança pelas etapas e mostra o resultado no passo 4', async () => {
  const { p, ctx, erros } = await abrir('celular', { modo: 'passo' });
  const visivel = (sel) => p.$eval(sel, (e) => !!e.offsetParent || getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0);
  assert.equal(await visivel('#loja'), true);
  assert.equal(await visivel('#resultado'), false);
  await p.click('#wizNext'); // sem dias: não avança
  assert.equal(await visivel('#loja'), true);
  for (const i of [0, 1, 2, 3, 4, 5]) await p.click(`#loja [data-act="dia"][data-i="${i}"]`);
  await p.fill('#loja-ini', '08:00'); await p.fill('#loja-fim', '18:00');
  await p.click('#wizNext');
  const sid = await p.$eval('.setor input[data-p="nome"]', (e) => e.dataset.s);
  await p.fill(`#${sid}-n`, 'Loja'); await p.fill(`#${sid}-q`, '3'); await p.fill(`#${sid}-sal`, '2000'); await p.fill(`#${sid}-m`, '2');
  await p.click('#wizNext');
  await p.click('#wizNext');
  assert.equal(await visivel('#resultado'), true);
  assert.equal(await rolagemLateral(p), 0);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('fora do claude.ai: PDF e Excel baixam por link comum', async () => {
  // As bibliotecas vêm do cdnjs na página publicada; aqui são servidas das cópias locais
  const locais = {
    'jspdf.umd.min.js': require.resolve('jspdf/dist/jspdf.umd.min.js'),
    'jspdf.plugin.autotable.min.js': path.join(path.dirname(require.resolve('jspdf-autotable')), 'jspdf.plugin.autotable.min.js'),
    'xlsx.full.min.js': require.resolve('xlsx/dist/xlsx.full.min.js')
  };
  const ctx = await navegador.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', (route) => {
    const arq = locais[route.request().url().split('/').pop()];
    return arq ? route.fulfill({ path: arq, contentType: 'application/javascript' }) : route.abort();
  });
  const { p, erros } = await abrir('computador', { contexto: ctx });
  await preencher(p);
  for (const [botao, extensao] of [['#pdfBtn', '.pdf'], ['.topbar [data-act="excel"]', '.xlsx']]) {
    const [arquivo] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click(botao)]);
    assert.ok(arquivo.suggestedFilename().endsWith(extensao), arquivo.suggestedFilename());
    assert.ok(fs.statSync(await arquivo.path()).size > 5000, `${extensao} vazio`);
  }
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('compartilhar: o link leva a mesma simulação para outra pessoa', async () => {
  const { p, ctx } = await abrir('computador');
  await preencher(p);
  await abreMais(p);
  await p.click('[data-act="compartilhar"]');
  await p.waitForSelector('#codigoSim');
  const link = await p.$eval('#codigoSim', (e) => e.value);
  assert.match(link, /#s=z/);
  const outro = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await outro.newPage();
  await q.addInitScript(() => { localStorage.setItem('escala5x2:modo', 'completo'); localStorage.setItem('escala5x2:aviso', '1'); });
  await q.goto(link);
  await q.waitForFunction(() => state.setores[0].nome === 'Loja');
  assert.equal(await q.evaluate(() => state.loja.fim), '20:00');
  assert.equal(await q.evaluate(() => location.hash), '');
  // Pelo campo "Recebeu um código?"
  const r = await outro.newPage();
  await r.addInitScript(() => { localStorage.setItem('escala5x2:modo', 'completo'); localStorage.setItem('escala5x2:aviso', '1'); });
  await r.goto('file://' + pagina);
  await r.click(".recebido summary");
  await r.fill('#codigoAbrir', link.split('#s=')[1]);
  await r.click('[data-act="abrirCodigo"]');
  await r.waitForFunction(() => state.setores[0].nome === 'Loja');
  await outro.close(); await ctx.close();
});

test('primeira visita: aviso com não oficial, dados locais e contato; não volta depois', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto('file://' + pagina);
  assert.equal(await p.$eval('#boasVindas', (d) => d.open), true);
  const txt = await p.$eval('#boasVindas', (d) => d.textContent);
  for (const t of ['não oficial', 'Nada é enviado para servidores', 'cerionegiovanne@gmail.com']) assert.ok(txt.includes(t), t);
  await p.click('#boasVindas button');
  assert.equal(await p.$eval('#boasVindas', (d) => d.open), false);
  await p.reload();
  assert.equal(await p.$eval('#boasVindas', (d) => d.open), false);
  await ctx.close();
});

test('só a escala: sem salário, sem valores em reais no resultado', async () => {
  const { p, ctx, erros } = await abrir('computador');
  await p.click('#modoCalc [data-act="soEscala"][data-v="sim"]');
  for (const i of [0, 1, 2, 3, 4, 5, 6]) await p.click(`#loja [data-act="dia"][data-i="${i}"]`);
  await p.fill('#loja-ini', '08:00'); await p.fill('#loja-fim', '20:00');
  const sid = await p.$eval('.setor input[data-p="nome"]', (e) => e.dataset.s);
  assert.equal(await p.isVisible(`#${sid}-sal`), false, 'campo de salário escondido');
  await p.fill(`#${sid}-n`, 'Loja'); await p.fill(`#${sid}-q`, '4'); await p.fill(`#${sid}-m`, '2');
  await p.waitForTimeout(150);
  const txt = await p.$eval('#results', (e) => e.innerText);
  assert.ok(!txt.includes('R$'), 'resultado sem valores em reais');
  assert.match(txt, /Pessoas necessárias/);
  assert.equal(await p.isVisible('section[aria-labelledby="h3c"]'), false, 'etapa de custos escondida');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('detalhe do setor: resumo por turno e a conta completa num clique', async () => {
  const { p, ctx, erros } = await abrir('celular');
  const sid = await preencher(p, { fim: '22:00', func: '3', minimo: '3' });
  await p.click(`[data-act="det"][data-k="s${sid}"]`);
  const det = '#results .det-setor';
  assert.equal(await p.$$eval(`${det} table.conta tbody tr`, (t) => t.length), 2, 'uma linha por turno');
  assert.match(await p.$eval(`${det} .total-det`, (e) => e.innerText), /Precisa de \d+ · tem 3 · faltam \d+/);
  const conta = `${det} details.saiba:has(> summary:text("Ver a conta passo a passo"))`;
  assert.equal(await p.isVisible(`${conta} ol`), false, 'a conta por extenso começa fechada');
  await p.click(`${conta} > summary`);
  assert.match(await p.$eval(`${conta} ol`, (e) => e.innerText), /dias de trabalho a cobrir por semana.*÷/s);
  assert.equal(await rolagemLateral(p), 0);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('escala: dia fechado aparece como folga; semanas iguais não viram abas', async () => {
  const { p, ctx, erros } = await abrir('computador', { modo: 'rapido' });
  await p.click('[data-act="rqDias"][data-k="segsex"]');
  await p.click('[data-act="rqHora"][data-k="h0818"]');
  await p.fill('#rq-func', '3');
  await p.waitForSelector('#turnos table.sched');
  const linhas = await p.$$eval('#turnos table.sched tbody tr:not(.grp)', (trs) => trs.map((tr) =>
    [tr.querySelectorAll('td.t').length, tr.querySelectorAll('td.fx').length, tr.querySelectorAll('td.x').length]));
  assert.ok(linhas.length > 0);
  for (const l of linhas) assert.deepEqual(l, [5, 2, 0], 'seg a sex trabalhando, sáb e dom de folga (fechado)');
  assert.match(await p.$eval('#turnos table.sched td.fx', (e) => e.innerText), /Folga\s*fechado/);
  assert.match(await p.$eval('#turnos .weeks', (e) => e.innerText), /se repete toda semana/);
  assert.equal(await p.$('#turnos [data-act="week"]'), null, 'sem abas de semanas iguais');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('modo rápido: dias, horário e funcionários prontos dão o resultado', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.addInitScript(() => localStorage.setItem('escala5x2:aviso', '1'));
  await p.goto('file://' + pagina);
  assert.equal(await p.evaluate(() => document.body.classList.contains('rapido')), true, 'modo rápido é o padrão');
  await p.click('[data-act="rqDias"][data-k="segdom"]');
  await p.click('[data-act="rqHora"][data-k="h0822"]');
  await p.fill('#rq-func', '8');
  await p.fill('#rq-custo', '2600');
  const sal = await p.evaluate(() => state.setores[0].salario);
  assert.ok(sal > 1800 && sal < 2200, `custo de R$ 2.600 vira salário perto de R$ 2.000 no Simples (veio ${sal})`);
  await p.waitForSelector('#results .tile');
  const s = await p.evaluate(() => ({ nome: state.setores[0].nome, minimo: state.setores[0].minimo, dias: state.loja.dias.filter(Boolean).length, ini: state.loja.ini }));
  assert.deepEqual([s.nome, s.dias, s.ini], ['Equipe', 7, '08:00']);
  assert.ok(s.minimo >= 1, 'pessoas ao mesmo tempo deduzidas da equipe');
  assert.match(await p.$eval('#rqInfer', (e) => e.textContent), /Estimamos pela sua equipe/);
  assert.equal(await p.$eval('#rq-min', (e) => e.value), String(s.minimo));
  assert.match(await p.$eval('#results', (e) => e.innerText), /Contratações/);
  assert.equal(await p.isVisible('#loja'), false, 'dias e horário detalhados ficam recolhidos');
  assert.equal(await rolagemLateral(p), 0);
  // Corrigir "ao mesmo tempo" na própria caixa fixa o número; "Usar a estimativa" volta ao cálculo
  await p.fill('#rq-min', '3');
  await p.fill('#rq-func', '9');
  assert.equal(await p.evaluate(() => state.setores[0].minimo), 3, 'número informado à mão não é sobrescrito');
  await p.click('[data-act="rqEstimar"]');
  assert.notEqual(await p.evaluate(() => state.setores[0].minimoManual), true);
  // Outro horário e outros dias são editados na própria caixa
  await p.click('[data-act="rqOutro"][data-k="hora"]');
  await p.fill('#rq-ini', '07:00'); await p.fill('#rq-fim', '19:00');
  await p.click('[data-act="rqOutro"][data-k="dias"]');
  await p.click('[data-act="rqDia"][data-i="6"]');
  assert.deepEqual(await p.evaluate(() => [state.loja.ini, state.loja.fim, state.loja.dias[6]]), ['07:00', '19:00', false]);
  // Rápido ⇄ Detalhado mantém os dados
  await p.click('#modoDet');
  assert.equal(await p.evaluate(() => document.body.classList.contains('rapido')), false);
  assert.equal(await p.isVisible(`#${await p.evaluate(() => state.setores[0].id)}-q`), true, 'setores visíveis no detalhado');
  await p.click('#modoRapido');
  assert.equal(await p.$eval('#rq-func', (e) => e.value), '9');
  assert.deepEqual(erros, []);
  await ctx.close();
});

