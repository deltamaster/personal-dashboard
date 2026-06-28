import TableStore from "tablestore";

let client: InstanceType<typeof TableStore.Client> | null = null;

export function getOtsClient(): InstanceType<typeof TableStore.Client> {
  if (client) return client;

  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  const endpoint = process.env.OTS_ENDPOINT;
  const instancename = process.env.OTS_INSTANCE_NAME;

  if (!accessKeyId || !accessKeySecret || !endpoint || !instancename) {
    throw new Error(
      "Missing OTS configuration. Set ALIBABA_CLOUD_ACCESS_KEY_ID, ALIBABA_CLOUD_ACCESS_KEY_SECRET, OTS_ENDPOINT, OTS_INSTANCE_NAME."
    );
  }

  client = new TableStore.Client({
    accessKeyId,
    secretAccessKey: accessKeySecret,
    endpoint,
    instancename,
  });

  return client;
}

type AttributeValue = string | number | boolean | null | undefined;

/** Convert OTS row attributes to a plain object. */
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
