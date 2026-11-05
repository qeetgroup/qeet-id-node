/** Paging parameters of a cursor-paginated list. */
export interface CursorPageParams {
  /** How many items per page. Each list documents its own default and maximum. */
  limit?: number;
  /** Where to start: the `nextCursor` of the previous page. Omit for the first page. */
  cursor?: string;
}

/**
 * A list the API returns whole, in one response. `truncated` is true when the
 * API capped it and more items exist than `data` holds; narrow the request
 * (or use the API's paged list where there is one) to see the rest.
 */
export interface ListResult<T> {
  data: T[];
  truncated: boolean;
}

/** The wire shape of a cursor-paginated response. */
export interface CursorPageResponse<T> {
  items?: T[] | null;
  next_cursor?: string | null;
}

/** The wire shape of a whole-list response. */
export interface ListResponse<T> {
  items?: T[] | null;
  truncated?: boolean;
}

/** Converts a whole-list response to a `ListResult`. Internal. */
export function toListResult<T>(response: ListResponse<T> | undefined): ListResult<T> {
  return { data: response?.items ?? [], truncated: response?.truncated === true };
}

type FetchPage<T> = (cursor: string | undefined) => Promise<CursorPage<T>>;

/**
 * One page of a cursor-paginated list. Iterate it with `for await` to walk
 * every item from this page to the end of the list, fetching later pages as
 * needed; or step through pages with `hasNextPage()` and `getNextPage()`.
 */
export class CursorPage<T> implements AsyncIterable<T> {
  /** The items on this page. */
  readonly data: T[];
  /** The cursor of the next page, or `null` on the last page. */
  readonly nextCursor: string | null;
  readonly #fetchPage: FetchPage<T>;

  constructor(response: CursorPageResponse<T> | undefined, fetchPage: FetchPage<T>) {
    this.data = response?.items ?? [];
    this.nextCursor = response?.next_cursor ? response.next_cursor : null;
    this.#fetchPage = fetchPage;
  }

  /** Whether another page follows this one. */
  hasNextPage(): boolean {
    return this.nextCursor !== null;
  }

  /** Fetches the next page. Throws a `RangeError` on the last page; check `hasNextPage()` first. */
  getNextPage(): Promise<CursorPage<T>> {
    if (this.nextCursor === null) return Promise.reject(new RangeError("This is the last page: there is no next page."));
    return this.#fetchPage(this.nextCursor);
  }

  /** Yields this page and every page after it. */
  async *iterPages(): AsyncGenerator<CursorPage<T>, void, undefined> {
    let page: CursorPage<T> = this;
    for (;;) {
      yield page;
      if (!page.hasNextPage()) return;
      const next = await page.getNextPage();
      // A server that answered the same cursor again would loop forever.
      if (next.nextCursor !== null && next.nextCursor === page.nextCursor) return;
      page = next;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    for await (const page of this.iterPages()) {
      yield* page.data;
    }
  }
}

/**
 * What a paginated list method returns. Await it for the first page, or
 * iterate it with `for await` to walk every item across every page:
 *
 * ```ts
 * const page = await client.users.list({ limit: 50 });
 * for await (const user of client.users.list()) { ... }
 * ```
 *
 * The first request is sent when the promise is first awaited or iterated.
 */
export class PagePromise<T> implements PromiseLike<CursorPage<T>>, AsyncIterable<T> {
  readonly #load: () => Promise<CursorPage<T>>;
  #promise: Promise<CursorPage<T>> | undefined;

  constructor(load: () => Promise<CursorPage<T>>) {
    this.#load = load;
  }

  #first(): Promise<CursorPage<T>> {
    this.#promise ??= this.#load();
    return this.#promise;
  }

  // biome-ignore lint/suspicious/noThenProperty: PagePromise is deliberately awaitable.
  then<R1 = CursorPage<T>, R2 = never>(
    onfulfilled?: ((page: CursorPage<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.#first().then(onfulfilled, onrejected);
  }

  catch<R = never>(onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<CursorPage<T> | R> {
    return this.#first().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<CursorPage<T>> {
    return this.#first().finally(onfinally);
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    const page = await this.#first();
    yield* page;
  }
}
