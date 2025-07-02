/**
 * 価格処理専用ユーティリティ
 * 価格抽出・解析・フォーマットに特化した処理を集約
 */
export class PriceUtils {

  // 価格パターン定義
  private static readonly PRICE_PATTERNS = {
    // 日本円パターン
    YEN_PREFIX: /¥([\d,]+)/,                    // ¥1,234
    YEN_SUFFIX: /^([\d,]+)円$/,                 // 1,234円
    YEN_WITH_TAX: /^([\d,]+)\s+[TE]$/,          // 1,234 T/E
    
    // ドルパターン
    DOLLAR_PREFIX: /\$([\d,]+\.?\d{0,2})/,      // $12.34
    DOLLAR_DECIMAL: /^([\d,]+\.\d{2})$/,        // 12.34
    
    // 汎用パターン
    NUMBERS_ONLY: /^([\d,]+)$/,                 // 1234
    INLINE_PRICE: /(.+?)\s+([\d,]+\.?\d{0,2})\s*[円¥$]?\s*$/ // 商品名 1234
  }

  // 通貨判定パターン
  private static readonly CURRENCY_INDICATORS = {
    JPY: {
      symbols: ['¥', '円'],
      keywords: ['日本', 'japan', 'jpy'],
      patterns: [
        /日本円/i,
        /\d+円$/,
        /¥\d+/
      ]
    },
    USD: {
      symbols: ['$', 'USD'],
      keywords: ['dollar', 'usd', 'america', 'us'],
      patterns: [
        /\$\d+/,
        /\d+\.\d{2}/,
        /USD/i
      ]
    }
  }

  // 英語店舗判定用キーワード
  private static readonly ENGLISH_STORE_KEYWORDS = [
    'total', 'subtotal', 'tax', 'item', 'price', 'amount', 'receipt', 'store', 'thank you',
    'walmart', 'target', 'cvs', 'walgreens', 'safeway', 'kroger', 'costco',
    'cash', 'credit', 'debit', 'change'
  ]

  /**
   * 包括的な価格抽出
   * 複数パターンを試行し、最適な価格を返す
   */
  static extractPrice(text: string, currency?: string): {
    price: number | null
    confidence: number
    pattern: string
    currency: string
  } {
    if (!text || text.trim().length === 0) {
      return { price: null, confidence: 0, pattern: 'none', currency: currency || 'JPY' }
    }

    const cleanText = text.trim()
    const detectedCurrency = currency || this.detectCurrency(cleanText)
    
    // パターン優先順位で試行
    const attempts = [
      () => this.extractYenPrice(cleanText),
      () => this.extractDollarPrice(cleanText),
      () => this.extractGenericPrice(cleanText),
      () => this.extractInlinePrice(cleanText)
    ]

    for (const attempt of attempts) {
      const result = attempt()
      if (result.price !== null) {
        return {
          ...result,
          currency: detectedCurrency
        }
      }
    }

    return { price: null, confidence: 0, pattern: 'no-match', currency: detectedCurrency }
  }

  /**
   * 日本円価格の抽出
   */
  private static extractYenPrice(text: string): {
    price: number | null
    confidence: number
    pattern: string
  } {
    // パターン1: ¥1,234
    let match = text.match(this.PRICE_PATTERNS.YEN_PREFIX)
    if (match) {
      const price = this.parseNumericPrice(match[1])
      return {
        price: Math.round(price), // 日本円は整数
        confidence: 0.95,
        pattern: 'yen-prefix'
      }
    }

    // パターン2: 1,234円
    match = text.match(this.PRICE_PATTERNS.YEN_SUFFIX)
    if (match) {
      const price = this.parseNumericPrice(match[1])
      return {
        price: Math.round(price),
        confidence: 0.9,
        pattern: 'yen-suffix'
      }
    }

    // パターン3: 1,234 T/E
    match = text.match(this.PRICE_PATTERNS.YEN_WITH_TAX)
    if (match) {
      const price = this.parseNumericPrice(match[1])
      return {
        price: Math.round(price),
        confidence: 0.85,
        pattern: 'yen-with-tax'
      }
    }

    return { price: null, confidence: 0, pattern: 'no-match' }
  }

  /**
   * ドル価格の抽出
   */
  private static extractDollarPrice(text: string): {
    price: number | null
    confidence: number
    pattern: string
  } {
    // パターン1: $12.34
    let match = text.match(this.PRICE_PATTERNS.DOLLAR_PREFIX)
    if (match) {
      const price = this.parseNumericPrice(match[1])
      return {
        price: Math.round(price * 100) / 100, // ドルは小数点2位まで
        confidence: 0.95,
        pattern: 'dollar-prefix'
      }
    }

    // パターン2: 12.34 (小数点2位がある場合)
    match = text.match(this.PRICE_PATTERNS.DOLLAR_DECIMAL)
    if (match && /\d+\.\d{2}/.test(match[1])) {
      const price = this.parseNumericPrice(match[1])
      return {
        price: Math.round(price * 100) / 100,
        confidence: 0.8,
        pattern: 'dollar-decimal'
      }
    }

    return { price: null, confidence: 0, pattern: 'no-match' }
  }

  /**
   * 汎用価格抽出
   */
  private static extractGenericPrice(text: string): {
    price: number | null
    confidence: number
    pattern: string
  } {
    const match = text.match(this.PRICE_PATTERNS.NUMBERS_ONLY)
    if (match) {
      const price = this.parseNumericPrice(match[1])
      
      // 妥当な価格範囲かチェック
      if (price >= 1 && price <= 99999) {
        // 小数点がある場合はドル、ない場合は円と推定
        const hasDecimal = match[1].includes('.')
        return {
          price: hasDecimal ? Math.round(price * 100) / 100 : Math.round(price),
          confidence: 0.6,
          pattern: 'generic-numbers'
        }
      }
    }

    return { price: null, confidence: 0, pattern: 'no-match' }
  }

  /**
   * インライン価格抽出（商品名 価格）
   */
  private static extractInlinePrice(text: string): {
    price: number | null
    confidence: number
    pattern: string
  } {
    const match = text.match(this.PRICE_PATTERNS.INLINE_PRICE)
    if (match) {
      const productName = match[1].trim()
      const price = this.parseNumericPrice(match[2])
      
      // 商品名らしさと価格妥当性をチェック
      if (this.isLikelyProductName(productName) && price >= 1 && price <= 99999) {
        return {
          price: Math.round(price),
          confidence: 0.75,
          pattern: 'inline-price'
        }
      }
    }

    return { price: null, confidence: 0, pattern: 'no-match' }
  }

  /**
   * 数値文字列を数値に変換
   */
  private static parseNumericPrice(priceText: string): number {
    // コンマを除去して数値に変換
    const cleanText = priceText.replace(/,/g, '')
    return parseFloat(cleanText) || 0
  }

  /**
   * 通貨自動判定
   */
  static detectCurrency(text: string): string {
    const lowerText = text.toLowerCase()
    
    // 明示的な通貨記号をチェック
    for (const [currency, indicators] of Object.entries(this.CURRENCY_INDICATORS)) {
      // 記号チェック
      if (indicators.symbols.some(symbol => text.includes(symbol))) {
        return currency
      }
      
      // キーワードチェック
      if (indicators.keywords.some(keyword => lowerText.includes(keyword))) {
        return currency
      }
      
      // パターンチェック
      if (indicators.patterns.some(pattern => pattern.test(text))) {
        return currency
      }
    }

    // 英語店舗キーワードの検出
    const hasEnglishFeatures = this.ENGLISH_STORE_KEYWORDS.some(keyword => 
      lowerText.includes(keyword)
    )
    
    // 小数点第2位の価格パターン（ドル特有）
    const hasDollarPricing = /\b\d+\.\d{2}\b/.test(text)
    
    if (hasEnglishFeatures || hasDollarPricing) {
      return 'USD'
    }
    
    return 'JPY' // デフォルト
  }

  /**
   * 価格妥当性チェック
   */
  static validatePrice(price: number, currency: string = 'JPY'): {
    isValid: boolean
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []

    // 基本的な範囲チェック
    if (price <= 0) {
      issues.push('価格が0以下です')
      suggestions.push('価格を再確認してください')
    }

    // 通貨別のチェック
    if (currency === 'JPY') {
      if (price > 100000) {
        issues.push('日本円として異常に高額です')
        suggestions.push('ドル表記の可能性を確認してください')
      }
      if (price < 1) {
        issues.push('日本円として異常に安価です')
      }
      // 日本円で小数点がある場合
      if (price % 1 !== 0) {
        issues.push('日本円に小数点があります')
        suggestions.push('ドル表記の可能性があります')
      }
    } else if (currency === 'USD') {
      if (price > 1000) {
        issues.push('ドルとして異常に高額です')
      }
      if (price < 0.01) {
        issues.push('ドルとして異常に安価です')
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * 価格フォーマット
   */
  static formatPrice(price: number, currency: string = 'JPY', options?: {
    showSymbol?: boolean
    showDecimals?: boolean
    useCommas?: boolean
  }): string {
    const opts = {
      showSymbol: true,
      showDecimals: currency === 'USD',
      useCommas: true,
      ...options
    }

    let formatted = ''
    
    if (currency === 'USD') {
      const decimals = opts.showDecimals ? 2 : 0
      formatted = price.toFixed(decimals)
      if (opts.useCommas && price >= 1000) {
        formatted = parseFloat(formatted).toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        })
      }
      if (opts.showSymbol) {
        formatted = `$${formatted}`
      }
    } else {
      // JPY
      const rounded = Math.round(price)
      if (opts.useCommas) {
        formatted = rounded.toLocaleString('ja-JP')
      } else {
        formatted = rounded.toString()
      }
      if (opts.showSymbol) {
        formatted = `¥${formatted}`
      }
    }

    return formatted
  }

  /**
   * 複数価格の統計分析
   */
  static analyzePrices(prices: number[]): {
    count: number
    min: number
    max: number
    average: number
    median: number
    distribution: {
      low: number     // < 100
      medium: number  // 100-1000
      high: number    // > 1000
    }
    outliers: number[]
  } {
    if (prices.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        median: 0,
        distribution: { low: 0, medium: 0, high: 0 },
        outliers: []
      }
    }

    const sorted = [...prices].sort((a, b) => a - b)
    const sum = prices.reduce((acc, price) => acc + price, 0)
    const average = sum / prices.length

    // 分布計算
    const distribution = {
      low: prices.filter(p => p < 100).length,
      medium: prices.filter(p => p >= 100 && p <= 1000).length,
      high: prices.filter(p => p > 1000).length
    }

    // 外れ値検出（平均の3倍以上または1/3以下）
    const outliers = prices.filter(p => p > average * 3 || p < average / 3)

    return {
      count: prices.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: Math.round(average * 100) / 100,
      median: sorted[Math.floor(sorted.length / 2)],
      distribution,
      outliers
    }
  }

  /**
   * 価格文字列から商品名と価格を分離
   */
  static separateNameAndPrice(text: string): {
    name: string
    price: number | null
    confidence: number
  } {
    // パターン1: "商品名 ¥123"
    let match = text.match(/^(.+?)\s+¥(\d+)$/)
    if (match) {
      return {
        name: match[1].trim(),
        price: parseInt(match[2]),
        confidence: 0.9
      }
    }

    // パターン2: "商品名 123円"
    match = text.match(/^(.+?)\s+(\d+)円$/)
    if (match) {
      return {
        name: match[1].trim(),
        price: parseInt(match[2]),
        confidence: 0.85
      }
    }

    // パターン3: "商品名 $12.34"
    match = text.match(/^(.+?)\s+\$(\d+\.\d{2})$/)
    if (match) {
      return {
        name: match[1].trim(),
        price: parseFloat(match[2]),
        confidence: 0.9
      }
    }

    // パターン4: "商品名 123" (汎用)
    match = text.match(/^(.+?)\s+(\d{2,5})$/)
    if (match) {
      const name = match[1].trim()
      const price = parseInt(match[2])
      
      if (this.isLikelyProductName(name) && price >= 10 && price <= 99999) {
        return {
          name,
          price,
          confidence: 0.7
        }
      }
    }

    // 分離できない場合
    return {
      name: text.trim(),
      price: null,
      confidence: 0.5
    }
  }

  /**
   * 商品名らしさの簡易判定
   */
  private static isLikelyProductName(text: string): boolean {
    if (!text || text.length < 2 || text.length > 50) return false
    if (/^\d+$/.test(text)) return false
    
    // 日本語または英字を含む
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text) || /[a-zA-Z]/.test(text)
  }

  /**
   * 通貨変換（簡易版）
   */
  static convertCurrency(amount: number, fromCurrency: string, toCurrency: string, exchangeRate?: number): number {
    if (fromCurrency === toCurrency) return amount
    
    // デフォルトレート（実際のアプリでは外部APIを使用）
    const defaultRate = fromCurrency === 'USD' && toCurrency === 'JPY' ? 150 : 0.0067
    const rate = exchangeRate || defaultRate
    
    return Math.round(amount * rate * 100) / 100
  }
}