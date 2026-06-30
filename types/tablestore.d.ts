declare module "tablestore" {
  const TableStore: {
    Client: new (config: {
      accessKeyId: string;
      secretAccessKey: string;
      stsToken?: string;
      endpoint: string;
      instancename: string;
    }) => {
      getRange: (params: Record<string, unknown>, callback: (err: Error | null, data: unknown) => void) => void;
      getRow: (params: Record<string, unknown>, callback: (err: Error | null, data: unknown) => void) => void;
      putRow: (params: Record<string, unknown>, callback: (err: Error | null, data: unknown) => void) => void;
    };
    Direction: { FORWARD: string; BACKWARD: string };
    INF_MIN: unknown;
    INF_MAX: unknown;
    Condition: new (expectation: unknown, column: unknown) => unknown;
    RowExistenceExpectation: { IGNORE: unknown; EXPECT_EXIST: unknown; EXPECT_NOT_EXIST: unknown };
  };
  export = TableStore;
}
