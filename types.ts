export interface PostedItem {
  id: string; // url can be id
  title: string;
  url: string;
  postedUrl: string; // The URL of the Reddit post
  postedAt: number; // Timestamp of when it was posted
}

export interface FetchedArticle {
  id: string; // Use URL as ID
  title: string;
  link: string;
  sourceName: string;
  pubDate: string;
  description: string;
}

export interface Flair {
  id:string;
  text: string;
  type: 'text' | 'richtext';
  text_color: 'dark' | 'light';
  background_color: string;
  css_class: string | null;
}

export interface RedditAuth {
  clientId: string;
  clientSecret: string;
  username: string;
  password?: string;
  token: string | null;
}

export interface AutomationSettings {
  targetSubreddit: string;
  checkInterval: number; // in minutes
  postLimit: number;
  defaultFlairId: string;
  rssFeedUrls: string; // Comma or newline separated
  includeKeywords: string; // Required keywords, one per line
  excludeKeywords: string; // Excluded keywords, one per line
  sourceAuthorityScores: string; // Domains and their scores
  minimumScore: number;
  useProactiveDuplicateCheck: boolean;
  useAdaptiveLearning: boolean;
}

export type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface ScoreDetails {
  base: number;
  titleBoost: number;
  recency: number;
  sourceAuthority: number;
  learnedBias: number;
  total: number;
}