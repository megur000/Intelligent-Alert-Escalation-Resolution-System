module.exports = async function handleCompliance(alert, ruleConfig) {
  let status = 'OPEN';
  const events = [];

  events.push({
    eventType: 'CREATED',
    oldStatus: null,
    newStatus: 'OPEN',
    metadata: {}
  });

  const meta = alert.metadata || {};

  if (ruleConfig?.auto_close_if === "document_valid" &&
      (meta.status === "valid" || meta.document_valid === true)) {
    
    const old = status;
    status = 'AUTO_CLOSED';

    events.push({
      eventType: 'AUTO_CLOSED',
      oldStatus: old,
      newStatus: status,
      metadata: { reason: "document_valid" }
    });
  }

  alert.status = status;
  return { alert, events };
};
