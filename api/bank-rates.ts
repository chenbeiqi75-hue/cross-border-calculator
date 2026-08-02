/**
 * Vercel Serverless Function: 抓取各银行实时外汇牌价
 *
 * GET /api/bank-rates
 *
 * 牌价格式说明：
 *   sellRate: 现汇卖出价（1 外币 = X 人民币，银行卖外币给你）
 *   buyRate:  现汇买入价（1 外币 = X 人民币，银行买你的外币）
 */

interface BankRates {
  bankId: string
  bankName: string
  rates: Record<string, { sellRate: number | null; buyRate: number | null }>
}

const TIMEOUT_MS = 8000
const CURRENCY_MAP: Record<string, string> = {
  '美元': 'USD', '港币': 'HKD', '欧元': 'EUR', '英镑': 'GBP',
  '日元': 'JPY', '澳元': 'AUD', '加元': 'CAD', '瑞士法郎': 'CHF',
  '新加坡元': 'SGD', '韩元': 'KRW', '泰铢': 'THB',
  'USD': 'USD', 'HKD': 'HKD', 'EUR': 'EUR', 'GBP': 'GBP',
  'JPY': 'JPY', 'AUD': 'AUD', 'CAD': 'CAD', 'CHF': 'CHF',
  'SGD': 'SGD', 'KRW': 'KRW', 'THB': 'THB',
}

function mapCurrency(name: string): string | null {
  const cleaned = name.replace(/[*/]/g, '').trim()
  return CURRENCY_MAP[cleaned] || CURRENCY_MAP[cleaned.toUpperCase()] || null
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/// 中国银行 — 静态 HTML 表格 ✓
async function fetchBOC(): Promise<BankRates> {
  const html = await fetchText('https://www.boc.cn/sourcedb/whpj/')
  const rates: Record<string, { sellRate: number | null; buyRate: number | null }> = {}
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(html)) !== null) {
    const cells = m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    if (!cells || cells.length < 5) continue
    const curr = mapCurrency(cells[0].replace(/<[^>]+>/g, '').trim())
    if (!curr) continue
    const buyVal = parseFloat(cells[1].replace(/<[^>]+>/g, ''))  // 现汇买入价
    const sellVal = parseFloat(cells[3].replace(/<[^>]+>/g, '')) // 现汇卖出价
    if (!isNaN(buyVal) && !isNaN(sellVal) && buyVal > 0 && sellVal > 0) {
      rates[curr] = { buyRate: buyVal, sellRate: sellVal }
    }
  }
  return { bankId: 'boc', bankName: '中国银行', rates }
}

/// 工商银行 — ICBC 外汇牌价（静态 HTML 表格）
async function fetchICBC(): Promise<BankRates> {
  const html = await fetchText('https://www.icbc.com.cn/column/1438058058110883014.html')
  const rates: Record<string, { sellRate: number | null; buyRate: number | null }> = {}
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(html)) !== null) {
    const cells = m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    if (!cells || cells.length < 5) continue
    const curr = mapCurrency(cells[0].replace(/<[^>]+>/g, '').trim())
    if (!curr) continue
    const buyVal = parseFloat(cells[1].replace(/<[^>]+>/g, ''))
    const sellVal = parseFloat(cells[3].replace(/<[^>]+>/g, ''))
    if (!isNaN(buyVal) && !isNaN(sellVal) && buyVal > 0 && sellVal > 0) {
      rates[curr] = { buyRate: buyVal, sellRate: sellVal }
    }
  }
  return { bankId: 'icbc', bankName: '工商银行', rates }
}

/// 建设银行
async function fetchCCB(): Promise<BankRates> {
  const html = await fetchText('https://www.ccb.com/cn/v3/include/fx_rate.html')
  const rates: Record<string, { sellRate: number | null; buyRate: number | null }> = {}
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(html)) !== null) {
    const cells = m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    if (!cells || cells.length < 5) continue
    const curr = mapCurrency(cells[0].replace(/<[^>]+>/g, '').trim())
    if (!curr) continue
    const buyVal = parseFloat(cells[1].replace(/<[^>]+>/g, ''))
    const sellVal = parseFloat(cells[3].replace(/<[^>]+>/g, ''))
    if (!isNaN(buyVal) && !isNaN(sellVal) && buyVal > 0 && sellVal > 0) {
      rates[curr] = { buyRate: buyVal, sellRate: sellVal }
    }
  }
  return { bankId: 'ccb', bankName: '建设银行', rates }
}

/// 农业银行
async function fetchABC(): Promise<BankRates> {
  const html = await fetchText('https://www.abchina.com/cn/PersonalServices/Quotation/bwhp/')
  const rates: Record<string, { sellRate: number | null; buyRate: number | null }> = {}
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(html)) !== null) {
    const cells = m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    if (!cells || cells.length < 5) continue
    const curr = mapCurrency(cells[0].replace(/<[^>]+>/g, '').trim())
    if (!curr) continue
    const buyVal = parseFloat(cells[1].replace(/<[^>]+>/g, ''))
    const sellVal = parseFloat(cells[3].replace(/<[^>]+>/g, ''))
    if (!isNaN(buyVal) && !isNaN(sellVal) && buyVal > 0 && sellVal > 0) {
      rates[curr] = { buyRate: buyVal, sellRate: sellVal }
    }
  }
  return { bankId: 'abc', bankName: '农业银行', rates }
}

/// 招商银行
async function fetchCMB(): Promise<BankRates> {
  const html = await fetchText('https://www.cmbchina.com/CMBIBank/CMBFxRate.aspx')
  const rates: Record<string, { sellRate: number | null; buyRate: number | null }> = {}
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(html)) !== null) {
    const cells = m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    if (!cells || cells.length < 5) continue
    const curr = mapCurrency(cells[0].replace(/<[^>]+>/g, '').trim())
    if (!curr) continue
    const buyVal = parseFloat(cells[1].replace(/<[^>]+>/g, ''))
    const sellVal = parseFloat(cells[3].replace(/<[^>]+>/g, ''))
    if (!isNaN(buyVal) && !isNaN(sellVal) && buyVal > 0 && sellVal > 0) {
      rates[curr] = { buyRate: buyVal, sellRate: sellVal }
    }
  }
  return { bankId: 'cmb', bankName: '招商银行', rates }
}

/// 交通银行 — 可能返回 JSON
async function fetchBCM(): Promise<BankRates> {
  try {
    const text = await fetchText('https://www.95559.com.cn/bankcomm/servlet/bankcomm.fx.json.QueryFxRates')
    const data = JSON.parse(text)
    const rates: Record<string, { sellRate: number | null; buyRate: number | null }> = {}
    if (Array.isArray(data)) {
      for (const item of data) {
        const curr = mapCurrency(item.currencyCode || item.currency || item.code || '')
        if (!curr) continue
        const buyVal = parseFloat(item.buyRate || item.bid)
        const sellVal = parseFloat(item.sellRate || item.ask)
        if (!isNaN(buyVal) && !isNaN(sellVal) && buyVal > 0 && sellVal > 0) {
          rates[curr] = { buyRate: buyVal, sellRate: sellVal }
        }
      }
    }
    return { bankId: 'bcm', bankName: '交通银行', rates }
  } catch {
    return { bankId: 'bcm', bankName: '交通银行', rates: {} }
  }
}

/// 浦发银行
async function fetchSPDB(): Promise<BankRates> {
  try {
    const html = await fetchText('https://www.spdb.com.cn/fx/')
    const rates: Record<string, { sellRate: number | null; buyRate: number | null }> = {}
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let m: RegExpExecArray | null
    while ((m = rowRegex.exec(html)) !== null) {
      const cells = m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi)
      if (!cells || cells.length < 5) continue
      const curr = mapCurrency(cells[0].replace(/<[^>]+>/g, '').trim())
      if (!curr) continue
      const buyVal = parseFloat(cells[1].replace(/<[^>]+>/g, ''))
      const sellVal = parseFloat(cells[3].replace(/<[^>]+>/g, ''))
      if (!isNaN(buyVal) && !isNaN(sellVal) && buyVal > 0 && sellVal > 0) {
        rates[curr] = { buyRate: buyVal, sellRate: sellVal }
      }
    }
    return { bankId: 'spdb', bankName: '浦发银行', rates }
  } catch {
    return { bankId: 'spdb', bankName: '浦发银行', rates: {} }
  }
}

export default async function handler(
  req: { method: string },
  res: {
    setHeader: (k: string, v: string) => void
    status: (n: number) => { json: (d: unknown) => void; send: (s: string) => void }
    json: (d: unknown) => void
  },
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  const tasks = {
    boc: fetchBOC(),
    icbc: fetchICBC().catch(() => ({ bankId: 'icbc', bankName: '工商银行', rates: {} })),
    ccb: fetchCCB().catch(() => ({ bankId: 'ccb', bankName: '建设银行', rates: {} })),
    abc: fetchABC().catch(() => ({ bankId: 'abc', bankName: '农业银行', rates: {} })),
    cmb: fetchCMB().catch(() => ({ bankId: 'cmb', bankName: '招商银行', rates: {} })),
    bcm: fetchBCM(),
    spdb: fetchSPDB(),
  }

  try {
    const results = await Promise.allSettled(Object.values(tasks))
    const bankIds = Object.keys(tasks)
    const rates: Record<string, BankRates> = {}

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        rates[bankIds[i]] = r.value
      } else {
        rates[bankIds[i]] = {
          bankId: bankIds[i],
          bankName: bankIds[i].toUpperCase(),
          rates: {},
        }
      }
    })

    res.json({ timestamp: new Date().toISOString(), rates })
  } catch (err) {
    res.status(500).json({
      error: '抓取银行牌价失败',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}