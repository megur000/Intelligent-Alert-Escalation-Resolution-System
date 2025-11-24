const overspeedHandler = require('./sources/overspeed');
const feedbackNegativeHandler = require('./sources/feedbackNegative');
const complianceHandler = require('./sources/compliance');
const rules = require('../config/rules.json');

const handlers = {
  overspeed: overspeedHandler,
  feedback_negative: feedbackNegativeHandler,
  compliance: complianceHandler
};

async function evaluateAlert(alert) {
  const handler = handlers[alert.sourceType];

  if (!handler) {
    const status = 'OPEN';
    alert.status = status;
    return {
      alert,
      events: [{
        eventType: 'CREATED',
        oldStatus: null,
        newStatus: 'OPEN',
        metadata: {}
      }]
    };
  }

  const srcRules = rules[alert.sourceType] || {};
  return handler(alert, srcRules);
}

module.exports = { evaluateAlert };
