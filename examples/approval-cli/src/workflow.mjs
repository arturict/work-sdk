export async function runApprovalWorkflow({ work, itemId, update, idempotencyKey, approve, output = console }) {
  const change = await work.prepareUpdate(itemId, update);

  output.log("\nPrepared change — nothing has been written yet");
  output.log(change.summary);
  output.table(change.changes);
  if (change.warnings.length) {
    output.warn("Provider warnings:");
    output.table(change.warnings);
  }

  if (!await approve(change)) {
    output.log("Canceled. The provider was not mutated.");
    return { status: "canceled", change };
  }

  const receipt = await work.commit(change, {
    idempotencyKey,
    acceptWarnings: change.warnings.length > 0,
  });
  output.log(`Committed ${receipt.item.identifier} at revision ${receipt.item.revision}.`);
  return { status: "committed", change, receipt };
}
