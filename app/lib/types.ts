export interface PostSummary {
  title: string;
  slug: string;
  date: string;
  updated: string | null;
  description: string;
  tags: string[];
  folder: string;
  sourcePath: string;
  readingMinutes: number;
}

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}
export interface Article extends PostSummary {
  html: string;
  toc: TocEntry[];
}
export interface Catalog {
  posts: PostSummary[];
  folders: string[];
  tags: string[];
  sample: boolean;
  revision: string | null;
}
export interface SearchEntry extends PostSummary {
  text: string;
}
