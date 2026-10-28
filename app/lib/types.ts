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

export interface ShortEntry {
  id: string;
  date: string;
  html: string;
  link: string | null;
  linkTitle: string | null;
  linkHost: string | null;
  preview: {
    title: string | null;
    description: string | null;
    image: string | null;
  } | null;
}
