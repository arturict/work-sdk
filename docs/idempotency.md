# Atomic idempotency stores

Work SDK v0.4 uses an atomic claim protocol. A durable store is not safe merely
because its values survive restarts: two workers must not both observe a
missing key and then write to the provider.

## State machine

```text
missing --acquire--> in-flight --complete--> completed
                           |
                           +--abandon(retryable)--> missing
                           |
                           `--abandon(ambiguous)--> ambiguous
```

- `completed` returns its stored receipt with `replayed: true`.
- a different intent fingerprint returns `conflict`.
- an active claim returns `in-flight`.
- an uncertain provider outcome returns `ambiguous` until application
  reconciliation resolves it.

## Contract

```ts
interface IdempotencyStore {
  acquire(
    key: string,
    intentFingerprint: string,
  ): MaybePromise<
    | { status: "acquired"; leaseId: string }
    | { status: "completed"; result: CommitResult }
    | { status: "in-flight" }
    | { status: "ambiguous" }
    | { status: "conflict" }
  >;

  complete(
    key: string,
    leaseId: string,
    result: CommitResult,
  ): MaybePromise<void>;

  abandon(
    key: string,
    leaseId: string,
    outcome: "retryable" | "ambiguous",
  ): MaybePromise<void>;
}
```

`acquire` must use one atomic database operation or transaction. Suitable
primitives include a unique insert, compare-and-swap, row lock, or conditional
put. A separate `get` followed by `set` is not sufficient.

`complete` must verify that the supplied lease is still active. `abandon` with
`retryable` deletes or releases only that lease. `abandon` with `ambiguous`
preserves the intent binding and blocks another mutation.

## Error policy

`WorkInFlightError` is retryable after the current owner finishes or a
store-specific lease expires. Reuse the same business key.

`WorkAmbiguousCommitError` is not retryable. Query the provider using the
business event, target, timestamp, or returned receipt details. After
reconciliation, resolve the durable record according to application policy.

Failures during the client's read-only preflight release the claim. Once an
adapter mutation has been invoked, every thrown outcome is treated as
ambiguous. This conservative rule also covers multi-step adapters where a
provider may create or update an item before a later transition or readback
fails.

## Store requirements

- namespace keys by environment and business event;
- bind one key to one intent fingerprint forever;
- encrypt or limit access to receipts if work-item content is sensitive;
- retain completed receipts for at least the provider retry window;
- record timestamps, lease owner, and reconciliation audit data;
- test two independent clients against the same store;
- test a lost response after a provider-side success.

The bundled `MemoryIdempotencyStore` implements the protocol for one process.
It is deterministic and useful for tests, CLIs, and examples, but it is not a
distributed database.
