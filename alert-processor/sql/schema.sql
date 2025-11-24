CREATE TABLE IF NOT EXISTS alerts (
  alert_id VARCHAR(50) PRIMARY KEY,
  driver_id VARCHAR(50),
  source_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20),
  status VARCHAR(20),
  timestamp DATETIME,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS alert_events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  alert_id VARCHAR(50),
  event_type VARCHAR(50),
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  timestamp DATETIME,
  metadata JSON,
  INDEX idx_alert_id (alert_id),
  CONSTRAINT fk_alert FOREIGN KEY (alert_id) REFERENCES alerts(alert_id)
    ON DELETE CASCADE
);
