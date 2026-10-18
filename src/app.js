const express = require('express');

const app = express();

// Structured JSON access log: lands in CloudWatch Logs and can be queried with Logs Insights.
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(JSON.stringify({
      level: 'info',
      msg: 'request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    }));
  });
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(JSON.stringify({ level: 'error', msg: err.message, stack: err.stack }));
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
