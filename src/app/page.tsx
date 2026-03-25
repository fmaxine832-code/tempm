"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generatePrefix, randomDomain, extractLinks, extractCodes, formatTime } from "@/lib/utils";
import type { Email, ExtractedLink } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";
const POLL_INTERVAL = 3000;

export default function Home() {
  const [domains, setDomains] = useState<string[]>([]);
  const [siteName, setSiteName] = useState("云端接码");
  const [domain, setDomain] = useState("");
  const [prefix, setPrefix] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load config from Worker on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/config`);
        if (res.ok) {
          const data = await res.json();
          const allDomains = [
            ...(data.domains || []),
            ...(data.forwardDomains || []),
          ];
          setDomains(allDomains);
          setSiteName(data.siteName || "云端接码");
          if (allDomains.length > 0) {
            setDomain(randomDomain(allDomains));
          }
        }
      } catch {
        // Worker not available, use fallback
      }
      setPrefix(generatePrefix());
      setConfigLoaded(true);
    };
    loadConfig();
  }, []);

  const address = domain ? `${prefix}@${domain}` : "";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const copyToClipboard = async (text: string, label = "已复制") => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`✅ ${label}`);
    } catch {
      showToast("❌ 复制失败");
    }
  };

  const fetchEmails = useCallback(async () => {
    if (!prefix || !domain) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${WORKER_URL}/api/emails?address=${encodeURIComponent(address)}`
      );
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [address, prefix, domain]);

  // Auto refresh polling
  useEffect(() => {
    if (autoRefresh && prefix && domain) {
      fetchEmails();
      timerRef.current = setInterval(fetchEmails, POLL_INTERVAL);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchEmails, prefix, domain]);

  const refreshAddress = () => {
    setPrefix(generatePrefix());
    if (domains.length > 0) {
      setDomain(randomDomain(domains));
    }
    setEmails([]);
    setExpandedId(null);
  };

  const getLinksForEmail = (email: Email): ExtractedLink[] => {
    return extractLinks(email.html || "");
  };

  const getCodesForEmail = (email: Email): string[] => {
    return extractCodes(email.text || email.html?.replace(/<[^>]*>/g, "") || "");
  };

  // Loading state
  if (!configLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  // No domains configured
  if (domains.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="card text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">尚未配置域名</h2>
          <p className="text-sm text-gray-500 mb-4">
            请先到管理后台添加至少一个域名
          </p>
          <a
            href="/admin"
            className="btn-primary inline-block text-center"
          >
            进入管理后台
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {toast && <div className="toast">{toast}</div>}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--primary)" }}
          >
            ☁️ {siteName}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  autoRefresh ? "bg-green-500 pulse" : "bg-gray-400"
                }`}
              />
              {autoRefresh ? "实时监听中" : "已暂停"}
            </div>
            <a
              href="/admin"
              className="text-gray-400 hover:text-gray-600 text-lg"
              title="管理后台"
            >
              ⚙️
            </a>
          </div>
        </div>

        {/* Domain Selector + Controls */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setEmails([]);
            }}
            className="card px-4 py-2 text-sm font-medium cursor-pointer"
            style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
          >
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <button
            onClick={() => copyToClipboard(address, "邮箱已复制")}
            className="card px-4 py-2 text-sm font-medium cursor-pointer hover:opacity-80"
            style={{
              background: "var(--primary-light)",
              borderColor: "#c8e6c9",
              color: "var(--primary-dark)",
            }}
          >
            📋 全量粘贴
          </button>
        </div>

        {/* Email Address Display */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            className="email-input flex-1"
            value={address}
            onChange={(e) => {
              const val = e.target.value;
              const atIndex = val.indexOf("@");
              if (atIndex > 0) {
                setPrefix(val.substring(0, atIndex));
              } else if (atIndex === -1) {
                setPrefix(val);
              }
            }}
          />
          <button
            className="icon-btn"
            onClick={() => {
              const newPrefix = prompt("输入邮箱前缀:", prefix);
              if (newPrefix) {
                setPrefix(newPrefix);
                setEmails([]);
              }
            }}
            title="编辑"
          >
            ✏️
          </button>
          <button
            className="icon-btn"
            onClick={() => copyToClipboard(address, "邮箱已复制")}
            title="复制"
          >
            📋
          </button>
          <button className="icon-btn" onClick={refreshAddress} title="换一个">
            🔄
          </button>
        </div>

        {/* Fetch Button */}
        <button
          className="btn-primary mb-4 flex items-center justify-center gap-2"
          onClick={fetchEmails}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin">⏳</span> 正在查询...
            </>
          ) : (
            <>🚀 极速拉取验证码</>
          )}
        </button>

        {/* Auto Refresh Toggle */}
        <div className="flex items-center justify-end mb-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 accent-green-600"
            />
            切回秒收
          </label>
        </div>

        {/* Email List */}
        <div>
          {emails.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-4">📭</div>
              <p>暂无邮件</p>
              <p className="text-sm mt-2">
                将 <strong>{address}</strong> 用于注册，邮件会自动出现在这里
              </p>
            </div>
          ) : (
            emails.map((email) => {
              const links = getLinksForEmail(email);
              const codes = getCodesForEmail(email);
              const isExpanded = expandedId === email.id;

              return (
                <div key={email.id} className="email-card">
                  <div
                    onClick={() =>
                      setExpandedId(isExpanded ? null : email.id)
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 truncate">
                          {email.subject || "(无主题)"}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {email.from}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {codes.length > 0 && (
                          <span className="badge">验证码</span>
                        )}
                        {links.length > 0 && (
                          <span className="badge">
                            {links.length} 个链接
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatTime(email.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {/* Verification Codes */}
                      {codes.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-600 mb-2">
                            🔢 验证码
                          </div>
                          {codes.map((code, i) => (
                            <div key={i} className="link-item">
                              <span className="font-mono text-lg font-bold text-green-800">
                                {code}
                              </span>
                              <button
                                className="copy-link-btn"
                                onClick={() =>
                                  copyToClipboard(code, "验证码已复制")
                                }
                              >
                                复制
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Extracted Links */}
                      {links.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-600 mb-2">
                            🔗 邮件中的链接
                          </div>
                          {links.map((link, i) => (
                            <div key={i} className="link-item">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-green-900 truncate">
                                  {link.text}
                                </div>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {link.url}
                                </a>
                              </div>
                              <button
                                className="copy-link-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(link.url, "链接已复制");
                                }}
                              >
                                复制链接
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Raw Email Content */}
                      <details className="mt-3">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                          查看邮件原文
                        </summary>
                        <div
                          className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-60 overflow-auto"
                          dangerouslySetInnerHTML={{
                            __html: email.html || email.text || "",
                          }}
                        />
                      </details>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-12 pb-8">
          临时邮箱 · 邮件到期自动删除 · 请勿用于重要账户
        </div>
      </div>
    </div>
  );
}
