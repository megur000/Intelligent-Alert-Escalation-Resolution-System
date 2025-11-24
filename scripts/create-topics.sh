#!/usr/bin/env bash
set -e

KAFKA_BROKER=${KAFKA_BROKER:-localhost:9092}
TOPIC=${TOPIC:-alert-events}

echo "Creating topic $TOPIC on $KAFKA_BROKER"
kafka-topics.sh --create --if-not-exists --topic "$TOPIC" --bootstrap-server "$KAFKA_BROKER" --replication-factor 1 --partitions 3
