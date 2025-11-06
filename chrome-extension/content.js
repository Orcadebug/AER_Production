// Content script to extract page content
(function() {
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ ok: true, hasContent: true });
      return true;
    }
    if (request.action === "extractContent") {
      const content = extractMainContent();
      sendResponse({
        title: document.title,
        url: window.location.href,
        content,
      });
      return true;
    }
    return true;
  });

  function extractMainContent() {
    try {
      // 1) If user has a selection, prefer it
      const sel = window.getSelection && window.getSelection();
      const selected = sel && typeof sel.toString === 'function' ? (sel.toString() || '').trim() : '';
      if (selected && selected.length > 40) {
        return cleanText(selected).slice(0, 20000);
      }

      // 2) Expand common "show more" / "expand" controls within main
      tryExpanders();

      // 2.5) Autoscroll to load virtualized content (fire-and-continue)
      try { autoScrollMain(800, 4).catch(() => {}); } catch {}

      // 3) Site-aware extraction for LLM UIs
      const host = (location.hostname || '').toLowerCase();
      if (/chatgpt|openai\.com/.test(host)) {
        const t = extractChatGPT();
        if (t && t.length > 0) return t.slice(0, 20000);
      }
      if (/perplexity\.ai/.test(host)) {
        const t = extractPerplexity();
        if (t && t.length > 0) return t.slice(0, 20000);
      }
      if (/claude\.ai/.test(host)) {
        const t = extractClaude();
        if (t && t.length > 0) return t.slice(0, 20000);
      }
      if (/gemini\.google\.com|bard\.google\.com|ai\.google\.com\/.+gemini/i.test(host + location.pathname)) {
        const t = extractGemini();
        if (t && t.length > 0) return t.slice(0, 20000);
      }

      // 4) Generic: prefer role=main
      const main = document.querySelector('main, [role="main"]');
      if (main) {
        const txt = main.innerText || main.textContent || '';
        const cleaned = cleanText(txt);
        if (cleaned && cleaned.length > 0) return cleaned.slice(0, 20000);
      }

      // 5) Fallback: whole page text
      const bodyText = (document.body && (document.body.innerText || document.body.textContent)) || '';
      return cleanText(bodyText).slice(0, 20000);
    } catch (e) {
      // Last-resort fallback
      const text = (document.body && (document.body.innerText || document.body.textContent)) || '';
      return (text || '').toString().substring(0, 20000);
    }
  }

  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function tryExpanders() {
    try {
      const container = document.querySelector('main, [role="main"]') || document.body;
      const candidates = Array.from(container.querySelectorAll('button, [role="button"], a'));
      const re = /(show more|read more|expand|see more|view more|continue|load more)/i;
      let clicked = 0;
      for (const el of candidates) {
        if (clicked >= 8) break;
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
        const expanded = el.getAttribute('aria-expanded');
        if (re.test(label) || expanded === 'false') {
          try { el.click(); clicked++; } catch {}
        }
      }
    } catch {}
  }

  function autoScrollMain(step=800, repeats=3) {
    const el = document.querySelector('main, [role="main"], .overflow-y-auto, .scrollable');
    if (!el) return;
    let i = 0;
    const tick = () => {
      el.scrollTop = el.scrollHeight;
      i += 1;
      if (i < repeats) setTimeout(tick, 150);
    };
    setTimeout(tick, 0);
  }

  function extractChatGPT() {
    try {
      const nodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
      if (nodes.length === 0) return '';
      const blocks = [];
      for (const n of nodes) {
        const roleRaw = n.getAttribute('data-message-author-role') || '';
        const role = /user/i.test(roleRaw) ? 'User' : 'Assistant';
        const t = (n.innerText || n.textContent || '').trim();
        if (!t) continue;
        blocks.push(`${role}:\n${t}`);
      }
      return cleanText(blocks.join('\n\n'));
    } catch { return ''; }
  }

  function extractPerplexity() {
    try {
      // Prefer chat messages, else main; include common prose containers
      const msgs = Array.from(document.querySelectorAll('[data-testid*="chat-message"], [data-message-author-role], [data-testid="answer"], div[class*="prose"], article'));
      if (msgs.length > 0) {
        const parts = [];
        for (const m of msgs) {
          const base = (m.innerText || m.textContent || '').trim();
          parts.push(base);
          // Capture open shadow roots within message (if any)
          if (m.shadowRoot) {
            parts.push((m.shadowRoot.innerText || m.shadowRoot.textContent || '').trim());
          }
        }
        const filtered = parts.filter(Boolean);
        if (filtered.length > 0) return cleanText(filtered.join('\n\n'));
      }
      // Deep capture for open shadow roots under main
      const main = document.querySelector('main, [role="main"]') || document.body;
      const mainText = (main.innerText || main.textContent || '');
      let shadowText = '';
      main.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && (el.shadowRoot.innerText || el.shadowRoot.textContent)) {
          shadowText += '\n' + (el.shadowRoot.innerText || el.shadowRoot.textContent);
        }
      });
      return cleanText((mainText + '\n' + shadowText).trim());
    } catch { return ''; }
  }

  function extractClaude() {
    try {
      const msgs = Array.from(document.querySelectorAll('[data-testid="message-bubble"], [data-testid*="message"], article'));
      if (msgs.length > 0) {
        const parts = msgs.map((m) => (m.innerText || m.textContent || '').trim()).filter(Boolean);
        if (parts.length > 0) return cleanText(parts.join('\n\n'));
      }
      const main = document.querySelector('main, [role="main"]');
      const txt = main ? (main.innerText || main.textContent || '') : '';
      return cleanText(txt);
    } catch { return ''; }
  }

  function extractGemini() {
    try {
      // Prefer explicit chat message containers
      const selectors = [
        '[aria-live="polite"]',
        '[role="listitem"]',
        'article',
        'div[class*="prose"]',
        'md-content',
        'mat-mdc-list'
      ];
      let nodes = [];
      selectors.forEach(sel => nodes.push(...Array.from(document.querySelectorAll(sel))));
      const parts = [];
      nodes.forEach((n) => {
        const base = (n.innerText || n.textContent || '').trim();
        if (base) parts.push(base);
        // open shadow roots inside these nodes
        if (n.shadowRoot) {
          const sr = (n.shadowRoot.innerText || n.shadowRoot.textContent || '').trim();
          if (sr) parts.push(sr);
        }
      });
      // Scan main for open shadow roots as well
      const main = document.querySelector('main, [role="main"]') || document.body;
      main.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) {
          const sr = (el.shadowRoot.innerText || el.shadowRoot.textContent || '').trim();
          if (sr) parts.push(sr);
        }
      });
      const text = parts.filter(Boolean).join('\n\n');
      if (text && text.length > 0) return cleanText(text);
      // Fallback: main area
      const txt = (main.innerText || main.textContent || '').trim();
      return cleanText(txt);
    } catch { return ''; }
  }
})();
