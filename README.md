# Alert Platform 🚨

An **Intelligent Alert Escalation & Auto-Resolution System** built with Node.js, Kafka, MySQL, Prometheus, Loki, and Grafana. This platform processes, manages, escalates, and auto-closes alerts based on configurable rules and time windows.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Services Overview](#services-overview)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Alert Rules](#alert-rules)
- [Database Schema](#database-schema)
- [Monitoring & Observability](#monitoring--observability)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### Core Functionality
- **Real-time Alert Ingestion**: Accept alerts via HTTP API
- **Rule-Based Alert Processing**: Automatic escalation based on configurable thresholds
- **Event Streaming**: Publish alert lifecycle events to Kafka for downstream consumers
- **Auto-Close Mechanism**: Automatically close/delete alerts based on rules and time windows
- **Alert Tracking**: Full audit trail of alert status changes with timestamp history
- **Driver/Source-Based Escalation**: Track alert counts per driver within sliding time windows

### Alert Types
1. **Overspeed Alerts**
   - Escalates after N occurrences within a time window
   - Auto-closes after configured duration

2. **Feedback Negative Alerts**
   - Tracks negative feedback over extended time windows (24h default)
   - Escalates with high threshold

3. **Compliance Alerts**
   - Auto-closes when document validation conditions are met
   - Supports custom metadata-based closure criteria

### Monitoring & Observability
- **Prometheus Metrics**: Track alert counts by status, source type, and severity
- **Loki Logs**: Centralized structured logging for all alert events
- **Grafana Dashboard**: Pre-configured dashboard for visual monitoring
- **Alert Lifecycle Tracking**: Complete event history per alert

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                             │
│                  (api-ingestor:3000)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP POST /alerts
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Alert Processor (4000)                          │
│  • Rule Engine • MySQL Storage • Kafka Publishing            │
└────────┬────────────────────────┬─────────────────┬──────────┘
         │                        │                 │
         ▼                        ▼                 ▼
┌────────────────┐    ┌──────────────────┐   ┌────────────────┐
│  MySQL (3307)  │    │  Kafka (9092)    │   │ Auto-Close     │
│  • alerts      │    │  • alert-events  │   │ Worker (5min)  │
│  • alert_events│    │  (retention)     │   │                │
└────────────────┘    └────────┬─────────┘   └────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
         │   Metrics    │ │     Logs     │ │   Grafana    │
         │  Consumer    │ │   Consumer   │ │  Dashboard   │
         │(Prometheus)  │ │   (Loki)     │ │  (3001)      │
         └──────────────┘ └──────────────┘ └──────────────┘
```

## 🖥️ System Requirements

- **Docker** (v20+)
- **Docker Compose** (v1.29+)
- **8GB RAM** (minimum)
- **2GB Disk Space** (for logs and metrics)

## 🚀 Quick Start

### 1. Prerequisites
Ensure Docker and Docker Compose are installed:

```bash
docker --version
docker-compose --version
```

### 2. Clone and Navigate
```bash
cd c:\Users\asus\Desktop\alert-platform-full
```

### 3. Build and Start All Services
```bash
docker-compose up --build
```

This will start:
- Zookeeper (2181)
- Kafka (9092)
- MySQL (3307)
- API Ingestor (3000)
- Alert Processor (4000)
- Auto-Close Worker
- Metrics Consumer (9100)
- Logs Consumer
- Prometheus (9090)
- Grafana (3001)
- Loki (3100)
- Promtail

### 4. Verify Services are Running
```bash
# Check container status
docker-compose ps

# Test API Ingestor health
curl http://localhost:3000/

# Test Alert Processor health
curl http://localhost:4000/
```

### 5. Access Monitoring Dashboards
- **Grafana**: http://localhost:3001 (admin / admin)
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100 (via Grafana)

### 6. Send Your First Alert
```bash
curl -X POST http://localhost:3000/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "overspeed",
    "driverId": "DR001",
    "severity": "warning",
    "timestamp": "2025-01-12T10:20:00Z",
    "metadata": { "speed": 98, "limit": 60 }
  }'
```

## 📦 Services Overview

### API Ingestor (`api-ingestor:3000`)
**Purpose**: Public API gateway for alert ingestion

**Endpoints**:
- `GET /` - Health check
- `POST /alerts` - Submit new alert

**Environment Variables**:
- `PORT` (default: 3000)
- `PROCESSOR_URL` (default: http://alert-processor:4000/process-alert)

**Dependencies**: Express.js, Axios

---

### Alert Processor (`alert-processor:4000`)
**Purpose**: Core business logic for rule evaluation and alert management

**Key Features**:
- Evaluates alerts against configured rules
- Stores alerts and events in MySQL
- Publishes events to Kafka
- Provides alert retrieval API

**Endpoints**:
- `GET /` - Health check
- `POST /process-alert` - Internal alert processing
- `GET /alerts/:id` - Retrieve alert details with history

**Environment Variables**:
- `PORT` (default: 4000)
- `KAFKA_BROKER` (default: kafka:9092)
- `KAFKA_TOPIC` (default: alert-events)
- `DB_HOST` (default: mysql)
- `DB_USER` (default: root)
- `DB_PASS` (default: cWmp5ZBp)
- `DB_NAME` (default: alertsdb)

**Time Handling**: Uses UTC offset (-5.5 hours) for IST timezone conversion

---

### Auto-Close Worker
**Purpose**: Automatically close and delete expired alerts

**Configuration**:
- `AUTO_CLOSE_POLL_MS` (default: 300000 = 5 minutes)
- `DELETE_AFTER_MINUTES` (default: 5)

**Operations**:
- Scans for alerts that meet auto-close conditions
- Closes alerts based on rule definitions
- Purges deleted alerts after retention period

**Rules Reference**:
```json
{
  "overspeed": {
    "escalate_if_count": 3,
    "window_mins": 2,
    "auto_close_after_mins": 4
  },
  "feedback_negative": {
    "escalate_if_count": 2,
    "window_mins": 1440,
    "auto_close_after_mins": 2880
  },
  "compliance": {
    "auto_close_if": "document_valid"
  }
}
```

---

### Metrics Consumer (Prometheus Exporter)
**Purpose**: Consume Kafka events and expose Prometheus metrics

**Metrics Exposed**:
- `alerts_total` (counter) - Labels: status, sourceType, severity
- Default Node.js metrics

**Port**: 9100

---

### Logs Consumer
**Purpose**: Consume Kafka events and output structured logs

**Log Format**: JSON with fields:
- level
- service
- eventType
- alertId
- sourceType
- status

**Destination**: Loki (http://loki:3100)

---

## ⚙️ Configuration

### Alert Rules (`alert-processor/config/rules.json`)

```json
{
  "overspeed": {
    "escalate_if_count": 3,        // Escalate after 3 alerts
    "window_mins": 2,              // Within 2-minute window
    "auto_close_after_mins": 4     // Auto-close after 4 minutes
  },
  "feedback_negative": {
    "escalate_if_count": 2,        // Escalate after 2 alerts
    "window_mins": 1440,           // Within 24-hour window
    "auto_close_after_mins": 2880  // Auto-close after 48 hours
  },
  "compliance": {
    "auto_close_if": "document_valid" // Auto-close when document is valid
  }
}
```

### Database Configuration
Edit `alert-processor/db.js` to modify:
```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'cWmp5ZBp',
  database: process.env.DB_NAME || 'alertsdb',
  timezone: '+05:30'  // IST
});
```

### Kafka Configuration
Modify environment variables in `docker-compose.yml`:
```yaml
environment:
  KAFKA_BROKER_ID: 1
  KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
  KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
  KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

## 🔌 API Endpoints

### Alert Ingestion
```http
POST /alerts
Host: localhost:3000
Content-Type: application/json

{
  "sourceType": "overspeed",              // Required: one of [overspeed, feedback_negative, compliance]
  "timestamp": "2025-01-12T10:20:00Z",    // Required: ISO 8601 format
  "driverId": "DR001",                    // Optional: identifies the driver/resource
  "severity": "warning",                  // Optional: info, warning, critical
  "metadata": {                           // Optional: custom alert data
    "speed": 98,
    "limit": 60,
    "location": "Highway 101"
  }
}
```

**Response**:
```json
{
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "OPEN"
}
```

### Alert Retrieval
```http
GET /alerts/:id
Host: localhost:4000

```

**Response**:
```json
{
  "alert": {
    "alert_id": "550e8400-e29b-41d4-a716-446655440000",
    "driver_id": "DR001",
    "source_type": "overspeed",
    "severity": "warning",
    "status": "OPEN",
    "timestamp": "2025-01-12T10:20:00Z",
    "metadata": {...}
  },
  "history": [
    {
      "event_type": "CREATED",
      "old_status": null,
      "new_status": "OPEN",
      "timestamp": "2025-01-12T10:20:00Z",
      "metadata": {}
    },
    {
      "event_type": "ESCALATED",
      "old_status": "OPEN",
      "new_status": "ESCALATED",
      "timestamp": "2025-01-12T10:21:00Z",
      "metadata": {"reason": "threshold_exceeded"}
    }
  ]
}
```

### Health Checks
```http
GET /
Host: localhost:3000 (or :4000)
```

**Response**:
```json
{
  "status": "ok",
  "service": "api-ingestor"
}
```

## 🎯 Alert Rules

### Overspeed Rule
- **Trigger**: Multiple speeding incidents within a time window
- **Escalation**: When count ≥ 3 within 2 minutes → Status becomes `ESCALATED`
- **Severity**: Set to `critical`
- **Auto-Close**: After 4 minutes of inactivity
- **Example**:
  ```bash
  curl -X POST http://localhost:3000/alerts \
    -H "Content-Type: application/json" \
    -d '{
      "sourceType": "overspeed",
      "driverId": "DR123",
      "severity": "warning",
      "timestamp": "2025-01-12T10:20:00Z",
      "metadata": { "speed": 98, "limit": 60 }
    }'
  ```

### Feedback Negative Rule
- **Trigger**: Multiple negative feedback within 24 hours
- **Escalation**: When count ≥ 2 within 1440 minutes (24h) → Status becomes `ESCALATED`
- **Severity**: Set to `high`
- **Auto-Close**: After 48 hours (2880 minutes)
- **Example**:
  ```bash
  curl -X POST http://localhost:3000/alerts \
    -H "Content-Type: application/json" \
    -d '{
      "sourceType": "feedback_negative",
      "driverId": "DR456",
      "severity": "warning",
      "timestamp": "2025-01-12T10:20:00Z",
      "metadata": { "rating": 1, "comment": "Rude behavior" }
    }'
  ```

### Compliance Rule
- **Trigger**: Document validation alerts
- **Auto-Close Condition**: When `metadata.document_valid === true` or `metadata.status === "valid"`
- **Example**:
  ```bash
  curl -X POST http://localhost:3000/alerts \
    -H "Content-Type: application/json" \
    -d '{
      "sourceType": "compliance",
      "driverId": "DR789",
      "severity": "info",
      "timestamp": "2025-01-12T10:20:00Z",
      "metadata": { "document_valid": true, "documentId": "DOC001" }
    }'
  ```

## 🗄️ Database Schema

### Alerts Table
```sql
CREATE TABLE alerts (
  alert_id VARCHAR(50) PRIMARY KEY,
  driver_id VARCHAR(50),
  source_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20),
  status VARCHAR(20),
  timestamp DATETIME,
  metadata JSON
);
```

**Fields**:
- `alert_id`: Unique alert identifier (UUID)
- `driver_id`: Associated driver/resource ID
- `source_type`: Type of alert (overspeed, feedback_negative, compliance)
- `severity`: Alert severity (info, warning, critical, high)
- `status`: Current status (OPEN, ESCALATED, AUTO_CLOSED)
- `timestamp`: Alert creation time (UTC converted from IST)
- `metadata`: JSON object with custom alert data

### Alert Events Table
```sql
CREATE TABLE alert_events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  alert_id VARCHAR(50),
  event_type VARCHAR(50),
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  timestamp DATETIME,
  metadata JSON,
  INDEX idx_alert_id (alert_id),
  CONSTRAINT fk_alert FOREIGN KEY (alert_id) REFERENCES alerts(alert_id)
);
```

**Event Types**:
- `CREATED`: Alert first created
- `ESCALATED`: Alert escalated due to threshold breach
- `AUTO_CLOSED`: Alert automatically closed by worker
- `STATUS_CHANGED`: Any manual status change

## 📊 Monitoring & Observability

### Prometheus Metrics
Access metrics at: `http://localhost:9100/metrics`

**Available Metrics**:
```
alerts_total{status="OPEN",sourceType="overspeed",severity="warning"}
alerts_total{status="ESCALATED",sourceType="feedback_negative",severity="high"}
```

### Grafana Dashboards
Access at: `http://localhost:3001` (admin/admin)

**Pre-configured Panels**:
- Alerts Over Time by Status
- Alerts by Severity (pie chart)
- Top 5 Drivers with Open Alerts
- Recent Alert Lifecycle Events
- Auto-Closed Alerts (Last 24h)
- Alert Status Timeline

### Loki Logs
Access via Grafana → Loki datasource

**Query Example**:
```logql
{service="alert-processor", eventType="ESCALATED"}
```

### Structured Logging
All logs are output in JSON format:
```json
{
  "level": "info",
  "service": "alert-processor",
  "eventType": "ESCALATED",
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "sourceType": "overspeed",
  "status": "ESCALATED",
  "timestamp": "2025-01-12T10:20:00Z"
}
```

## � Submitting Alerts from Different Sources

You can submit alerts to the platform from various sources and scripting languages. Below are examples for different platforms and tools.

### PowerShell (Windows)

#### Single Alert
```powershell
$time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Invoke-WebRequest -Uri "http://localhost:3000/alerts" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body @{
    sourceType = "overspeed"
    driverId = "TEST-02"
    severity = "medium"
    timestamp = $time
    metadata = @{ speed = 121; limit = 100 }
  } | ConvertTo-Json
```

#### Multiple Alerts in Loop (Simulate escalation)
```powershell
for ($i = 1; $i -le 3; $i++) {
  $time = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
  $body = @{
    sourceType = "overspeed"
    driverId = "DR-POWERSHELL-01"
    severity = "warning"
    timestamp = $time
    metadata = @{ 
      speed = 95 + $i * 2
      limit = 60
      location = "Highway 101"
    }
  } | ConvertTo-Json
  
  Write-Host "Sending alert $i..."
  Invoke-WebRequest -Uri "http://localhost:3000/alerts" `
    -Method POST `
    -Headers @{ "Content-Type" = "application/json" } `
    -Body $body
  
  Start-Sleep -Seconds 5
}
```

#### Compliance Alert (Auto-Close Example)
```powershell
$time = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
$body = @{
  sourceType = "compliance"
  driverId = "DR-COMPLIANCE-01"
  severity = "info"
  timestamp = $time
  metadata = @{ 
    document_valid = $true
    documentId = "LICENSE-2025-001"
    documentType = "driver_license"
  }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/alerts" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```

#### Negative Feedback Alert
```powershell
$time = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
$body = @{
  sourceType = "feedback_negative"
  driverId = "DR-FEEDBACK-01"
  severity = "warning"
  timestamp = $time
  metadata = @{ 
    rating = 1
    comment = "Rude behavior towards customer"
    customerId = "CUST-123"
  }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/alerts" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```

## �📝 Usage Examples

### Example 1: Trigger Overspeed Escalation
Send 3 overspeed alerts for the same driver within 2 minutes:

```bash
for i in {1..3}; do
  curl -X POST http://localhost:3000/alerts \
    -H "Content-Type: application/json" \
    -d "{
      \"sourceType\": \"overspeed\",
      \"driverId\": \"DR001\",
      \"severity\": \"warning\",
      \"timestamp\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\",
      \"metadata\": { \"speed\": 95, \"limit\": 60 }
    }"
  sleep 5
done

# Check the alert status
curl http://localhost:4000/alerts/$(ALERT_ID)
```

### Example 2: Compliance Auto-Close
Send a compliance alert that auto-closes:

```bash
curl -X POST http://localhost:3000/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "compliance",
    "driverId": "DR002",
    "severity": "info",
    "timestamp": "2025-01-12T10:20:00Z",
    "metadata": {
      "document_valid": true,
      "documentId": "LIC123"
    }
  }'
```

### Example 3: Query Alerts in Database
```bash
# Connect to MySQL
docker exec -it alert-platform-full-mysql-1 mysql -u root -pcWmp5ZBp -D alertsdb

# Query alerts
SELECT alert_id, driver_id, source_type, status, timestamp FROM alerts;

# Query events for specific alert
SELECT * FROM alert_events WHERE alert_id = 'xxx' ORDER BY timestamp;
```

### Example 4: Monitor Kafka Events
```bash
# Access Kafka container
docker exec -it alert-platform-full-kafka-1 /bin/bash

# Consume events
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic alert-events --from-beginning
```

## 🔧 Troubleshooting

### Services Won't Start
```bash
# Check logs
docker-compose logs -f

# Rebuild containers
docker-compose down -v
docker-compose up --build

# Check specific service
docker-compose logs alert-processor
```

### MySQL Connection Errors
```bash
# Verify MySQL is running and accessible
docker exec alert-platform-full-mysql-1 mysql -u root -pcWmp5ZBp -e "SELECT 1"

# Check credentials in docker-compose.yml
```

### Kafka Connection Issues
```bash
# Test Kafka connectivity
docker exec alert-platform-full-kafka-1 kafka-broker-api-versions.sh \
  --bootstrap-server localhost:9092

# Check Zookeeper
docker exec alert-platform-full-zookeeper-1 echo ruok | nc localhost 2181
```

### Time Synchronization Issues
The system uses a UTC offset of -5.5 hours (IST to UTC conversion).
- Verify system timezone is correct
- Check `getDbTime()` function in `alert-processor/index.js`
- Review logs in `debug_math.js`

```bash
node debug_math.js
```

### High Memory Usage
```bash
# Check container resource usage
docker stats

# Reduce Kafka retention
# Modify docker-compose.yml Kafka environment variables
```

### Alerts Not Appearing in Grafana
1. Verify Prometheus is scraping metrics: http://localhost:9090/targets
2. Check datasource configuration in Grafana
3. Verify alert-processor is running: `docker-compose ps`
4. Check metrics consumer logs: `docker-compose logs metrics-consumer`

## 📚 Additional Resources

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [MySQL 8 Documentation](https://dev.mysql.com/doc/)
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Guide](https://grafana.com/docs/grafana/latest/dashboards/)
- [Loki Log Queries](https://grafana.com/docs/loki/latest/logql/)

## 📄 License

ISC

## 👥 Contributing

To modify alert rules, update `alert-processor/config/rules.json` and restart:
```bash
docker-compose restart alert-processor auto-close-worker
```

To add new alert types:
1. Create handler in `alert-processor/rule-engine/sources/{type}.js`
2. Register in `alert-processor/rule-engine/index.js`
3. Add rule configuration to `rules.json`
4. Restart services
