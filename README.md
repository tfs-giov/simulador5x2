# Simulador Escala 6x1 → 5x2

**Quantas pessoas sua empresa precisa contratar com o fim da escala 6x1, e quanto isso custa?**

Simulador gratuito para pequenas e médias empresas planejarem a passagem da escala 6x1 (44 horas por semana) para a 5x2 (40 horas), prevista na Emenda Constitucional 141/2026.

🔗 **Use o simulador:** https://tfs-giov.github.io/simulador5x2/

> ⚠️ **Não oficial.** Este site não tem vínculo com o governo. É uma estimativa para ajudar no planejamento: confirme com seu contador ou advogado trabalhista antes de decidir.

---

## O que ele responde

Você informa os dias e o horário de funcionamento e os setores da empresa. O simulador monta turnos e folgas e diz:

- **Se falta gente:** quantas pessoas cada setor precisa para cobrir o horário com 2 folgas por semana.
- **Quanto custa:** contratações, encargos, benefícios, adicional noturno e feriados, com o custo extra por mês e o aumento da folha.
- **Até quando contratar:** a linha do tempo da transição (42h a partir de 15/12/2026 e 40h em dezembro de 2027).
- **Como evitar contratações:** mudar o horário, fechar um dia, hora extra, intermitente ou meio período, com o faturamento a partir do qual cada opção compensa.
- **Como fica a escala:** um exemplo de escala de turnos e folgas por pessoa, que pode ser salvo em Excel.

## Como usar

No topo há dois modos, **Rápido** e **Detalhado**. Os dados são os mesmos nos dois, então dá para começar no rápido e refinar no detalhado.

**Rápido** (padrão): três perguntas e o resultado na hora.
1. **Dias:** Seg a Sex, Seg a Sáb, Todos os dias, Ter a Sáb ou outros.
2. **Horário:** 08h às 18h, 08h às 22h, 24 horas ou outro.
3. **Equipe:** funcionários de hoje, quantos trabalham ao mesmo tempo (estimado a partir da equipe; dá para corrigir) e, se quiser o custo, o custo médio por funcionário (salário + encargos + benefícios).

**Detalhado:** vários setores, turnos, pessoas por dia, feriados, encargos e benefícios, numa página só ou uma etapa por vez.

### O que calcular

| Opção | O que pede | O que mostra |
|---|---|---|
| **Escala e custos** (padrão) | Funcionários e salários (o modelo já sugere) | Contratações, custo por mês, alternativas, linha do tempo |
| **Só a escala** | Só funcionários e quantos trabalham ao mesmo tempo | Pessoas necessárias, quantas faltam e o exemplo de escala, sem valores em reais (também no PDF e no Excel) |

## Privacidade

- **Nada é enviado para servidores.** O cálculo roda no seu navegador, e os dados ficam guardados só nele até você clicar em "Apagar dados".
- **Sem cadastro, sem nome, CNPJ ou e-mail.**
- **Compartilhar com o contador:** o botão "Copiar link da simulação" gera um link com os dados compactados dentro dele. Quem abre vê a mesma simulação; nada passa por servidor.

## Outras funções

- **Passo a passo** para quem prefere preencher uma etapa por vez, ou **página completa**.
- **Exportação** em PDF (resumo para o contador) e Excel (escala completa e comparação de cenários).
- **Comparar cenários:** guarde até 3 versões (por exemplo, "abre domingo" × "fecha domingo") e veja lado a lado.
- **Jornadas** de 8h, tempo parcial (6h e 4h) e 12x36, por setor.
- **Dias de alta demanda:** a escala dá o menor número de folgas nos dias mais movimentados.
- **Acessibilidade:** tamanho do texto, alto contraste, navegação por teclado e leitor de tela (verificado com axe-core).

## Regras usadas

Emenda Constitucional 141/2026 e CLT (arts. 58-A, 59, 59-A, 66, 67, 71, 73, 130, 452-A), Lei 605/1949 (feriados), Lei 5.889/1973 (trabalho rural), Lei 10.101/2000 (comércio aos domingos e feriados), Súmulas 60 e 146 do TST, INSS 2026 e IRRF (Lei 15.270/2025). As regras foram conferidas em 19/10/2026. A lista completa e o que fica fora da conta estão no rodapé do site, em "Regras usadas no cálculo".

## Contato

Dúvidas ou questões legais: **cerionegiovanne@gmail.com**

---

## Para desenvolvedores

O site é um único arquivo, sem framework nem servidor. As bibliotecas de PDF e Excel (jsPDF e SheetJS) são carregadas do cdnjs só quando você clica para salvar.

```
index.html            código-fonte do simulador (HTML, CSS e JavaScript)
build.js              gera a versão publicada em docs/
docs/                 o que o GitHub Pages serve (index.html completo, robots.txt, sitemap.xml)
tests/                testes de cálculo e de tela
simulacao/            simulação de impacto com 1.000 empresas típicas
```

### Publicar

```
node build.js                       # https://tfs-giov.github.io/simulador5x2/
node build.js seu-dominio.com.br    # domínio próprio (gera também o CNAME)
```

Envie `docs/` para a branch `main`. O GitHub Pages está configurado para servir a pasta `/docs`.

### Testar

```
npm install
npm test
```

São 24 testes, que devem passar antes de qualquer publicação:

- **Cálculo** (`tests/calculo.test.js`): casos com valores conferidos, todos os modelos prontos, dados salvos corrompidos, aviso de domingo no comércio e 400 simulações aleatórias. Cada simulação verifica cobertura mínima, dias e horas por pessoa, 12x36, ausência de NaN, PDF e Excel.
- **Tela** (`tests/tela.test.js`): fluxo no Chromium (celular e computador), modo rápido com modelo pronto, modo "Só a escala", cenários, compartilhamento, passo a passo, teclado, acessibilidade (axe-core) e download de PDF e Excel.

Se o Chromium não for encontrado, informe o caminho em `CHROMIUM_PATH`.

### Simulação de impacto

```
node simulacao/mil-empresas.js
```

Gera 1.000 empresas típicas a partir dos mesmos modelos prontos do site e mede quantas precisariam contratar, quanto pagariam e quantas fechariam um dia. É uma ordem de grandeza, não uma pesquisa: as proporções não vêm de dados oficiais.

## Licença

Veja [LICENSE](LICENSE).
