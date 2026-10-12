# 🛡️ Airwallex GuardRails — Autonomous Agent Spend & Virtual Card Controller

> Built for the **Airwallex Agentic Banking Hackathon** ($100,000 in Prizes & API Credits).  
> Category: Agentic Treasury, Corporate Cards & Autonomous Commerce.

---

## 1. Problem & Architecture

When autonomous AI agents purchase third-party compute (Modal, RunPod), API inference (Groq, OpenAI, Anthropic), or data indexers, giving them direct access to static corporate credit cards introduces catastrophic tail risk:
- **Runaway Token Loops**: An agent trapped in a recursive self-reflection loop can charge thousands of dollars in minutes.
- **Prompt Injection & Credential Theft**: Prompt injection can trick an agent into revealing raw card numbers or CVVs.
- **Overbilling**: Third-party providers charging more than the negotiated rate.

### The GuardRails Solution
`Airwallex GuardRails` is a fail-closed middleware sitting between the autonomous agent and the Airwallex Issuing API:
1. The agent requests funds for a specific purchase (amount, merchant category, purpose).
2. The deterministic `AgentSpendPolicy` validates the request against:
   - Per-transaction cap (e.g. $20 max per call).
   - Rolling epoch budget (e.g. $50 per 24 hours).
   - Merchant category whitelist (`AI_INFERENCE`, `CLOUD_COMPUTE`).
3. If approved, `Airwallex GuardRails` calls the Airwallex Issuing API to generate an **ephemeral, single-use virtual card** loaded with the exact approved amount to the cent.
4. If denied or if the agent is compromised, the transaction is rejected instantly and logged to a tamper-evident audit trail.

```
[ Autonomous AI Agent ]
        │
        ▼  1. Request card: amount=$15, category="AI_INFERENCE"
[ Airwallex GuardRails Engine ]
        │
        ├─ 2. Evaluate AgentSpendPolicy (Per-Tx Cap & Rolling Epoch)
        │     └─ Deny & log if caps exceeded or kill-switch triggered
        ▼  3. Call Airwallex Issuing API
[ Airwallex Issuing Platform ]
        │
        ▼  4. Returns Single-Use Ephemeral Card ($15.00 limit, expires upon settlement)
[ Autonomous AI Agent ]
        │
        ▼  5. Settles purchase with external API provider
```

---

## 2. Verified Test Coverage

Run the automated test suite:

```bash
npm test
```

### Verified Test Cases (7/7 Passing)
1. **Valid Card Issuance**: Dynamically creates a virtual card when request satisfies policy caps.
2. **Per-Transaction Cap Enforcement**: Reverts and denies requests exceeding single-call thresholds.
3. **Merchant Category Whitelisting**: Rejects transactions destined for unapproved industries or MCCs.
4. **Rolling Epoch Overdraw Protection**: Prevents multi-transaction drain across time windows.
5. **Emergency Kill-Switch**: Operator can instantly revoke agent credentials in real-time (`emergencyRevoke`).
6. **Policy Reinstatement**: Validates clean recovery when operator reinstates permissions.
7. **Tamper-Evident Audit Trail**: Verifies structured JSON audit logs capturing approvals and denials.

---

## 3. Tech Stack

- **Runtime**: Node.js (ESM Native, zero external runtime dependencies).
- **Core APIs**: Airwallex Issuing API (`/issuing/cards/create`, `/issuing/cards/{id}`).
- **Security Primitives**: Node.js `crypto` CSPRNG, fail-closed policy gates.
