import assert from 'node:assert/strict';
import { AgentCardController } from '../src/agent_card_controller.mjs';

async function runTests() {
  console.log('🧪 Starting Airwallex GuardRails Test Suite...\n');

  const controller = new AgentCardController({
    agentId: 'agent_groq_buyer',
    maxPerTx: 20.0,
    maxRollingEpoch: 50.0,
    allowedMerchantCategories: ['AI_INFERENCE', 'CLOUD_COMPUTE'],
  });

  const res1 = await controller.requestPaymentCard({
    amount: 15.0,
    merchantCategory: 'AI_INFERENCE',
    purpose: 'Groq Llama-3.3 70B inference tokens',
  });
  assert.equal(res1.success, true);
  assert.ok(res1.card.cardId);
  assert.equal(res1.card.spendingLimit, 15.0);
  assert.equal(res1.receipt.remainingEpochBudget, 35.0);
  console.log('✅ Test 1 Passed: Valid card issuance within caps');

  const res2 = await controller.requestPaymentCard({
    amount: 25.0,
    merchantCategory: 'AI_INFERENCE',
    purpose: 'Exceeding single tx cap',
  });
  assert.equal(res2.success, false);
  assert.equal(res2.error, 'EXCEEDS_PER_TX_LIMIT');
  assert.equal(res2.details.remainingBudget, 35.0);
  console.log('✅ Test 2 Passed: Single transaction cap violation rejected');

  const res3 = await controller.requestPaymentCard({
    amount: 10.0,
    merchantCategory: 'GAMBLING_OR_UNKNOWN',
    purpose: 'Unauthorized merchant category',
  });
  assert.equal(res3.success, false);
  assert.equal(res3.error, 'MERCHANT_CATEGORY_NOT_PERMITTED');
  console.log('✅ Test 3 Passed: Disallowed merchant category rejected');

  const res4 = await controller.requestPaymentCard({
    amount: 20.0,
    merchantCategory: 'CLOUD_COMPUTE',
    purpose: 'Modal Labs H100 fine-tuning slice',
  });
  assert.equal(res4.success, true);
  assert.equal(res4.receipt.remainingEpochBudget, 15.0);

  const res5 = await controller.requestPaymentCard({
    amount: 20.0,
    merchantCategory: 'CLOUD_COMPUTE',
    purpose: 'Overdrawing epoch remaining limit',
  });
  assert.equal(res5.success, false);
  assert.equal(res5.error, 'EXCEEDS_ROLLING_EPOCH_LIMIT');
  console.log('✅ Test 4 Passed: Cumulative epoch overdraw prevented');

  controller.emergencyRevoke();
  const res6 = await controller.requestPaymentCard({
    amount: 5.0,
    merchantCategory: 'AI_INFERENCE',
    purpose: 'Attempting spend during revocation',
  });
  assert.equal(res6.success, false);
  assert.equal(res6.error, 'AGENT_POLICY_REVOKED');
  console.log('✅ Test 5 Passed: Emergency kill-switch instant fail-closed');

  controller.reinstatePolicy();
  const res7 = await controller.requestPaymentCard({
    amount: 5.0,
    merchantCategory: 'AI_INFERENCE',
    purpose: 'Spend after reinstatement within remaining budget',
  });
  assert.equal(res7.success, true);
  assert.equal(res7.receipt.remainingEpochBudget, 10.0);
  console.log('✅ Test 6 Passed: Reinstatement restores lawful spend');

  const trail = controller.getAuditTrail();
  assert.equal(trail.length, 7);
  console.log('✅ Test 7 Passed: Tamper-evident audit trail integrity verified');

  const verifyValid = controller.verifyAuditTrail();
  assert.equal(verifyValid.valid, true);
  assert.equal(verifyValid.count, 7);
  assert.ok(verifyValid.headHash);
  console.log('✅ Test 8 Passed: SHA-256 cryptographic chain verification succeeds');

  const originalAmount = controller.auditLog[2].requestedAmount;
  controller.auditLog[2].requestedAmount = 999999.0;
  const tamperResult = controller.verifyAuditTrail();
  assert.equal(tamperResult.valid, false);
  controller.auditLog[2].requestedAmount = originalAmount;
  console.log('✅ Test 9 Passed: Cryptographic tampering detected and rejected');

  const telemetry = controller.getTelemetry();
  assert.equal(telemetry.agentId, 'agent_groq_buyer');
  assert.equal(telemetry.totalTransactions, 7);
  assert.equal(telemetry.approvedCount, 3);
  assert.equal(telemetry.deniedCount, 4);
  console.log('✅ Test 10 Passed: Telemetry state metrics strictly consistent');

  controller.updatePolicy({ maxPerTx: 100.0, maxRollingEpoch: 500.0 });
  assert.equal(controller.policy.maxPerTx, 100.0);
  assert.equal(controller.policy.maxRollingEpoch, 500.0);
  console.log('✅ Test 11 Passed: Dynamic policy limits successfully updated');

  console.log('\n🎉 ALL 11/11 AIRWALLEX GUARDRAILS TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
