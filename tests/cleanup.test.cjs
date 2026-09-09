// Run: node --test tests/cleanup.test.cjs (no credentials or live writes).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((name) => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const id = '12345678-1234-4321-9876-123456789abc';
function endpoint({ authorized = true, result = { data: { id }, error: null } } = {}) {
  const calls = [];
  const query = {};
  for (const name of ['delete', 'eq', 'select']) query[name] = (...args) => { calls.push([name, ...args]); return query; };
  query.maybeSingle = async () => result;
  const db = { from: (table) => { calls.push(['from', table]); return query; } };
  const { POST } = load('app/api/control/action/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/brain/control-auth.server': { getControlAdmin: async () => authorized ? { supabase: db } : null },
  });
  return { calls, send: (body) => POST(new Request('http://localhost/api/control/action', { method: 'POST', body: JSON.stringify(body) })) };
}
test('conversation deletion requires an authorized administrator', async () => {
  const e = endpoint({ authorized: false });
  assert.equal((await e.send({ action: 'delete-conversation', id, confirm: true })).status, 401);
  assert.deepEqual(e.calls, []);
});
test('missing confirmation and malformed IDs cannot reach the database', async () => {
  for (const payload of [{ id }, { id, confirm: 'true' }, { id: '*', confirm: true }, { id: null, confirm: true }]) {
    const e = endpoint();
    assert.equal((await e.send({ action: 'delete-conversation', ...payload })).status, 400);
    assert.deepEqual(e.calls, []);
  }
});
test('delete targets one parent record, never shared people or arbitrary children', async () => {
  const e = endpoint();
  const response = await e.send({ action: 'delete-conversation', id, confirm: true, personId: 'do-not-touch' });
  assert.equal(response.status, 200);
  assert.deepEqual(e.calls, [['from', 'message_conversations'], ['delete'], ['eq', 'id', id], ['select', 'id']]);
  assert.deepEqual(await response.json(), { ok: true, id });
});
test('delete does not report success for missing records or database failures', async () => {
  const missing = endpoint({ result: { data: null, error: null } });
  assert.equal((await missing.send({ action: 'delete-conversation', id, confirm: true })).status, 404);
  const failed = endpoint({ result: { data: null, error: new Error('database refused') } });
  assert.equal((await failed.send({ action: 'delete-conversation', id, confirm: true })).status, 400);
});
test('existing schema scopes cascades to conversation messages and their citations', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260904100000_control_photos_messages_v1.sql'), 'utf8');
  assert.match(sql, /conversation_id uuid not null references public\.message_conversations\(id\) on delete cascade/);
  assert.match(sql, /message_id uuid not null references public\.conversation_messages\(id\) on delete cascade/);
  assert.match(sql, /person_entity_id uuid references public\.entities\(id\) on delete set null/);
});
test('empty live Messages and failed reads never resurrect bundled drafts', async () => {
  const previous = process.env.BRAIN_DATA_SOURCE;
  process.env.BRAIN_DATA_SOURCE = 'supabase';
  try {
    for (const error of [null, new Error('offline')]) {
      const { getMessages } = load('lib/brain/messages.server.ts', {
        'server-only': {}, '@/data/messages': { groundedConversations: [{ slug: 'old-draft' }] },
        './public-supabase.server': { publicBrainClient: () => ({ from: () => ({ select: () => ({ order: async () => ({ data: [], error }) }) }) }) },
      });
      if (error) await assert.rejects(getMessages);
      else assert.deepEqual(await getMessages(), []);
    }
  } finally {
    if (previous === undefined) delete process.env.BRAIN_DATA_SOURCE;
    else process.env.BRAIN_DATA_SOURCE = previous;
  }
});
const { messageParagraphs } = load('lib/message-paragraphs.ts');
test('explicit paragraphs and internal line breaks survive presentation', () => {
  assert.deepEqual(messageParagraphs('First line\nSecond line\n\nNext paragraph'), ['First line\nSecond line', 'Next paragraph']);
  assert.deepEqual(messageParagraphs('One\r\n\r\nTwo\r\nline'), ['One', 'Two\nline']);
  assert.deepEqual(messageParagraphs('One\n \t\nTwo'), ['One', 'Two']);
  assert.deepEqual(messageParagraphs('One\rTwo'), ['One\nTwo']);
});
test('long unformatted drafts retain their words while receiving existing readability breaks', () => {
  const body = ('A long sentence with some words. ').repeat(50).trim();
  const paragraphs = messageParagraphs(body);
  assert.ok(paragraphs.length > 1);
  assert.equal(paragraphs.join(' '), body);
  assert.deepEqual(messageParagraphs('<script>plain text</script>'), ['<script>plain text</script>']);
});

test('saving Messages preserves local book citations and each surviving source kind', async () => {
  const inserted = [];
  const db = { from: (table) => ({
    upsert: async () => ({ error: null }),
    select: () => ({ eq: async () => ({ data: [], error: null }) }),
    delete: () => ({ eq: async () => ({ error: null }) }),
    insert: async (rows) => { inserted.push({ table, rows }); return { error: null }; },
  }) };
  const { POST } = load('app/api/control/action/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/brain/control-auth.server': { getControlAdmin: async () => ({ supabase: db, user: { id: 'admin' } }) },
  });
  const response = await POST(new Request('http://localhost/api/control/action', { method: 'POST', body: JSON.stringify({
    action: 'save-conversation', item: { id, personName: 'Test', slug: 'test', messages: [
      { speakerRole: 'joe', body: 'Question' },
      { speakerRole: 'guest', body: 'First paragraph\n\nSecond paragraph', sources: [
        { label: 'Unsafe', url: 'javascript:alert(1)', kind: 'article' },
        { label: 'Book', url: '/library/test-book', kind: 'book' },
        { label: 'Interview', url: 'https://example.com/interview', kind: 'interview' },
        { label: 'Protocol relative', url: '//example.com', kind: 'article' },
        { label: 'Backslash', url: '/\\example.com', kind: 'article' },
      ] },
    ] },
  }) }));
  assert.equal(response.status, 200);
  const sources = inserted.find(row => row.table === 'conversation_message_sources').rows;
  assert.deepEqual(sources.map(({ url, source_kind }) => [url, source_kind]), [
    ['/library/test-book', 'book'], ['https://example.com/interview', 'interview'],
  ]);
  assert.equal(inserted.filter(row => row.table === 'conversation_messages')[1].rows.body, 'First paragraph\n\nSecond paragraph');
});
