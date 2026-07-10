/**
 * Walks cursor-paginated pages lazily, yielding one item at a time via an
 * async generator — the Node analogue of the Go SDK's
 * `iter.Seq2[T, error]`. Errors propagate as normal thrown/rejected
 * exceptions instead of a `(zero, err)` pair, since that's the idiomatic
 * way to signal failure from a generator.
 *
 *   for await (const user of paginate((cursor) => client.users.list({ ...params, cursor }))) { ... }
 *
 * `fetchPage` returns a page's items and the cursor for the next page
 * (`undefined` when the collection is exhausted). The `next === cursor`
 * guard defends against a server that echoes the same cursor forever.
 */
export async function* paginate<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ data: T[]; nextCursor?: string }>,
  startCursor?: string,
): AsyncGenerator<T, void, void> {
  let cursor = startCursor;
  for (;;) {
    const page = await fetchPage(cursor);
    for (const item of page.data) {
      yield item;
    }
    if (!page.nextCursor || page.nextCursor === cursor) return;
    cursor = page.nextCursor;
  }
}
