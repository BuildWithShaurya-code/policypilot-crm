/** Read every database page rather than silently accepting its default row cap. */
export async function readAllPages<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const records: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await load(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data || [];
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}
