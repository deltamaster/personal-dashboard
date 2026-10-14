export interface Song {
  id: string;
  name: string;
  singers: string[];
  status: "OK" | "HIDDEN";
}

export interface SongInput {
  name?: string;
  singers?: string[] | string;
  singer?: string;
  id?: string;
  status?: string;
}
