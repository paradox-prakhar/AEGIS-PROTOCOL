/**
 * Local scam-signal rules for messages, links, phone numbers and UPI IDs.
 *
 * Everything here runs in the browser — nothing the user pastes is uploaded.
 * These are transparent pattern rules, NOT a threat-intelligence lookup: a
 * "low risk" result only means none of these known warning signs matched.
 *
 * Each finding: { tone: 'danger' | 'warning' | 'info', text }
 * Verdict:      { verdict: 'safe' | 'suspicious' | 'dangerous', findings, checks }
 */

// ---------------------------------------------------------------- helpers ---

const has = (text, re) => re.test(text);
const finding = (tone, text) => ({ tone, text });

export function verdictFrom(findings) {
  if (findings.some((f) => f.tone === 'danger')) return 'dangerous';
  if (findings.some((f) => f.tone === 'warning')) return 'suspicious';
  return 'safe';
}

// ------------------------------------------------------------------ links ---

/** Official domains for brands that are commonly impersonated in India. */
const BRANDS = {
  sbi: ['sbi.co.in', 'onlinesbi.sbi', 'sbi.bank.in', 'onlinesbi.com'],
  hdfc: ['hdfcbank.com', 'hdfc.bank.in'],
  icici: ['icicibank.com', 'icici.bank.in'],
  axis: ['axisbank.com', 'axis.bank.in'],
  kotak: ['kotak.com', 'kotak.bank.in'],
  paytm: ['paytm.com'],
  phonepe: ['phonepe.com'],
  amazon: ['amazon.in', 'amazon.com'],
  flipkart: ['flipkart.com'],
  irctc: ['irctc.co.in'],
  uidai: ['uidai.gov.in'],
  aadhaar: ['uidai.gov.in'],
  incometax: ['incometax.gov.in'],
  epfo: ['epfindia.gov.in'],
  indiapost: ['indiapost.gov.in'],
  npci: ['npci.org.in'],
  whatsapp: ['whatsapp.com'],
};

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rb.gy', 'is.gd', 'shorturl.at', 'tiny.cc', 'goo.su', 'rebrand.ly', 'ow.ly', 's.id'];
const RISKY_TLDS = ['xyz', 'top', 'click', 'zip', 'mov', 'icu', 'buzz', 'rest', 'cfd', 'sbs', 'monster', 'quest', 'live', 'shop', 'online', 'site', 'info', 'vip', 'cyou'];
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|xyz|top|click|zip|mov|icu|buzz|live|shop|online|site|info|vip|co|me|ly|gl|ru|cn)(?:\/[^\s<>"']*)?)/gi;

const endsWithDomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);

export function extractUrls(text) {
  return [...new Set((text.match(URL_RE) || []).map((u) => u.replace(/[).,!?]+$/, '')))];
}

export function checkLink(raw) {
  const input = raw.trim();
  const findings = [];
  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { verdict: 'suspicious', host: input, findings: [finding('warning', 'This does not look like a valid web address.')], checks: 1 };
  }
  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  const tld = labels.at(-1);

  if (url.username || url.password || input.includes('@')) {
    findings.push(finding('danger', 'The link hides its real destination using an “@” sign — a classic phishing trick.'));
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    findings.push(finding('danger', 'The link points to a raw IP address instead of a named website.'));
  }
  if (labels.some((l) => l.startsWith('xn--'))) {
    findings.push(finding('danger', 'The address uses look-alike characters (punycode) that can imitate a real brand.'));
  }
  for (const [brand, official] of Object.entries(BRANDS)) {
    const mentions = host.replace(/[-.]/g, '').includes(brand);
    const isOfficial = official.some((d) => endsWithDomain(host, d));
    if (mentions && !isOfficial) {
      findings.push(finding('danger', `Mentions “${brand.toUpperCase()}” but is not one of its official websites (${official[0]}).`));
      break;
    }
  }
  if (SHORTENERS.some((d) => endsWithDomain(host, d))) {
    findings.push(finding('warning', 'Shortened link — the real destination is hidden until you open it.'));
  }
  if (RISKY_TLDS.includes(tld)) {
    findings.push(finding('warning', `Ends in “.${tld}”, a domain ending often used by short-lived scam sites.`));
  }
  if (/\.apk(\?|$)/i.test(url.pathname)) {
    findings.push(finding('danger', 'This link downloads an Android app (.apk) from outside the Play Store. Apps like this can read your SMS and OTPs.'));
  }
  if (labels.length > 4 || (host.match(/-/g) || []).length >= 3) {
    findings.push(finding('warning', 'Unusually long or hyphenated web address — often used to imitate real sites.'));
  }
  if (url.protocol === 'http:') {
    findings.push(finding('warning', 'The link is not secure (http, not https).'));
  }
  if (/(login|verify|kyc|update|secure|account|reward|refund|claim)/i.test(url.pathname + url.search) && findings.length) {
    findings.push(finding('warning', 'Asks you to log in, verify or claim something — be careful entering any details.'));
  }
  if (!findings.length && host.endsWith('.gov.in')) {
    findings.push(finding('info', 'This is a government of India (.gov.in) domain.'));
  }
  return { verdict: verdictFrom(findings), host, findings, checks: 9 };
}

// --------------------------------------------------------------- messages ---

const RULES = [
  [/\b(otp|one[\s-]?time[\s-]?password|pin|cvv|upi\s*pin|mpin)\b/i, /\b(share|send|tell|give|forward|enter|provide)\b/i,
    'danger', 'Asks you to share an OTP, PIN or CVV. Banks, police and real companies never ask for these.'],
  [/\b(anydesk|teamviewer|quick\s?support|rustdesk|airdroid|screen\s?share)\b/i, null,
    'danger', 'Asks you to install a remote-access app. This lets someone control your phone or computer.'],
  [/\b(digital\s+arrest|arrest\s+warrant|cbi|narcotics|ncb|customs|money\s+laundering|ed\s+officer|cyber\s+cell|trai)\b/i, null,
    'danger', 'Claims to be police, CBI, customs or a regulator. Real officers never “arrest” people over a call or ask for money to settle a case.'],
  [/\b(guaranteed|assured|fixed)\s+(returns?|profit)|double\s+your\s+money|\d+\s?%\s*(daily|per\s+day|weekly)|\b(trading|crypto|ipo)\s+tips?\b/i, null,
    'danger', 'Promises guaranteed or very high investment returns — a hallmark of investment scams.'],
  [/\b(scan|qr)\b.*\b(receive|get|credit)\b|\b(receive|get)\b.*\b(scan|qr)\b/i, null,
    'danger', 'Asks you to scan a QR code or enter your PIN to receive money. You never need a PIN or QR scan to receive money.'],
  [/\b(kyc|pan|aadhaar)\b.*\b(expire[sd]?|update|block(ed)?|suspend(ed)?|deactivat)|\b(account|card|sim|connection|electricity)\b.*\b(block(ed)?|suspend(ed)?|deactivat\w*|disconnect\w*)\b/i, null,
    'warning', 'Threatens that your account, card, SIM or electricity will be blocked. Scammers use fear to rush you.'],
  [/\b(urgent(ly)?|immediately|within\s+\d+\s*(hours?|hrs|minutes?|mins)|last\s+(warning|chance|reminder)|act\s+now|today\s+only)\b/i, null,
    'warning', 'Uses urgency (“immediately”, “last warning”) to stop you from thinking it through.'],
  [/\b(won|winner|lottery|lucky\s+draw|prize|jackpot|cashback|gift\s+card|reward\s+points?)\b/i, null,
    'warning', 'Talks about a prize, lottery or reward you did not enter for.'],
  [/\b(work\s+from\s+home|part[\s-]time\s+job|like\s+(and\s+)?subscribe|rate\s+(hotels?|products?)|earn\s+(rs\.?|₹|inr)?\s?\d+|daily\s+income|task\s+based)\b/i, null,
    'warning', 'Offers easy money for simple online tasks — task and job scams start this way and later ask for a “deposit”.'],
  [/\b(refund|electricity\s+bill|customer\s+care|helpline|courier|parcel|fedex|dhl|bluedart)\b/i, /\b(call|click|link|pay|charges?|fee|number)\b/i,
    'warning', 'Mentions a refund, bill, parcel or customer care and asks you to call, click or pay.'],
  [/\b(pay|transfer|send)\b.*\b(rs\.?|₹|inr|upi|gpay|phonepe|paytm)\b|\b(processing|registration|security|clearance)\s+(fee|charges?|deposit)\b/i, null,
    'warning', 'Asks for a payment or a “fee” to release money, a job or a parcel.'],
  [/\b(dear\s+customer|dear\s+user|dear\s+sir\/madam)\b/i, null,
    'info', 'Uses a generic greeting instead of your name.'],
];

export function checkMessage(text) {
  const t = text.trim();
  if (t.length < 8) return { verdict: 'suspicious', findings: [finding('warning', 'Paste the full message so it can be checked properly.')], checks: 0, links: [] };
  const findings = [];
  for (const [re, also, tone, msg] of RULES) {
    if (has(t, re) && (!also || has(t, also))) findings.push(finding(tone, msg));
  }
  const links = extractUrls(t).slice(0, 5).map(checkLink);
  links.forEach((l) => l.findings.forEach((f) => {
    if (f.tone !== 'info') findings.push(finding(f.tone, `Link ${l.host}: ${f.text}`));
  }));
  if (links.length && !links.some((l) => l.findings.length)) {
    findings.push(finding('info', `Contains ${links.length} link${links.length > 1 ? 's' : ''}. Only open links you expected to receive.`));
  }
  // Two independent warnings together (e.g. urgency + payment) are a strong combined signal.
  const warnings = findings.filter((f) => f.tone === 'warning').length;
  if (warnings >= 3 && !findings.some((f) => f.tone === 'danger')) {
    findings.unshift(finding('danger', 'Several common scam warning signs appear together in this message.'));
  }
  return { verdict: verdictFrom(findings), findings, checks: RULES.length + links.length * 9, links };
}

// ---------------------------------------------------------- phone / UPI ---

/** Country codes frequently seen in international spam calls/WhatsApp scams reaching India. */
const OFTEN_ABUSED_CC = { '92': 'Pakistan', '84': 'Vietnam', '62': 'Indonesia', '855': 'Cambodia', '880': 'Bangladesh', '254': 'Kenya', '63': 'Philippines', '60': 'Malaysia', '856': 'Laos', '95': 'Myanmar' };
const UPI_BAIT = /(refund|support|care|help(desk|line)?|kyc|official|reward|cashback|bank|verify|claim|police|govt|rbi)/i;

export function checkContact(raw) {
  const input = raw.trim();
  const findings = [];
  if (/^[\w.-]{2,256}@[a-z][a-z0-9]{1,64}$/i.test(input)) {
    const [handle, psp] = input.split('@');
    if (UPI_BAIT.test(handle)) {
      findings.push(finding('warning', `The UPI ID name “${handle}” pretends to be support, a refund or an official body. Real companies do not collect money from personal UPI IDs.`));
    }
    findings.push(finding('info', `UPI ID on the “@${psp}” handle. Always check the name your UPI app shows before paying.`));
    findings.push(finding('info', 'Remember: you never enter your UPI PIN to receive money.'));
    return { verdict: verdictFrom(findings), kind: 'upi', findings, checks: 3 };
  }
  const digits = input.replace(/[^\d+]/g, '');
  const intl = digits.startsWith('+') ? digits.slice(1) : digits.startsWith('00') ? digits.slice(2) : null;
  if (intl && !intl.startsWith('91')) {
    const cc = Object.keys(OFTEN_ABUSED_CC).find((c) => intl.startsWith(c));
    findings.push(cc
      ? finding('warning', `International number from ${OFTEN_ABUSED_CC[cc]} (+${cc}). Codes like this are common in job, investment and “digital arrest” scam calls.`)
      : finding('warning', 'This is an international number. Be careful if it claims to be an Indian bank, company or government office.'));
  } else {
    const local = (intl || digits).replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
    if (/^[6-9]\d{9}$/.test(local)) {
      findings.push(finding('info', 'Looks like a regular Indian mobile number. Banks and government offices usually call from published landline or short codes.'));
    } else if (/^1[48]00\d{6,7}$/.test(local)) {
      findings.push(finding('info', 'Toll-free number format. Confirm it on the company’s official website before calling.'));
    } else if (/^140\d{7}$/.test(local)) {
      findings.push(finding('info', 'Number from the 140 series, which is reserved for promotional calls in India.'));
    } else {
      findings.push(finding('warning', 'This number does not match a standard Indian mobile, landline or toll-free format.'));
    }
  }
  findings.push(finding('info', 'Aegis cannot yet look up who owns a phone number. If someone pressures you, hang up and call the official number yourself.'));
  return { verdict: verdictFrom(findings), kind: 'phone', findings, checks: 4 };
}
