/**
 * Airwallex GuardRails Interactive Dashboard Server
 * Real-time API & GUI server for autonomous agent treasury management
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AgentCardController } from './agent_card_controller.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');

export function createAirwallexServer(options = {}) {
  const controller = new AgentCardController({
    agentId: options.agentId || 'agent_procure_01',
    maxPerTx: options.maxPerTx ?? 50.0,
    maxRollingEpoch: options.maxRollingEpoch ?? 200.0,
    allowedMerchantCategories: options.allowedMerchantCategories || [
      'AI_INFERENCE',
      'CLOUD_COMPUTE',
      'DEVELOPER_TOOLS',
      'DATA_FEEDS',
    ],
  });

  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Status endpoint
    if (pathname === '/api/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        telemetry: controller.getTelemetry(),
      }));
      return;
    }

    // Audit trail & proof
    if (pathname === '/api/audit-trail' && req.method === 'GET') {
      const proof = controller.verifyAuditTrail();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        proof,
        trail: controller.getAuditTrail(),
      }));
      return;
    }

    // Audit verification
    if (pathname === '/api/audit-verify' && req.method === 'GET') {
      const proof = controller.verifyAuditTrail();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        proof,
      }));
      return;
    }

    // Emergency Revoke
    if (pathname === '/api/policy/revoke' && req.method === 'POST') {
      controller.emergencyRevoke();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Emergency kill switch activated. Agent spend policies revoked.',
        telemetry: controller.getTelemetry(),
      }));
      return;
    }

    // Reinstate Policy
    if (pathname === '/api/policy/reinstate' && req.method === 'POST') {
      controller.reinstatePolicy();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Agent spend policy reinstated.',
        telemetry: controller.getTelemetry(),
      }));
      return;
    }

    // Request Card
    if (pathname === '/api/card/request' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = await controller.requestPaymentCard({
            amount: Number(payload.amount),
            currency: payload.currency || 'USD',
            merchantCategory: payload.merchantCategory || 'AI_INFERENCE',
            purpose: payload.purpose || 'Autonomous Agent API Spend',
          });
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ...result,
            telemetry: controller.getTelemetry(),
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Update Policy
    if (pathname === '/api/policy/update' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          controller.updatePolicy(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Policy parameters successfully updated.',
            telemetry: controller.getTelemetry(),
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Simulate Preset
    if (pathname === '/api/simulate-preset' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { scenario } = JSON.parse(body || '{}');
          let requestPayload = null;

          if (scenario === 'groq') {
            requestPayload = {
              amount: 14.50,
              currency: 'USD',
              merchantCategory: 'AI_INFERENCE',
              purpose: 'Groq Llama-3.3 70B token batch execution',
            };
          } else if (scenario === 'pinecone') {
            requestPayload = {
              amount: 42.00,
              currency: 'USD',
              merchantCategory: 'DATA_FEEDS',
              purpose: 'Pinecone serverless vector index queries',
            };
          } else if (scenario === 'adversarial') {
            requestPayload = {
              amount: 35.00,
              currency: 'USD',
              merchantCategory: 'GAMBLING_CASINO',
              purpose: 'Prompt injection unauthorized offshore casino spend',
            };
          } else if (scenario === 'overdraw') {
            requestPayload = {
              amount: 180.00,
              currency: 'USD',
              merchantCategory: 'CLOUD_COMPUTE',
              purpose: 'Unbounded GPU cluster rental overdraw',
            };
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Unknown scenario preset' }));
            return;
          }

          const result = await controller.requestPaymentCard(requestPayload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ...result,
            scenario,
            telemetry: controller.getTelemetry(),
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Serve static files from public/
    let filePath = pathname === '/' ? join(publicDir, 'index.html') : join(publicDir, pathname);

    if (existsSync(filePath)) {
      const ext = filePath.split('.').pop();
      const contentTypes = {
        html: 'text/html; charset=utf-8',
        css: 'text/css; charset=utf-8',
        js: 'application/javascript; charset=utf-8',
        json: 'application/json; charset=utf-8',
        png: 'image/png',
        svg: 'image/svg+xml',
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  return { server, controller };
}

// Auto-run if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const PORT = process.env.PORT || 4100;
  const { server } = createAirwallexServer();
  server.listen(PORT, () => {
    console.log(`\n🏦 Airwallex GuardRails Console running at http://localhost:${PORT}`);
    console.log(`🛡️  Autonomous Agent Banking Firewall ready.\n`);
  });
}
