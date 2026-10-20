// Testes do cálculo: casos conhecidos, regras que valem para qualquer simulação e simulações aleatórias.
// Rodar: npm test (ou npm run test:calculo)
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregarApp } = require('./app');

const SEM = [0, 1, 2, 3, 4, 5, 6];
const todos = () => SEM.map(() => true);

// Monta um app com uma loja e um setor, já com as premissas explícitas
function cenario({ ini = '08:00', fim = '20:00', dias = todos(), setor = {}, config = {} } = {}) {
  const app = carregarApp();
  const st = app.state;
  st.loja = { ...app.horarioVazio(), dias, ini, fim };
  Object.assign(st.setores[0], { nome: 'A', func: 4, salario: 2000, minimo: 2, jornada: '8' }, setor);
  Object.assign(st.config, { ferias: false, feriadoModo: 'fecha' }, config);
  return app;
}
const setor0 = (app) => app.compute().res[0];

test('casos conhecidos: pessoas necessárias por jornada', () => {
  assert.equal(setor0(cenario()).need, 6, '8h, 08–20, 2 por turno');
  assert.equal(setor0(cenario({ setor: { jornada: '6' } })).need, 6, '6h por dia');
  assert.equal(setor0(cenario({ setor: { jornada: '4' } })).need, 9, '4h por dia, 3 turnos');
  assert.equal(setor0(cenario({ setor: { jornada: '12x36' } })).need, 4, '12x36 de 08 às 20');
  assert.equal(setor0(cenario({ ini: '07:00', fim: '07:00', setor: { jornada: '12x36' } })).need, 8, '12x36 24h');
  assert.equal(setor0(cenario({ ini: '07:00', fim: '07:00', setor: { jornada: '12x36' }, config: { ferias: true } })).need, 10, '12x36 24h com férias');
  assert.equal(setor0(cenario({ config: { ferias: true } })).need, 8, '8h com férias');
});

test('adicional noturno: valor conhecido e mínimo rural', () => {
  const app = cenario({ ini: '07:00', fim: '07:00', setor: { jornada: '12x36', minimo: 1 } });
  const r = setor0(app);
  assert.ok(Math.abs(r.noiteDepois - 932.6) < 1, `12x36 24h: esperado ~R$ 932,60, veio ${r.noiteDepois}`);
  assert.equal(setor0(cenario()).noiteMin, 0, 'sem trabalho noturno das 08 às 20');
  app.state.config.atividade = 'lavoura';
  app.state.config.noturno = 20;
  const rural = setor0(app);
  // Plantão noturno 19h–7h: lavoura conta 8h a 25% sem hora reduzida (2h equivalentes);
  // urbano conta 7h que viram 8h a 20% (8 × 1,2 − 7 = 2,6h). Rural ÷ urbano = 2 ÷ 2,6
  assert.ok(Math.abs(rural.noiteDepois / r.noiteDepois - 2 / 2.6) < 0.005, `proporção rural/urbano: ${rural.noiteDepois / r.noiteDepois}`);
  assert.equal(app.compute().res[0].noiteDepois, rural.noiteDepois, 'adicional abaixo de 25% no rural usa 25%');
});

test('feriados: dobro "no total" custa metade do "além do dia já pago"', () => {
  const app = cenario({ ini: '08:00', fim: '17:00', config: { feriadoModo: 'dobro' } });
  const alem = setor0(app).ferDepois;
  app.state.config.feriadoLeitura = 'total';
  const total = setor0(app).ferDepois;
  assert.ok(alem > 0);
  assert.ok(Math.abs(alem / total - 2) < 1e-9);
  app.state.config.feriadoModo = 'folga';
  assert.equal(setor0(app).ferDepois, 0, 'com folga extra não há custo de feriado');
});

test('dias de alta demanda: sem folgas na sexta e no sábado quando há folga em outros dias', () => {
  const app = cenario({ ini: '08:00', fim: '17:00', setor: { func: 8, minimo: 3 }, config: { alta: [false, false, false, false, true, true, false] } });
  const r = setor0(app);
  for (const g of r.grupos) for (const grid of g.sched.weeks) for (const row of grid) {
    assert.notEqual(row[4], 'F', 'folga na sexta');
    assert.notEqual(row[5], 'F', 'folga no sábado');
  }
});

test('linha do tempo: a fase de 40h é o resultado principal', () => {
  for (const acordo of [false, true]) {
    const app = cenario({ config: { acordo42: acordo } });
    const c = app.compute();
    const tl = app.transicao(c);
    assert.equal(tl.f2.hires, c.hires);
    assert.equal(tl.f2.extra, c.extra);
    if (!acordo) assert.equal(tl.f1, c, 'sem acordo, a fase de 42h funciona como 40h');
  }
});

test('dados salvos corrompidos ou antigos não quebram o site', () => {
  for (const lixo of [null, 'texto', 42, [], {}, { setores: 'x' }, { setores: [], config: {} }, { setores: [null, 3, {}], loja: 'x', config: { ben: 5 } }]) {
    const app = carregarApp(lixo);
    assert.ok(Array.isArray(app.state.setores) && app.state.setores.length >= 1);
    assert.equal(app.state.loja.dias.length, 7);
    app.compute();
    app.renderResults();
    assert.ok(!app.els.results.innerHTML.includes('Não foi possível calcular'), `falhou com ${JSON.stringify(lixo)}`);
  }
  // Versão antiga: sem jornada, sem minDia, com benefícios num campo só
  const antigo = { loja: { dias: [true, true, true, true, true, true, false], ini: '08:00', fim: '18:00' }, setores: [{ id: 's1', nome: 'Caixa', func: 3, salario: 1800, minimo: 2 }], config: { beneficios: 300, encargos: 30, regime: 'simples' } };
  const app = carregarApp(antigo);
  assert.equal(app.state.setores[0].jornada, '8');
  assert.equal(app.state.config.ben.outros[0].valor, 300);
  assert.ok(app.compute().res[0].need > 0);
});

// ---------- Simulações aleatórias ----------
function sorteador(semente) {
  let a = semente >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { r, de: (lista) => lista[Math.floor(r() * lista.length)], int: (a1, b1) => a1 + Math.floor(r() * (b1 - a1 + 1)), sim: (p) => r() < p };
}
const INIS = ['06:00', '07:00', '08:00', '09:00', '10:00', '14:00', '18:00', '22:00'];
const FINS = ['12:00', '14:00', '17:00', '18:00', '20:00', '22:00', '23:30', '02:00', '06:00'];

function horarioAleatorio(app, s) {
  const h = app.horarioVazio();
  h.dias = SEM.map(() => s.sim(0.8));
  if (!h.dias.some(Boolean)) h.dias[s.int(0, 6)] = true;
  h.ini = s.de(INIS);
  h.fim = s.sim(0.1) ? h.ini : s.de(FINS);
  if (s.sim(0.2)) { h.porDia = true; h.h = SEM.map(() => ({ ini: s.de(INIS), fim: s.de(FINS) })); }
  return h;
}
function estadoAleatorio(app, s) {
  const st = app.state;
  st.loja = horarioAleatorio(app, s);
  st.setores = Array.from({ length: s.int(1, 3) }, (_, i) => {
    const n = app.novoSetor();
    Object.assign(n, {
      nome: `S${i}`, func: s.int(0, 20), salario: s.sim(0.1) ? '' : s.int(1400, 9000), minimo: s.int(1, 4),
      jornada: s.de(['8', '8', '6', '4', '12x36'])
    });
    if (s.sim(0.2)) { n.horario = 'proprio'; n.proprio = horarioAleatorio(app, s); }
    if (s.sim(0.2)) { n.porDiaMin = true; n.minDia = SEM.map(() => (s.sim(0.2) ? '' : s.int(1, 5))); }
    if (s.sim(0.15)) { n.porTurnoMin = true; n.minTurno = Array.from({ length: 6 }, () => (s.sim(0.3) ? '' : s.int(1, 4))); }
    if (s.sim(0.1)) { n.turnosModo = 'manual'; n.turnosManual = Array.from({ length: s.int(1, 3) }, () => ({ ini: s.de(INIS), fim: s.de(FINS) })); }
    return n;
  });
  Object.assign(st.config, {
    ferias: s.sim(0.5), feriadoModo: s.de(['', 'fecha', 'folga', 'dobro']), feriadoLeitura: s.de(['alem', 'total']),
    atividade: s.de(['urbana', 'lavoura', 'pecuaria']), noturno: s.int(10, 60), feriados: s.int(0, 20), intervalo: s.int(30, 120),
    equilibrar: s.sim(0.5), seguidas: s.sim(0.7), alta: SEM.map(() => s.sim(0.15)), acordo42: s.sim(0.5),
    regime: s.de(['simples', 'anexo4', 'presumido']), encargos: s.int(25, 80)
  });
}

function verificaSetor(r, onde) {
  assert.ok(Number.isInteger(r.need) && r.need >= 0, `${onde}: need inválido ${r.need}`);
  assert.equal(r.hires, Math.max(0, r.need - r.cur), `${onde}: contratações`);
  for (const k of ['custo', 'noiteDepois', 'ferDepois', 'economiaVT']) if (r[k] != null) assert.ok(Number.isFinite(r[k]), `${onde}: ${k} = ${r[k]}`);
  for (const g of r.grupos) {
    const N = g.team.length;
    g.sched.weeks.forEach((grid, w) => {
      assert.equal(grid.length, N, `${onde}: linhas da escala`);
      for (const d of g.A) {
        const trabalham = grid.filter((row) => row[d] === 'T').length;
        assert.ok(trabalham >= g.R[d], `${onde} ${g.nome} semana ${w + 1} dia ${d}: ${trabalham} < ${g.R[d]}`);
      }
      if (!r.plantao) {
        grid.forEach((row, e) => {
          const dias = g.A.filter((d) => row[d] === 'T').length;
          assert.equal(dias, Math.min(g.k, g.A.length), `${onde} ${g.nome} pessoa ${e + 1}: ${dias} dias de trabalho`);
          const horas = g.A.reduce((a, d) => a + (row[d] === 'T' ? g.dias[d].h : 0), 0);
          assert.ok(horas <= r.Hs + 0.01, `${onde} ${g.nome} pessoa ${e + 1}: ${horas}h > ${r.Hs}h`);
        });
      }
    });
    if (!r.plantao && g.R[6] > 0) {
      // Domingo no comércio: aviso se alguém trabalha 3 domingos seguidos ou mais (o rodízio se repete)
      const excede = g.team.some((_, e) => {
        const off = g.sched.weeks.map((grid) => grid[e][6] !== 'T');
        if (!off.some(Boolean)) return true;
        let run = 0;
        return [...off, ...off].some((x) => { run = x ? 0 : run + 1; return run >= 3; });
      });
      const temAviso = r.avisos.some((a) => a.includes('3 domingos seguidos'));
      if (excede) assert.ok(temAviso, `${onde} ${g.nome}: faltou o aviso de domingo`);
    }
    if (r.plantao) {
      // 12x36: ninguém trabalha dois dias seguidos do calendário
      for (let e = 0; e < N; e++) {
        const seq = g.sched.weeks.flatMap((grid) => grid[e]);
        for (let i = 1; i < seq.length; i++) assert.ok(!(seq[i] === 'T' && seq[i - 1] === 'T'), `${onde}: 12x36 com dois dias seguidos`);
      }
    }
  }
}

test('400 simulações aleatórias: sem erros, sem NaN, cobertura e jornada respeitadas', () => {
  const app = carregarApp();
  const base = JSON.parse(JSON.stringify(app.state));
  let validos = 0;
  for (let i = 0; i < 400; i++) {
    const s = sorteador(1000 + i);
    app.state = JSON.parse(JSON.stringify(base));
    estadoAleatorio(app, s);
    const onde = `simulação ${i} (semente ${1000 + i})`;
    let c;
    try { c = app.compute(); } catch (err) { assert.fail(`${onde}: ${err.stack}`); }
    assert.ok(Number.isFinite(c.extra) && Number.isFinite(c.folha), `${onde}: totais inválidos`);
    const ok = c.res.filter((r) => !r.vazio && !r.erros.length);
    if (ok.length) validos++;
    ok.forEach((r) => verificaSetor(r, `${onde} setor ${r.s.nome}`));
    app.renderResults();
    assert.ok(!app.els.results.innerHTML.includes('Não foi possível calcular'), `${onde}: tela de erro`);
    assert.ok(!/NaN|undefined|Infinity/.test(app.els.results.innerHTML), `${onde}: NaN/undefined na tela`);
    if (i % 40 === 0 && ok.length) { app.montarPDF(c); app.montarExcel(c); }
  }
  assert.ok(validos > 200, `poucas simulações válidas (${validos}); o gerador precisa de ajuste`);
});

test('domingo no comércio: aviso quando alguém trabalha 3 domingos seguidos', () => {
  let comAviso = 0, semAviso = 0;
  for (const minimo of [1, 2, 3, 4, 5]) for (const func of [4, 6, 8, 10]) {
    const app = cenario({ ini: '08:00', fim: '17:00', setor: { func, minimo } });
    const r = setor0(app);
    const aviso = r.avisos.some((a) => a.includes('3 domingos seguidos'));
    const pior = Math.max(...r.grupos.flatMap((g) => g.team.map((_, e) => {
      const off = g.sched.weeks.map((grid) => grid[e][6] !== 'T');
      if (!off.some(Boolean)) return Infinity;
      let run = 0, max = 0;
      for (const x of [...off, ...off]) { run = x ? 0 : run + 1; max = Math.max(max, run); }
      return max;
    })));
    assert.equal(aviso, pior >= 3, `mínimo ${minimo}, ${func} funcionários: pior sequência ${pior}`);
    if (aviso) comAviso++; else semAviso++;
  }
  assert.ok(comAviso > 0 && semAviso > 0, `cenários pouco variados (com aviso ${comAviso}, sem ${semAviso})`);
});

test('salário de quem será contratado e combinações para a última vaga', () => {
  const app = cenario({ setor: { func: 2, salario: 3000 } });
  const r1 = setor0(app);
  app.state.setores[0].salNovo = 1800;
  const c = app.compute(); const r2 = c.res[0];
  assert.equal(r2.hires, r1.hires, 'o salário não muda o número de pessoas');
  assert.ok(r2.custo < r1.custo, 'contratar com salário de entrada custa menos');
  const ops = app.combinacoesSetor(r2, c, app.alternativasSetor(r2, c).he);
  assert.ok(ops.length >= 3);
  assert.equal(ops[0].custo, r2.custo, 'a primeira linha é só contratar');
  assert.equal(ops.filter((o) => o.melhor).length >= 1, true);
  for (const o of ops) assert.ok(Number.isFinite(o.custo));
});

test('só a escala: PDF e avisos sem valores em reais', () => {
  const app = cenario({ ini: '14:00', fim: '23:30', setor: { func: 2 }, config: { soEscala: true, feriadoModo: 'dobro' } });
  const c = app.compute();
  assert.ok(c.res[0].avisos.length > 0);
  for (const a of c.res[0].avisos) assert.ok(!a.includes('R$'), a);
  const doc = app.montarPDF(c);
  const texto = doc.output();
  assert.ok(!/R\$/.test(texto), 'PDF com valor em reais');
  assert.ok(/Contratar/.test(texto));
});
