const express = require('express');
const { Kafka } = require('kafkajs');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 9100;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const TOPIC = process.env.KAFKA_TOPIC || 'alert-events';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// UPDATED: Added "severity" label
const alertsTotal = new client.Counter({
  name: 'alerts_total',
  help: 'Total number of alerts processed',
  labelNames: ['status', 'sourceType', 'severity']
});

register.registerMetric(alertsTotal);

const kafka = new Kafka({
  clientId: 'metrics-consumer',
  brokers: [KAFKA_BROKER]
});

async function startConsumer() {
  const consumer = kafka.consumer({ groupId: 'metrics-consumer-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        const alert = payload.alert;

        if (alert) {
          alertsTotal.inc({
            status: alert.status || 'UNKNOWN',
            sourceType: alert.sourceType || 'UNKNOWN',
            severity: alert.severity || 'unknown'
          });
        }
      } catch (err) {
        console.error('Error parsing Kafka message in metrics-consumer:', err.message);
      }
    }
  });

  console.log('Metrics consumer started and listening to Kafka');
}

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'metrics-consumer' });
});

app.listen(PORT, () => {
  console.log(`Metrics consumer listening on port ${PORT}`);
});

startConsumer().catch(err => {
  console.error('Failed to start metrics consumer:', err);
});
