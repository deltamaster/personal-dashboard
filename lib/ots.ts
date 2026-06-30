import TableStore from "tablestore";
import { getAlibabaCredentials, type AlibabaCredentials } from "@/lib/alibaba-credentials";

let cachedClient: {
  key: string;
  client: InstanceType<typeof TableStore.Client>;
} | null = null;

function clientCacheKey(creds: AlibabaCredentials, endpoint: string, instancename: string): string {
  return [
    creds.accessKeyId,
    creds.securityToken ?? "",
    creds.expiration?.toISOString() ?? "",
    endpoint,
    instancename,
  ].join("|");
}

export async function getOtsClient(): Promise<InstanceType<typeof TableStore.Client>> {
  const endpoint = process.env.OTS_ENDPOINT;
  const instancename = process.env.OTS_INSTANCE_NAME;

  if (!endpoint || !instancename) {
    throw new Error("Missing OTS configuration. Set OTS_ENDPOINT and OTS_INSTANCE_NAME.");
  }

  const creds = await getAlibabaCredentials();
  const key = clientCacheKey(creds, endpoint, instancename);
  if (cachedClient?.key === key) {
    return cachedClient.client;
  }

  const client = new TableStore.Client({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.accessKeySecret,
    stsToken: creds.securityToken,
    endpoint,
    instancename,
  });

  cachedClient = { key, client };
  return client;
}

type AttributeValue = string | number | boolean | null | undefined;

/** OTS may return Long or string for numeric columns — coerce safely. */
export function coerceOtsNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isNaN(n) ? undefined : n;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** Convert GetRange nextStartPrimaryKey to inclusiveStartPrimaryKey format. */
export function nextStartPrimaryKey(
  next: { name: string; value: unknown }[]
): Record<string, unknown>[] {
  const key: Record<string, unknown> = {};
  for (const item of next) {
    key[item.name] = item.value;
  }
  return [key];
}

export function rowToObject(row: {
  primaryKey?: { name: string; value: unknown }[];
  attributes?: { columnName: string; columnValue: unknown }[];
}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const pk of row.primaryKey ?? []) {
    result[pk.name] = pk.value;
  }
  for (const attr of row.attributes ?? []) {
    result[attr.columnName] = attr.columnValue;
  }
  return result;
}

/** Build OTS attribute columns, skipping undefined/null. */
export function toAttributeColumns(
  data: Record<string, AttributeValue>
): [string, AttributeValue][] {
  return Object.entries(data).filter(([, v]) => v !== undefined && v !== null) as [string, AttributeValue][];
}

export { TableStore };
