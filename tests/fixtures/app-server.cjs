// Explicit protocol fixture. No model, credential, shell or external service.
const readline = require('node:readline');
const lines = readline.createInterface({ input: process.stdin });
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
if (process.argv.includes('--oversized-line')) process.stdout.write(' '.repeat(4000001));
lines.on('line', line => {
  const m = JSON.parse(line);
  if (m.method === 'initialize') send({ id: m.id, result: { userAgent: 'synthetic-fixture' } });
  else if (m.method === 'thread/start') send({ id: m.id, result: { thread: { id: 'fixture-thread' } } });
  else if (m.method === 'turn/start') {
    // Exercise the race in which completion notifications precede start reply.
    send({ method: 'item/completed', params: { threadId: m.params.threadId, item: { type: 'agentMessage', text: '{"accepted":true}' } } });
    send({ method: 'turn/completed', params: { threadId: m.params.threadId, turn: { id: 'fixture-turn', status: 'completed' } } });
    send({ id: m.id, result: { turn: { id: 'fixture-turn', status: 'inProgress' } } });
  } else if (m.method === 'test/request-approval') {
    send({ id: 'server-request-1', method: 'item/commandExecution/requestApproval', params: { command: 'forbidden' } });
    send({ id: m.id, result: {} });
  } else if (m.id === 'server-request-1') send({ method: 'test/approval-answer', params: m.result });
});
