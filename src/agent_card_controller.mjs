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

  _computeHash(prevHash, entry) {
    const payload = `${prevHash}|${entry.txId}|${entry.timestamp}|${entry.status}|${entry.requestedAmount}|${entry.reason || entry.cardId || ''}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async requestPaymentCard(req) {
    const evaluation = this.policy.evaluateRequest(req);
    const txId = `tx_${crypto.randomBytes(6).toString('hex')}`;
    const prevHash = this.auditLog.length > 0
      ? this.auditLog[this.auditLog.length - 1].hash
      : '0000000000000000000000000000000000000000000000000000000000000000';

    if (!evaluation.approved) {
      const denialRecord = {
        txId,
        prevHash,
        agentId: this.policy.agentId,
        timestamp: new Date().toISOString(),
        status: 'DENIED',
        requestedAmount: req.amount,
        currency: req.currency || 'USD',
        merchantCategory: req.merchantCategory,
        reason: evaluation.reason,
        remainingBudget: evaluation.remainingBudget,
      };
      denialRecord.hash = this._computeHash(prevHash, denialRecord);
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
      prevHash,
      agentId: this.policy.agentId,
      timestamp: new Date().toISOString(),
      status: 'ISSUED',
      requestedAmount: req.amount,
      currency: req.currency || 'USD',
      merchantCategory: req.merchantCategory,
      cardId: card.cardId,
      panMasked: card.panMasked,
      remainingEpochBudget: this.policy.getRemainingBudget(),
    };
    approvalRecord.hash = this._computeHash(prevHash, approvalRecord);

    this.auditLog.push(approvalRecord);

    return {
      success: true,
      card,
      receipt: approvalRecord,
    };
  }

  verifyAuditTrail() {
    if (this.auditLog.length === 0) {
      return { valid: true, count: 0, headHash: 'GENESIS' };
    }

    let expectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < this.auditLog.length; i++) {
      const entry = this.auditLog[i];
      if (entry.prevHash !== expectedPrev) {
        return {
          valid: false,
          error: `Broken chain link at index ${i}: prevHash mismatch`,
          index: i,
        };
      }
      const calculated = this._computeHash(expectedPrev, entry);
      if (entry.hash !== calculated) {
        return {
          valid: false,
          error: `Tampered hash at index ${i}: recomputed hash mismatch`,
          index: i,
        };
      }
      expectedPrev = entry.hash;
    }

    return {
      valid: true,
      count: this.auditLog.length,
      headHash: this.auditLog[this.auditLog.length - 1].hash,
    };
  }

  getTelemetry() {
    return {
      agentId: this.policy.agentId,
      active: this.policy.active,
      maxPerTx: this.policy.maxPerTx,
      maxRollingEpoch: this.policy.maxRollingEpoch,
      epochSpend: this.policy.epochSpend,
      remainingBudget: this.policy.getRemainingBudget(),
      allowedMerchantCategories: [...this.policy.allowedMerchantCategories],
      totalTransactions: this.auditLog.length,
      approvedCount: this.auditLog.filter((e) => e.status === 'ISSUED').length,
      deniedCount: this.auditLog.filter((e) => e.status === 'DENIED').length,
      headHash: this.auditLog.length > 0 ? this.auditLog[this.auditLog.length - 1].hash : 'GENESIS',
    };
  }

  updatePolicy(config = {}) {
    if (config.maxPerTx !== undefined) this.policy.maxPerTx = Number(config.maxPerTx);
    if (config.maxRollingEpoch !== undefined) this.policy.maxRollingEpoch = Number(config.maxRollingEpoch);
    if (config.allowedMerchantCategories) {
      this.policy.allowedMerchantCategories = [...config.allowedMerchantCategories];
    }
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
