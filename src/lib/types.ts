export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  timestamp: number;
}

export interface ExtractedLink {
  text: string;
  url: string;
}
