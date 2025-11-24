const { Kafka } = require('kafkajs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const TOPIC = process.env.KAFKA_TOPIC || 'alert-events';

const kafka = new Kafka({
  clientId: 'logs-consumer',
  brokers: [KAFKA_BROKER]
});

async function startConsumer() {
  const consumer = kafka.consumer({ groupId: 'logs-consumer-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        // Structured log for Loki via Promtail (stdout)
        console.log(JSON.stringify({
          level: 'info',
          service: 'logs-consumer',
          eventType: payload.type,
          alertId: payload.alert && payload.alert.alertId,
          sourceType: payload.alert && payload.alert.sourceType,
          status: payload.alert && payload.alert.status,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('Error parsing Kafka message in logs-consumer:', err.message);
      }
    }
  });

  console.log('Logs consumer started and listening to Kafka');
}

startConsumer().catch(err => {
  console.error('Failed to start logs consumer:', err);
});
