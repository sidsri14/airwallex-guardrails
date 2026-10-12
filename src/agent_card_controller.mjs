import crypto from 'node:crypto';
import { AgentSpendPolicy } from './policy.mjs';
import { AirwallexIssuingClient } from './airwallex_client.mjs';

export class AgentCardController {
  constructor(config = {}) {
    this.policy = new AgentSpendPolicy({
      agentId: config.agentId || 'agent_default',
      maxPerTx: config.maxPerTx ?? 50.0,
      maxRollingEpoch: config.maxRollingEpoch ?? 250.0,
      epochDurationMs: config.epochDurationMs || 86400000,
      allowedMerchantCategories: config.allowedMerchantCategories || [
        'AI_INFERENCE',
        'CLOUD_COMPUTE',
        'DEVELOPER_TOOLS',
        'DATA_FEEDS',
      ],
    });
    this.client = new AirwallexIssuingClient(config.airwallex || {});
    this.auditLog = [];
  }

  async requestPaymentCard(req) {
    const evaluation = this.policy.evaluateRequest(req);
    const txId = `tx_${crypto.randomBytes(6).toString('hex')}`;

    if (!evaluation.approved) {
      const denialRecord = {
        txId,
        agentId: this.policy.agentId,
        timestamp: new Date().toISOString(),
        status: 'DENIED',
        requestedAmount: req.amount,
        merchantCategory: req.merchantCategory,
        reason: evaluation.reason,
        remainingBudget: evaluation.remainingBudget,
      };
      this.auditLog.push(denialRecord);
      return {
        success: false,
        error: evaluation.reason,
        details: denialRecord,
      };
    }

    const card = await this.client.issueEphemeralVirtualCard({
      amount: req.amount,
      currency: req.currency || 'USD',
      purpose: req.purpose || `Agent Purchase for ${req.merchantCategory}`,
      maxUsageCount: 1,
    });

    this.policy.recordSpend(req.amount);

    const approvalRecord = {
      txId,
      agentId: this.policy.agentId,
      timestamp: new Date().toISOString(),
      status: 'ISSUED',
      requestedAmount: req.amount,
      cardId: card.cardId,
      panMasked: card.panMasked,
      remainingEpochBudget: this.policy.getRemainingBudget(),
    };

    this.auditLog.push(approvalRecord);

    return {
      success: true,
      card,
      receipt: approvalRecord,
    };
  }

  getAuditTrail() {
    return [...this.auditLog];
  }

  emergencyRevoke() {
    this.policy.revoke();
  }

  reinstatePolicy() {
    this.policy.reinstate();
  }
}
