import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkspace, inspectWorkspaceStructure, sliceWorkspace } from '../app/lib/recovery-stream.ts';

const bytes = (text, size = 7) => {
  const encoded = new TextEncoder().encode(text); let i = 0;
  return new ReadableStream({ pull(c) { if (i >= encoded.length) return c.close(); c.enqueue(encoded.slice(i, i += size)); } });
};

test('indexes only live POGs and preserves exact exported data across chunk boundaries', async () => {
  const plans = [
    { id: 'a', title: 'Utz "Chips" 🥨 \\ shelf', products: [{ id: 1, image: 'data:image/png;base64,' + 'x'.repeat(19000) }, { image: '', name: 'é' }], sections: [{ title: 'Not a POG', placements: [] }] },
    { title: 'Second', id: 'b', products: [{ image: '/api/images?key=abc', enabled: true, n: null }] },
  ];
  const json = JSON.stringify({ versions: [{ planogram: plans[0] }], planograms: plans, trash: [{ planogram: plans[1] }] });
  for (const size of [1, 7, 16384]) {
    const result = await inspectWorkspace(bytes(json, size));
    assert.deepEqual(result.map(p => [p.title, p.productCount, p.imageCount]), [[plans[0].title, 2, 1], ['Second', 1, 1]]);
    for (let i = 0; i < result.length; i++) {
      const p = result[i];
      const exported = await new Response(sliceWorkspace(bytes(json, size), p.start, p.end, '{"planogram":', '}')).json();
      assert.deepEqual(exported.planogram, plans[i]);
      const catalog = await new Response(sliceWorkspace(bytes(json, size), p.productsStart, p.productsEnd)).json();
      assert.deepEqual(catalog, plans[i].products);
    }
  }
});

test('large image payload is scanned without retaining the full workspace', async () => {
  const encoder = new TextEncoder(), payload = encoder.encode('a'.repeat(256 * 1024)); let part = 0;
  const body = new ReadableStream({ pull(c) {
    if (part === 0) c.enqueue(encoder.encode('{"planograms":[{"id":"large","title":"Large library","products":[{"image":"'));
    else if (part <= 1024) c.enqueue(payload);
    else if (part === 1025) c.enqueue(encoder.encode('"}]}]}'));
    else c.close();
    part++;
  } });
  const result = await inspectWorkspace(body);
  assert.equal(result.length, 1); assert.equal(result[0].imageCount, 1); assert.equal(result[0].productCount, 1);
});

test('truncated copies fail without presenting an empty recovered list', async () => {
  await assert.rejects(inspectWorkspace(bytes('{"planograms":[{"title":"unfinished')), /Incomplete workspace/);
});

test('can stop after a requested POG index without scanning the full workspace', async () => {
  const json = JSON.stringify({
    activeId: 'b',
    planograms: [
      { id: 'a', title: 'First', products: [{ image: 'x' }], sections: [] },
      { id: 'b', title: 'Second', products: [{ image: 'y' }], sections: [{ shelves: [] }] },
      { id: 'c', title: 'Third', products: [{ image: 'z'.repeat(50000) }], sections: [] },
    ],
  });
  const structure = await inspectWorkspaceStructure(bytes(json, 3), { stopAfterPlanIndex: 1 });
  assert.equal(structure.activeId, 'b');
  assert.equal(structure.plans.length, 2);
  assert.equal(structure.plans[1].id, 'b');
  assert.equal(structure.plans.some((plan) => plan.id === 'c'), false);
  const exported = await new Response(
    sliceWorkspace(bytes(json, 5), structure.plans[1].start, structure.plans[1].end),
  ).json();
  assert.equal(exported.id, 'b');
});
