export async function runWithDatabaseRecovery(
  operation: () => Promise<void>,
  resetConnection: () => Promise<void>
): Promise<void> {
  try {
    await operation();
  } catch {
    await resetConnection();
    await operation();
  }
}

export async function addColumnIfMissing(
  loadColumns: () => Promise<ReadonlyArray<{ name: string }>>,
  columnName: string,
  addColumn: () => Promise<void>
): Promise<void> {
  const columns = await loadColumns();
  if (columns.some((column) => column.name === columnName)) return;
  await addColumn();
}
