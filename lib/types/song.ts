export interface Song {
  id: string;
  name: string;
  singers: string[];
  /** Empty means public. `hidden` and `learning` stay off the public page. */
  tags: string[];
}

export interface SongInput {
  name?: string;
  singers?: string[] | string;
  singer?: string;
  id?: string;
  tags?: string[] | string;
  tag?: string;
  status?: string;
}
