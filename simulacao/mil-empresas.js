// Simula 1.000 empresas brasileiras típicas que hoje operam em 6x1 e mede o impacto da passagem para 5x2/40h.
// Usa o mesmo cálculo do site (index.html). Rodar: node simulacao/mil-empresas.js
const { carregarApp } = require('../tests/app.js');
const fs = require('fs');

let seed = 20261019;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const de = (l) => l[Math.floor(rnd() * l.length)];
const T = true, F = false;

// Perfis (peso ≈ participação entre empresas em 6x1); setores: [nome, pessoas ao mesmo tempo min-max, salário min-max]
const PERFIS = [
  { nome: 'Padaria', peso: 12, dias: [T,T,T,T,T,T,T], hor: [['06:00','20:00'],['06:00','21:00']], setores: [['Balcão',1,3,1700,2100],['Produção',1,2,1900,2600]] },
  { nome: 'Mercadinho', peso: 14, dias: [T,T,T,T,T,T,T], hor: [['07:00','21:00'],['08:00','20:00']], setores: [['Caixa',1,4,1650,1900],['Reposição',1,3,1700,2000]] },
  { nome: 'Restaurante', peso: 12, dias: [T,T,T,T,T,T,T], hor: [['11:00','23:00'],['11:00','15:00']], setores: [['Salão',2,5,1700,2100],['Cozinha',1,4,1900,2700]] },
  { nome: 'Loja de shopping', peso: 12, dias: [T,T,T,T,T,T,T], hor: [['10:00','22:00']], setores: [['Vendas',1,4,1700,2400]] },
  { nome: 'Loja de rua', peso: 12, dias: [T,T,T,T,T,T,F], hor: [['08:00','18:00'],['09:00','19:00']], setores: [['Vendas',1,4,1650,2200]] },
  { nome: 'Farmácia', peso: 8, dias: [T,T,T,T,T,T,T], hor: [['07:00','22:00']], setores: [['Balcão',1,3,1700,2200],['Farmacêutico',1,1,4200,5500]] },
  { nome: 'Salão de beleza', peso: 7, dias: [F,T,T,T,T,T,F], hor: [['09:00','19:00']], setores: [['Atendimento',1,4,1650,2300]] },
  { nome: 'Oficina / pequena indústria', peso: 9, dias: [T,T,T,T,T,T,F], hor: [['07:00','17:00']], setores: [['Produção',2,10,1900,2800]] },
  { nome: 'Posto de combustível', peso: 6, dias: [T,T,T,T,T,T,T], hor: [['00:00','00:00'],['06:00','22:00']], setores: [['Pista',1,3,1800,2300]] },
  { nome: 'Hotel / portaria 24h', peso: 4, dias: [T,T,T,T,T,T,T], hor: [['00:00','00:00']], setores: [['Recepção',1,2,1800,2400],['Portaria',1,1,1700,2000]] },
  { nome: 'Supermercado médio', peso: 4, dias: [T,T,T,T,T,T,T], hor: [['07:00','22:00']], setores: [['Caixa',4,10,1700,1950],['Reposição',2,6,1750,2050],['Açougue/padaria',2,4,2000,2600]] },
];
const somaPeso = PERFIS.reduce((a, p) => a + p.peso, 0);
const sorteiaPerfil = () => { let x = rnd() * somaPeso; for (const p of PERFIS) { if ((x -= p.peso) < 0) return p; } return PERFIS[0]; };

const N = 1000, linhas = [];
for (let i = 0; i < N; i++) {
  const perfil = sorteiaPerfil();
  const app = carregarApp();
  const st = app.state;
  const [ini, fim] = de(perfil.hor);
  st.loja = { ...app.horarioVazio(), dias: perfil.dias.slice(), ini, fim };
  st.setores = perfil.setores.map(([nome, a, b, s1, s2]) => Object.assign(app.novoSetor(), {
    nome, minimo: int(a, b), salario: Math.round(int(s1, s2) / 50) * 50,
    jornada: perfil.nome.startsWith('Hotel') && nome === 'Portaria' ? '12x36' : '8', func: 0
  }));
  Object.assign(st.config, {
    regime: rnd() < 0.8 ? 'simples' : 'presumido', ferias: true,
    feriadoModo: perfil.dias[6] ? de(['dobro', 'dobro', 'folga', 'fecha']) : 'fecha',
    ben: { ...st.config.ben, vtDia: rnd() < 0.7 ? de([10, 12, 14, 18]) : '' }
  });
  st.config.encargos = st.config.regime === 'simples' ? 29.44 : 67.2; // aproximação; o site recalcula pelo regime
  // Equipe de hoje: o que a 6x1 de 44h exige (estimativa do próprio site) mais uma folga eventual de 0 ou 1 pessoa
  let c = app.compute();
  // mesma conta do site, mas em 6x1 de 44h (6 dias por pessoa), com férias: é a equipe que a empresa já precisa hoje
  st.setores.forEach((s) => { const r6 = app.analisar(s, 44, 6); s.func = (r6.need || 0) + (rnd() < 0.25 ? 1 : 0); });
  c = app.compute();
  const ok = c.res.filter((r) => !r.vazio && !r.erros.length);
  const equipe = ok.reduce((a, r) => a + r.cur, 0);
  // Faturamento estimado: a folha é de 15% a 35% do faturamento (varia por ramo)
  const fatMes = c.folha / (0.15 + rnd() * 0.2);
  const diasMes = (perfil.dias.filter(Boolean).length * 52) / 12;
  const fatDia = fatMes / diasMes;
  let decisao = 'sem impacto';
  let alt = null;
  if (c.hires) {
    decisao = 'contrata';
    const a = app.__alt ? null : null;
    const al = (globalThis.__alts = null, null);
    const alts = app.compute && carregaAlternativas(app, c);
    // Fecha ou reduz horário se o corte evita pelo menos 1 contratação e o período cortado fatura menos que o limite
    const viaveis = alts.filter((x) => x.viavel && fatPeriodo(x, fatDia) < x.viavel.fat);
    if (viaveis.length) {
      alt = viaveis.sort((x, y) => y.economia - x.economia)[0];
      decisao = /^Fechar/.test(alt.titulo) ? 'fecha dia(s)' : 'reduz horário';
    }
  }
  linhas.push({ perfil: perfil.nome, equipe, hires: c.hires, extra: c.extra, folha: c.folha, decisao, alt: alt && alt.titulo, economiaAlt: alt ? alt.economia : 0, hiresAposAlt: alt ? alt.c2.hires : c.hires });
}

function carregaAlternativas(app, c) {
  // alternativas() é interna do site; acessível pelo mesmo contexto via renderização das opções
  return app.alternativas ? app.alternativas(c).uteis : [];
}
// Faturamento do período cortado: dia inteiro (fechar dia/dias) ou fração do dia (horário)
function fatPeriodo(x, fatDia) {
  if (/^Fechar (dois|um) dias? por semana|^Fechar \w+ e \w+/.test(x.titulo)) return fatDia * (/dois| e /.test(x.titulo) ? 2 : 1) * 0.8;
  if (/^Fechar/.test(x.titulo) && !/hora/.test(x.titulo)) return fatDia * 0.8; // dia de movimento menor
  if (/só um turno/.test(x.titulo)) return fatDia * 0.35;
  return fatDia * 0.07; // 1 hora a menos
}

const pct = (n) => (100 * n / N).toFixed(1) + '%';
const brl = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const por = (k) => linhas.filter((l) => l.decisao === k);
const contr = linhas.filter((l) => l.hires > 0);
const totFolha = linhas.reduce((a, l) => a + l.folha, 0), totExtra = linhas.reduce((a, l) => a + l.extra, 0);
const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const out = [];
out.push(`1.000 empresas simuladas · equipe total hoje: ${linhas.reduce((a, l) => a + l.equipe, 0)} pessoas`);
out.push(`Sem precisar contratar: ${linhas.filter((l) => !l.hires).length} (${pct(linhas.filter((l) => !l.hires).length)})`);
out.push(`Precisariam contratar (antes de alternativas): ${contr.length} (${pct(contr.length)}) · ${contr.reduce((a, l) => a + l.hires, 0)} vagas · mediana ${med(contr.map((l) => l.hires))} por empresa`);
out.push(`Decisão provável: contrata ${por('contrata').length} · fecha dia(s) ${por('fecha dia(s)').length} · reduz horário ${por('reduz horário').length} · sem impacto ${por('sem impacto').length}`);
out.push(`Custo extra mensal (se todas contratarem): total ${brl(totExtra)} · mediana por empresa que contrata ${brl(med(contr.map((l) => l.extra)))} · aumento médio da folha ${(100 * totExtra / totFolha).toFixed(1)}%`);
out.push('\nPor perfil:');
for (const p of PERFIS) {
  const g = linhas.filter((l) => l.perfil === p.nome); if (!g.length) continue;
  const f = g.reduce((a, l) => a + l.folha, 0), e = g.reduce((a, l) => a + l.extra, 0);
  out.push(`${p.nome.padEnd(28)} n=${String(g.length).padStart(3)} · contratam ${pct2(g.filter((l) => l.hires).length, g.length)} · fecham dia ${pct2(g.filter((l) => l.decisao === 'fecha dia(s)').length, g.length)} · reduzem horário ${pct2(g.filter((l) => l.decisao === 'reduz horário').length, g.length)} · folha +${(100 * e / f).toFixed(0)}% · vagas/empresa ${(g.reduce((a, l) => a + l.hires, 0) / g.length).toFixed(1)}`);
}
function pct2(a, b) { return (100 * a / b).toFixed(0).padStart(3) + '%'; }
console.log(out.join('\n'));
fs.writeFileSync(__dirname + '/resultado.json', JSON.stringify(linhas, null, 1));
