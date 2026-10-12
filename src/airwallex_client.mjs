import crypto from 'node:crypto';

export class AirwallexIssuingClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.AIRWALLEX_API_KEY;
    this.clientId = options.clientId || process.env.AIRWALLEX_CLIENT_ID;
    this.baseUrl = options.baseUrl || 'https://api.airwallex.com/api/v1';
    this.isSandbox = options.sandbox ?? true;
    this.issuedCards = new Map();
  }

  async authenticate() {
    if (!this.apiKey || !this.clientId) {
      return { token: 'mock_airwallex_bearer_token' };
    }

    const res = await fetch(`${this.baseUrl}/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.clientId,
        'x-api-key': this.apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Airwallex authentication failed: ${res.statusText}`);
    }

    return await res.json();
  }

  async issueEphemeralVirtualCard(params) {
    const { amount, currency = 'USD', cardholderId, purpose, maxUsageCount = 1 } = params;

    if (!this.apiKey || !this.clientId) {
      const cardId = `card_${crypto.randomBytes(8).toString('hex')}`;
      const panLast4 = Math.floor(1000 + Math.random() * 9000).toString();
      const card = {
        cardId,
        panMasked: `411111******${panLast4}`,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        expiry: '12/28',
        currency,
        spendingLimit: amount,
        usageType: 'SINGLE_USE',
        status: 'ACTIVE',
        purpose: purpose || 'Agent Compute/API purchase',
        remainingBalance: amount,
        createdAt: new Date().toISOString(),
      };
      this.issuedCards.set(cardId, card);
      return card;
    }

    const tokenData = await this.authenticate();
    const res = await fetch(`${this.baseUrl}/issuing/cards/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.token}`,
      },
      body: JSON.stringify({
        cardholder_id: cardholderId,
        type: 'VIRTUAL',
        usage_type: maxUsageCount === 1 ? 'SINGLE_USE' : 'RECURRING',
        currency,
        spending_limits: [
          {
            amount,
            currency,
            interval: 'PER_TRANSACTION',
          },
        ],
        metadata: { purpose },
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to issue Airwallex card: ${res.statusText}`);
    }

    return await res.json();
  }

  async getCard(cardId) {
    if (this.issuedCards.has(cardId)) {
      return this.issuedCards.get(cardId);
    }
    return null;
  }

  async freezeCard(cardId) {
    if (this.issuedCards.has(cardId)) {
      const card = this.issuedCards.get(cardId);
      card.status = 'SUSPENDED';
      return card;
    }
    return null;
  }
}
