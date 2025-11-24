const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PROCESSOR_URL = process.env.PROCESSOR_URL || 'http://alert-processor:4000/process-alert';

app.post('/alerts', async (req, res) => {
  const alert = req.body;

  if (!alert || !alert.sourceType || !alert.timestamp) {
    return res.status(400).json({ error: 'Invalid alert payload. Required: sourceType, timestamp.' });
  }

  try {
    const response = await axios.post(PROCESSOR_URL, alert);
    return res.status(201).json({ message: 'Alert forwarded to processor', data: response.data });
  } catch (err) {
    console.error('Error forwarding alert to processor:', err.message);
    return res.status(500).json({ error: 'Failed to forward alert to processor' });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'api-ingestor' });
});

app.listen(PORT, () => {
  console.log(`API Ingestor listening on port ${PORT}`);
});
