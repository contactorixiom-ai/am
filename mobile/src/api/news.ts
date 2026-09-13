import { apiFetch } from './client';

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  category?: { slug: string; name: string } | null;
  author?: { firstName: string; lastName: string } | null;
}

export async function listNews(): Promise<{ data: NewsArticle[] }> {
  return apiFetch<{ data: NewsArticle[] }>('/news', { skipAuth: true });
}
