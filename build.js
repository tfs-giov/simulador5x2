// Gera a versão para hospedar fora do claude.ai (GitHub Pages): docs/index.html completo + CNAME, robots.txt e sitemap.xml.
// Uso: node build.js                      → https://tfs-giov.github.io/simulador5x2/
//      node build.js seu-dominio.com.br   → domínio próprio (gera também o arquivo CNAME)
const fs = require('fs');
const dominio = (process.argv[2] || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const url = dominio ? `https://${dominio}/` : 'https://tfs-giov.github.io/simulador5x2/';
const SAIDA = __dirname + '/docs';
const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
// Separa o que vai no <head> (title, metas, links, JSON-LD e estilos) do corpo
const fimHead = src.indexOf('</style>') + '</style>'.length;
let head = src.slice(0, fimHead), corpo = src.slice(fimHead);
head = head
  .replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
  .replace('<meta property="og:type"', `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:type"`)
  .replace('"isAccessibleForFree": true}', `"isAccessibleForFree": true, "url": "${url}"}`)
  .replace('<title>Simulador 6x1 para 5x2</title>', '<title>Simulador Escala 6x1 para 5x2: custo e contratações</title>');
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230f6b63'/%3E%3Ctext x='16' y='21' font-size='13' font-family='sans-serif' font-weight='700' fill='white' text-anchor='middle'%3E5x2%3C/text%3E%3C/svg%3E">
${head}
</head>
<body>
${corpo}
</body>
</html>
`;
const hoje = new Date().toISOString().slice(0, 10);
fs.mkdirSync(SAIDA, { recursive: true });
fs.writeFileSync(SAIDA + '/index.html', html);
if (dominio) fs.writeFileSync(SAIDA + '/CNAME', dominio + '\n'); else fs.rmSync(SAIDA + '/CNAME', { force: true });
fs.writeFileSync(SAIDA + '/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${url}sitemap.xml\n`);
fs.writeFileSync(SAIDA + '/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url}</loc><lastmod>${hoje}</lastmod></url>\n</urlset>\n`);
fs.writeFileSync(SAIDA + '/.nojekyll', '');
console.log(`docs/ pronto para ${url}`);
