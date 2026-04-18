// Pre-request — stamp an idempotency key header before the call leaves.
pm.request.headers.upsert({
  key: 'X-Idempotency-Key',
  value: crypto.randomUUID(),
});
