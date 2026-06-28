import { getOtsClient, TableStore } from "@/lib/ots";

type CallbackFn = (err: Error | null, data?: unknown) => void;

export function otsCall<T>(
  fn: (params: Record<string, unknown>, callback: CallbackFn) => void,
  params: Record<string, unknown>
): Promise<T> {
  const client = getOtsClient();
  return new Promise((resolve, reject) => {
    fn.call(client, params, (err, data) => {
      if (err) reject(err);
      else resolve(data as T);
    });
  });
}

export { TableStore };
