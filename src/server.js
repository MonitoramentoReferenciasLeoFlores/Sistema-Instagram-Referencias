require('dotenv').config();
const path = require('path');
const express = require('express');
const cron = require('node-cron');

require('./db'); // garante que o schema foi aplicado antes de subir o servidor
const routes = require('./routes');
const { runFetchJob } = require('./fetchJob');
const { DEMO_MODE } = require('./brightdata');

const app = express();
const PORT = process.env.PORT || 3000;
const INTERVAL_MIN = Number(process.env.FETCH_INTERVAL_MINUTES || 60);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`\nServidor rodando em http://localhost:${PORT}`);
  console.log(DEMO_MODE ? 'Modo: DEMO (sem BRIGHTDATA_API_KEY, posts fake)' : 'Modo: PRODUCAO (Bright Data)');
  console.log(`Coleta automatica a cada ${INTERVAL_MIN} minuto(s).\n`);
});

// Agenda a coleta periodica. Ex.: a cada 60 min -> '*/60 * * * *' nao existe
// em cron padrao para minutos >59, entao usamos um intervalo em minutos.
const cronExpression = `*/${Math.min(INTERVAL_MIN, 59)} * * * *`;
cron.schedule(cronExpression, () => {
  console.log('[cron] Disparando coleta automatica...');
  runFetchJob().catch((err) => console.error('[cron] Erro na coleta:', err.message));
});

// Roda uma coleta inicial ao subir o servidor, para popular o feed logo de cara.
runFetchJob().catch((err) => console.error('[startup] Erro na coleta inicial:', err.message));
