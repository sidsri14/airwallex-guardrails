export class AgentSpendPolicy {
  constructor(config) {
    this.agentId = config.agentId;
    this.maxPerTx = config.maxPerTx;
    this.maxRollingEpoch = config.maxRollingEpoch;
    this.epochDurationMs = config.epochDurationMs || 86400000;
    this.allowedMerchantCategories = config.allowedMerchantCategories || [];
    this.active = true;
    this.epochStart = Date.now();
    this.epochSpend = 0;
  }

  _refreshEpoch() {
    const now = Date.now();
    if (now - this.epochStart >= this.epochDurationMs) {
      this.epochStart = now;
      this.epochSpend = 0;
    }
  }

  getRemainingBudget() {
    this._refreshEpoch();
    if (!this.active) return 0;
    return Math.max(0, this.maxRollingEpoch - this.epochSpend);
  }

  evaluateRequest(req) {
    if (!this.active) {
      return {
        approved: false,
        reason: 'AGENT_POLICY_REVOKED',
        remainingBudget: 0,
      };
    }

    this._refreshEpoch();

    if (req.amount <= 0) {
      return {
        approved: false,
        reason: 'INVALID_AMOUNT',
        remainingBudget: this.getRemainingBudget(),
      };
    }

    if (req.amount > this.maxPerTx) {
      return {
        approved: false,
        reason: 'EXCEEDS_PER_TX_LIMIT',
        remainingBudget: this.getRemainingBudget(),
      };
    }

    if (this.epochSpend + req.amount > this.maxRollingEpoch) {
      return {
        approved: false,
        reason: 'EXCEEDS_ROLLING_EPOCH_LIMIT',
        remainingBudget: this.getRemainingBudget(),
      };
    }

    if (
      this.allowedMerchantCategories.length > 0 &&
      (!req.merchantCategory || !this.allowedMerchantCategories.includes(req.merchantCategory))
    ) {
      return {
        approved: false,
        reason: 'MERCHANT_CATEGORY_NOT_PERMITTED',
        remainingBudget: this.getRemainingBudget(),
      };
    }

    return {
      approved: true,
      remainingBudget: this.maxRollingEpoch - (this.epochSpend + req.amount),
    };
  }

  recordSpend(amount) {
    this._refreshEpoch();
    this.epochSpend += amount;
  }

  revoke() {
    this.active = false;
  }

  reinstate() {
    this.active = true;
  }
}
