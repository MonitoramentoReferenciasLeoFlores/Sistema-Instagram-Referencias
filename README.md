# Mesa de Luz — Referências do Instagram

Esqueleto de um sistema para acompanhar perfis específicos do Instagram, revisar
os posts novos em um feed simples ("Guardar" / "Descartar") e manter um banco
de referências pesquisável com o que for salvo.

## Como está organizado

```
instagram-referencias/
├── src/
│   ├── server.js      # sobe o Express, serve o front e agenda a coleta automatica
│   ├── routes.js      # rotas da API (feed, salvar/descartar, referencias, perfis)
│   ├── db.js           # conexao SQLite + aplica o schema
│   ├── schema.sql       # estrutura das tabelas (profiles, posts)
│   ├── brightdata.js    # integracao com o Bright Data (com modo demo sem credenciais)
│   └── fetchJob.js      # job que busca posts novos dos perfis ativos
├── public/
│   ├── index.html       # interface (triagem / arquivo / perfis)
│   ├── style.css
│   └── app.js
├── data/                 # onde o banco SQLite (.db) e criado
├── .env.example
└── package.json
```

## Por que essa arquitetura

A API oficial do Instagram (Graph API) só dá acesso a contas Business/Creator
que você mesmo administra — não existe endpoint oficial para puxar posts de
perfis de terceiros. Por isso, a coleta automática depende de um provedor
como o **Bright Data**, e o restante do sistema (banco, feed de triagem,
arquivo de referências) roda de forma independente disso.

Enquanto você não configura uma chave do Bright Data, o projeto roda em
**modo demo**: `src/brightdata.js` gera posts fake para os perfis cadastrados,
então dá pra testar o feed, a triagem e o arquivo de referências sem
depender de nenhuma credencial.

## Como rodar

```bash
cd instagram-referencias
npm install
cp .env.example .env
npm start
```

Abra `http://localhost:3000`. Na aba **Perfis**, cadastre os perfis que
quer acompanhar (ex.: `@perfil_exemplo`). Como está em modo demo, alguns
posts fake vão aparecer na aba **Triagem** em poucos segundos.

## Como conectar o Bright Data de verdade

1. No painel do Bright Data, gere uma **API Key** e configure/confirme o
   **dataset de Instagram** que você vai usar para extrair posts públicos.
2. Preencha `BRIGHTDATA_API_KEY` e `BRIGHTDATA_DATASET_ID` no `.env`.
3. Abra `src/brightdata.js` — a função `fetchLatestPosts()` tem um TODO
   detalhado com o esqueleto da chamada real (trigger da coleta, polling do
   status, leitura do resultado). **Essa é a próxima etapa a implementar
   com o Claude Code**, já que o formato exato da resposta varia conforme
   o dataset configurado na sua conta.

> Nota: o conector Bright Data que você usa aqui dentro do Claude (via MCP)
> é diferente disso — aqui o projeto roda sozinho, fora do chat, então
> precisa de uma API Key própria da sua conta Bright Data.

## Próximos passos sugeridos (para continuar com o Claude Code)

- [ ] Implementar a chamada real ao Bright Data em `src/brightdata.js`
- [ ] Testar a coleta com 2-3 perfis reais e ajustar o parsing dos campos
      (`image_url`, `caption`, `posted_at`) conforme o formato retornado
- [ ] Decidir se o projeto vai rodar só localmente ou hospedado (ex.: numa
      VPS ou serviço tipo Railway/Render), o que muda como o `.env` e o
      arquivo `data/referencias.db` são gerenciados
- [ ] Se for hospedar com acesso de qualquer lugar, adicionar autenticação
      simples (o esqueleto atual não tem login — é pensado para uso local/pessoal)
- [ ] Ajustar `FETCH_INTERVAL_MINUTES` conforme os limites de uso/custo do
      seu plano no Bright Data

## Segurança

- Nunca commite o arquivo `.env` com a chave real (já está no `.gitignore`)
- O arquivo `data/referencias.db` contém seu banco de referências — inclua
  no seu backup se for algo valioso para o trabalho
