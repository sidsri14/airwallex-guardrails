import { AgentCardController } from './src/agent_card_controller.mjs';

async function main() {
  console.log('================================================================');
  console.log('  AIRWALLEX GUARDRAILS: AUTONOMOUS AGENT TREASURY CONTROLLER    ');
  console.log('================================================================\n');

  const controller = new AgentCardController({
    agentId: 'autonomous-researcher-01',
    maxPerTx: 50.0,
    maxRollingEpoch: 150.0,
    allowedMerchantCategories: ['AI_INFERENCE', 'CLOUD_COMPUTE', 'DATA_FEEDS'],
  });

  console.log('Initial Policy Limits:');
  console.log(`- Agent ID: ${controller.policy.agentId}`);
  console.log(`- Max Per-Transaction: $${controller.policy.maxPerTx.toFixed(2)}`);
  console.log(`- 24h Rolling Epoch Budget: $${controller.policy.maxRollingEpoch.toFixed(2)}`);
  console.log(`- Allowed Categories: ${controller.policy.allowedMerchantCategories.join(', ')}\n`);

  console.log('[Scenario 1]: Agent requests $14.50 for Groq Llama-3.3 70B token batch...');
  const tx1 = await controller.requestPaymentCard({
    amount: 14.5,
    merchantCategory: 'AI_INFERENCE',
    purpose: 'Groq API inference run',
  });
  console.log(`Result: ${tx1.success ? 'APPROVED ✅' : 'DENIED ❌'}`);
  console.log(`Card Token: ${tx1.card.panMasked} (CVV: ${tx1.card.cvv}, Limit: $${tx1.card.spendingLimit})`);
  console.log(`Remaining Epoch Budget: $${tx1.receipt.remainingEpochBudget.toFixed(2)}\n`);

  console.log('[Scenario 2]: Agent requests $42.00 for Pinecone vector index queries...');
  const tx2 = await controller.requestPaymentCard({
    amount: 42.0,
    merchantCategory: 'DATA_FEEDS',
    purpose: 'Pinecone index lookup',
  });
  console.log(`Result: ${tx2.success ? 'APPROVED ✅' : 'DENIED ❌'}`);
  console.log(`Card Token: ${tx2.card.panMasked} (CVV: ${tx2.card.cvv}, Limit: $${tx2.card.spendingLimit})`);
  console.log(`Remaining Epoch Budget: $${tx2.receipt.remainingEpochBudget.toFixed(2)}\n`);

  console.log('[Scenario 3]: Adversarial Prompt Injection — Agent attempts $35.00 for GAMBLING...');
  const tx3 = await controller.requestPaymentCard({
    amount: 35.0,
    merchantCategory: 'GAMBLING_CASINO',
    purpose: 'Unauthorized offshore spend',
  });
  console.log(`Result: ${tx3.success ? 'APPROVED ✅' : 'DENIED ❌'}`);
  console.log(`Denial Reason: ${tx3.error} (${tx3.details.reason})\n`);

  console.log('[Scenario 4]: Runaway Loop Defense — Agent requests $120.00 (Exceeds remaining budget)...');
  const tx4 = await controller.requestPaymentCard({
    amount: 120.0,
    merchantCategory: 'CLOUD_COMPUTE',
    purpose: 'Unbounded GPU cluster rental',
  });
  console.log(`Result: ${tx4.success ? 'APPROVED ✅' : 'DENIED ❌'}`);
  console.log(`Denial Reason: ${tx4.error} (${tx4.details.reason})\n`);

  console.log('================================================================');
  console.log('  TAMPER-EVIDENT AUDIT TRAIL LOGGED                            ');
  console.log('================================================================');
  const trail = controller.getAuditTrail();
  console.table(trail);
  console.log('\nDemo complete: Zero treasury drain, all policy invariants strictly enforced.\n');
}

main().catch(console.error);
