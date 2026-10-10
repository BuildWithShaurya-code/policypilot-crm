/** Read an API response and surface failures instead of displaying empty records. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

/** Retrieve every page from the customer/policy list APIs. */
export async function fetchAllRecords<T>(url: string): Promise<T[]> {
  const records: T[] = [];
  const pageSize = 500;
  for (let page = 1; ; page++) {
    const result = await readApiResponse<{ data: T[]; count: number }>(
      await fetch(`${url}?page=${page}&pageSize=${pageSize}`)
    );
    if (!Array.isArray(result.data)) throw new Error('Invalid list response');
    records.push(...result.data);
    if (records.length >= result.count || result.data.length < pageSize) return records;
  }
}
