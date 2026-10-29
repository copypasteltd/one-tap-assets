// Synthetic protocol driver. It is NOT Codex, an AI model, or an OS isolation
// implementation. Real HTTPS/MCP and the durable platform tools are exercised.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const syntheticThread = `synthetic-fresh-thread-${require('node:crypto').randomUUID()}`;
const mode = process.env.YPCC_SYNTHETIC_MODE || 'NORMAL';
const input = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'input.json'), 'utf8'));
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
let bridge; let seq = 0; const pending = new Map();
function startBridge() {
  if (bridge) return;
  bridge = spawn(process.execPath, [process.env.YPCC_SYNTHETIC_BRIDGE], { cwd: process.cwd(), env: process.env, shell: false,
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  bridge.stderr.resume();
  readline.createInterface({ input: bridge.stdout }).on('line', line => {
    const message = JSON.parse(line); const entry = pending.get(message.id); if (!entry) return; pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
  });
}
function mcp(method, params = {}) {
  startBridge(); const id = ++seq;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); bridge.stdin.write(JSON.stringify({ id, method, params }) + '\n'); });
}
async function tool(name, args = {}) {
  const result = await mcp('tools/call', { name, arguments: args }); if (result.isError) throw new Error('Synthetic tool rejected'); return result;
}
async function inference(turnInput, probe) {
  const images = (turnInput || []).filter(i => i.type === 'image').map(i => ({ type: 'input_image', image_url: i.url, detail: i.detail }));
  if (mode === 'REVIEW_MISSING_IMAGE') images.pop();
  if (mode === 'REVIEW_WRONG_IMAGE' && images.length) images[0].image_url = 'data:image/png;base64,Y29ycnVwdA==';
  if (probe === 'MISSING') images.pop();
  if (probe === 'TAMPERED') images[0].image_url = 'data:image/png;base64,Y29ycnVwdA==';
  if (probe === 'DETAIL') images[0].detail = 'low';
  const reviewText = images.length && probe !== 'TEXT' ? turnInput.filter(i => i.type === 'text').map(i => i.text).join('\n')
    : 'Synthetic driver, no real inference.';
  const body = Buffer.from(JSON.stringify({ model: 'synthetic-codex-fixture', store: false, stream: true,
    input: [{ role: 'user', content: images.length ? [{ type: 'input_text', text: reviewText }, ...images]
      : 'Synthetic driver, no real inference.' }], tools: [] }));
  await new Promise((resolve, reject) => {
    const req = https.request(new URL('/v1/internal/p01/agent-inference/responses', process.env.YPCC_TOOL_ENDPOINT), {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.YPCC_ROLE_CAPABILITY}`, 'Content-Type': 'application/json', 'Content-Length': body.length },
      ca: fs.readFileSync(process.env.YPCC_TOOL_CA_FILE), rejectUnauthorized: true,
    }, res => { res.resume(); res.on('error', reject); res.on('end', () => res.statusCode === 200 ? resolve() : reject(new Error('Synthetic inference gate rejected'))); });
    req.on('error', reject); req.end(body);
  });
}
async function dispatch(message) {
  if (message.method === 'initialize') return { userAgent: 'SYNTHETIC-NOT-CODEX' };
  if (message.method === 'skills/list') {
    const skills = fs.readdirSync(path.join(process.env.CODEX_HOME, 'skills')).map(name => ({ name, enabled: true,
      path: path.join(process.env.CODEX_HOME, 'skills', name, 'SKILL.md') }));
    if (mode === 'EXTRA_SKILL') skills.push({ name: 'personal-untrusted', enabled: true, path: 'C:/other-user/SKILL.md' });
    return { data: [{ cwd: process.cwd(), errors: [], skills }] };
  }
  if (message.method === 'thread/start') {
    if (mode === 'ASK_SHELL') send({ id: 'synthetic-forbidden-shell', method: 'item/commandExecution/requestApproval', params: { command: 'synthetic-forbidden' } });
    return { model: 'synthetic-codex-fixture', modelProvider: 'ypcc', cwd: process.cwd(),
      approvalPolicy: 'never', sandbox: { type: 'readOnly' }, thread: { id: syntheticThread }, instructionSources: [] };
  }
  if (message.method === 'mcpServerStatus/list') {
    await mcp('initialize', {}); const listed = await mcp('tools/list');
    const tools = Object.fromEntries(listed.tools.map(t => [t.name, t]));
    if (mode === 'EXTRA_TOOL') tools.forbidden_shell = { name: 'forbidden_shell' };
    return { data: [{ name: 'ypcc', tools, authStatus: 'unsupported' }], nextCursor: null };
  }
  if (message.method === 'turn/start') {
    if (mode === 'REVIEW_NEGATIVE_PROBES' && input.phase.startsWith('REVIEW_')) {
      for (const probe of ['MISSING', 'TAMPERED', 'DETAIL', 'TEXT']) {
        let rejected = false; try { await inference(message.params.input, probe); } catch { rejected = true; }
        if (!rejected) throw new Error('Synthetic forbidden visual request was accepted');
      }
    }
    if (mode !== 'NO_INFERENCE') await inference(message.params.input);
    let output;
    if (input.phase === 'GENERATION_TOOL_PROBE') {
      // Protocol-only probe. The test-only persistence handler records these
      // observations without claiming a production pack or advancing a stage.
      const results = [];
      for (const call of input.calls) {
        if (call.wait_ms) await new Promise(resolve => setTimeout(resolve, call.wait_ms));
        const args = { ...call.arguments };
        if (args.submission_id === '$PREVIOUS') args.submission_id = results.at(-1).submission_id;
        try {
          const result = JSON.parse((await tool(call.tool, args)).content[0].text);
          if (call.expect_error) throw new Error('Synthetic forbidden tool call succeeded');
          results.push(result);
        } catch (error) {
          if (!call.expect_error || error.message === 'Synthetic forbidden tool call succeeded') throw error;
          results.push({ rejected: true });
        }
      }
      output = { results };
      await tool('persist_stage_result', { result: output });
    } else if (input.phase === 'PRODUCTION' || input.phase === 'POST') {
      if (input.phase === 'POST' && input.native_audio) await tool('transcribe_actual_audio', { artifact_id: input.native_audio.source_artifact_id });
      const engine = input.snapshot?.engine ?? input.source?.engine;
      const primary = input.phase === 'PRODUCTION' ? ['PER_SHOT_AI','REFERENCE_FILM'].includes(engine)?'render_generated_pack':'render_photo_pack' : 'execute_post_plan';
      const made = await tool(primary, { snapshot_hash: input.snapshot_hash });
      const data = JSON.parse(made.content[0].text); output = data.stage_result || data;
      if (mode !== 'MEDIA_SKIP_INSPECT') {
        const inspected = await tool('inspect_actual_media', { asset_ids: output.output_asset_ids || output.artifact_ids });
        output.tool_receipt_ids.push(JSON.parse(inspected.content[0].text).tool_receipt_id);
      }
      if (mode === 'MEDIA_MISSING_SLOT') (output.output_asset_ids || output.artifact_ids).pop();
      if (mode === 'MEDIA_WRONG_PROOF') output.tool_receipt_ids = ['not-an-actual-tool-receipt'];
      if (mode !== 'SKIP_PERSIST') await tool('persist_stage_result', { result: output });
      if (mode === 'CHANGED_FINAL') output = { ...output, checkpoint_hash: '0'.repeat(64) };
    } else if (input.phase === 'REFERENCE_IDENTITY') {
      const evidence = JSON.parse((await tool('extract_review_evidence', { packet_hash: input.packet_hash })).content[0].text);
      const verdict = mode === 'REFERENCE_FAIL' ? 'FAIL' : mode === 'REFERENCE_UNCERTAIN' ? 'UNCERTAIN' : 'PASS';
      output = { ...evidence.report_template, verdict, evidence_complete: true, checked_asset_ids: evidence.checked_asset_ids,
        frames: evidence.required_frames.map(frame => ({ asset_id: frame.asset_id, sha256: frame.sha256, verdict,
          anchors: evidence.required_anchors.map(anchor => ({ anchor_id: anchor.anchor_id, verdict,
            source_asset_ids: [...new Set(evidence.source_evidence.filter(e => anchor.evidence_ids.includes(e.evidence_id)).map(e => e.asset_id))],
            detail: 'Synthetic reference observation; not real semantic quality evidence.' })) })), findings: [] };
      if (mode === 'REFERENCE_MISSING_FRAME') output.frames.pop();
      if (mode === 'REFERENCE_MISSING_ANCHOR') output.frames[0].anchors.pop();
      if (mode === 'REFERENCE_WRONG_SOURCE') output.frames[0].anchors[0].source_asset_ids = ['invented-photo'];
      if (mode === 'REFERENCE_FAKE_PASS') output.frames[0].anchors[0].verdict = 'UNCERTAIN';
      if (mode === 'REFERENCE_WRONG_IDENTITY') output.thread_id = 'invented-thread';
      if (mode !== 'SKIP_PERSIST') await tool('persist_stage_result', { result: output });
    } else if (input.phase === 'REVIEW_FACTS' || input.phase === 'REVIEW_STYLE') {
      const evidence = JSON.parse((await tool('extract_review_evidence', { packet_hash: input.packet_hash })).content[0].text);
      output = { ...evidence.report_template, verdict: mode === 'REVIEW_FAIL' ? 'FAIL' : mode === 'REVIEW_INSUFFICIENT' ? 'INSUFFICIENT_EVIDENCE' : 'PASS',
        evidence_complete: mode !== 'REVIEW_INSUFFICIENT', findings: [] };
      if (evidence.report_requirements) output = { ...evidence.report_requirements,
        verdict: mode === 'REVIEW_FAIL' ? 'FAIL' : 'PASS', issues: mode === 'REVIEW_FAIL'
          ? [{ asset_id: evidence.report_requirements.checked_asset_ids[0], code: 'QUALITY', message: 'Synthetic negative review only.' }] : [] };
      if (mode === 'REVIEW_NEGATIVE_PROBES') {
        for (const bad of [{ ...output, thread_id: 'invented-thread' }, { ...output,
          findings: [{ category: 'EVIDENCE', severity: 'MAJOR', evidence_ids: ['invented-evidence'], time_ms: null, detail: 'Synthetic wrong reference' }] }]) {
          let rejected = false; try { await tool('persist_stage_result', { result: bad }); } catch { rejected = true; }
          if (!rejected) throw new Error('Synthetic forged review was accepted');
        }
      }
      if (mode === 'REVIEW_WRONG_IDENTITY') output.thread_id = 'invented-thread';
      if (mode === 'REVIEW_WRONG_EVIDENCE') output.findings = [{ category: 'EVIDENCE', severity: 'MAJOR', evidence_ids: ['invented-evidence'], time_ms: null, detail: 'Synthetic wrong reference' }];
      if (mode !== 'SKIP_PERSIST') await tool('persist_stage_result', { result: output });
      if (mode === 'CHANGED_FINAL') output.verdict = 'FAIL';
    } else {
      await tool('analyze_photos'); await tool('validate_content_plan', { plan: input.suggested_plan });
      if (mode !== 'SKIP_PERSIST') await tool('persist_stage_result', { result: input.suggested_plan });
      output = mode === 'CHANGED_FINAL' ? { ...input.suggested_plan, title: 'Changed after persistence' } : input.suggested_plan;
    }
    send({ method: 'item/completed', params: { threadId: message.params.threadId, item: { type: 'agentMessage', text: JSON.stringify(output) } } });
    send({ method: 'turn/completed', params: { threadId: message.params.threadId, turn: { id: 'synthetic-turn', status: 'completed' } } });
    return { turn: { id: 'synthetic-turn', status: 'inProgress' } };
  }
  if (message.method === 'turn/interrupt') return {};
  throw new Error('Unsupported synthetic method');
}
const lines = readline.createInterface({ input: process.stdin });
lines.on('line', line => {
  const message = JSON.parse(line); if (message.id === undefined || message.id === 'synthetic-forbidden-shell') return;
  if (message.method === 'turn/start') {
    // All role starts acknowledge immediately; bounded tool work is async.
    // app-server.cjs independently exercises completion before the start ACK.
    send({ id: message.id, result: { turn: { id: 'synthetic-turn', status: 'inProgress' } } });
    void dispatch(message).catch(() => send({ method: 'turn/completed', params: {
      threadId: message.params.threadId, turn: { id: 'synthetic-turn', status: 'failed' }
    } }));
    return;
  }
  void dispatch(message).then(result => send({ id: message.id, result }), () => send({ id: message.id, error: { code: -32000, message: 'Synthetic fixture operation failed' } }));
});
lines.on('close', () => { bridge?.stdin.end(); });
