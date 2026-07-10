/** Per-call options accepted as the final argument of every resource method — currently just cancellation, the Node analogue of Go's `context.Context`. */
export interface RequestOpts {
  signal?: AbortSignal;
}
