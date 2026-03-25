// Generate a random email prefix
export function generatePrefix(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Pick a random domain from the list
export function randomDomain(domains: string[]): string {
  return domains[Math.floor(Math.random() * domains.length)];
}

// Extract links from HTML email body
export function extractLinks(html: string): { text: string; url: string }[] {
  const links: { text: string; url: string }[] = [];
  // Match <a> tags with href
  const regex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    // Strip HTML tags from link text
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    // Skip mailto, tel, and anchor links
    if (
      url &&
      !url.startsWith("mailto:") &&
      !url.startsWith("tel:") &&
      !url.startsWith("#")
    ) {
      links.push({ text: text || url, url });
    }
  }
  return links;
}

// Extract verification codes from text
export function extractCodes(text: string): string[] {
  const codes: string[] = [];
  // Match 4-8 digit codes
  const patterns = [
    /验证码[是为：:\s]*(\d{4,8})/g,
    /code[:\s]*(\d{4,8})/gi,
    /verification[:\s]*(\d{4,8})/gi,
    /(?:^|\s)(\d{4,8})(?:\s|$|[，。,.])/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (!codes.includes(match[1])) {
        codes.push(match[1]);
      }
    }
  }
  return codes;
}

// Format date
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
