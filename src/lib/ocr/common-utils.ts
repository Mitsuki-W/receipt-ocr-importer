import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * OCRライブラリ共通ユーティリティ
 * 重複していた処理を統合し、一元管理する
 */
export class OCRCommonUtils {

  // ========================================
  // 1. 価格抽出・解析処理
  // ========================================

  /**
   * 統一された価格抽出処理
   */
  static extractPrice(text: string): number | null {
    if (!text) return null
    
    // パターン1: ¥1,234
    let match = text.match(/¥([\d,]+)/)
    if (match) return this.parsePrice(match[1], text)
    
    // パターン2: 1,234円
    match = text.match(/^([\d,]+)円$/)
    if (match) return this.parsePrice(match[1], text)
    
    // パターン3: 1,234 T/E
    match = text.match(/^([\d,]+)\s+[TE]$/)
    if (match) return this.parsePrice(match[1], text)
    
    // パターン4: $12.34 (ドル形式)
    match = text.match(/\$?([\d,]+\.?\d{0,2})/)
    if (match) return this.parsePrice(match[1], text)
    
    // パターン5: 1234 (数字のみ)
    match = text.match(/^([\d,]+)$/)
    if (match) {
      const price = this.parsePrice(match[1], text)
      return (price && price >= 1 && price <= 99999) ? price : null
    }
    
    return null
  }

  /**
   * 価格文字列をパース（日本円・ドル対応）
   */
  static parsePrice(priceText: string, fullText: string = ''): number {
    // 数字とピリオドのみ残す
    const cleanText = priceText.replace(/[^\d.]/g, '')
    const price = parseFloat(cleanText)
    
    if (isNaN(price)) return 0
    
    // 小数点第2位がある場合はドル形式と判断
    if (/\d+\.\d{2}/.test(cleanText)) {
      // ドル表記：小数点第2位まで保持（ドル単位）
      return Math.round(price * 100) / 100
    } else {
      // 日本円：整数に丸める
      return Math.round(price)
    }
  }

  /**
   * 価格妥当性チェック
   */
  static isValidPrice(price?: number): boolean {
    if (!price) return false
    return price >= 1 && price <= 99999
  }

  // ========================================
  // 2. OCRテキスト前処理
  // ========================================

  /**
   * 統一されたテキスト前処理
   */
  static preprocessOCRText(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => this.normalizeTextLine(line))
  }

  /**
   * 行レベルのテキスト正規化
   */
  static normalizeTextLine(line: string): string {
    return line
      .replace(/[""'']/g, '') // 引用符除去
      .replace(/\s+/g, ' ')   // 空白正規化
      .trim()
  }

  /**
   * OCR誤読修正
   */
  static fixOCRErrors(text: string): string {
    const fixes = [
      { from: /⚫/g, to: '個' },
      { from: /°/g, to: '個' },
      { from: /\./g, to: '個' },
      { from: /X(\d)/gi, to: '×$1' },
      { from: /L(\d)/g, to: 'L×$1' },
      { from: /G(\d)/g, to: 'g×$1' }
    ]
    
    let fixed = text
    fixes.forEach(({ from, to }) => {
      fixed = fixed.replace(from, to)
    })
    
    return fixed
  }

  // ========================================
  // 3. エラーハンドリング・ログ処理
  // ========================================

  /**
   * 統一されたエラーハンドリング
   */
  static handleOCRError(error: unknown, context: string, debugMode: boolean = false): {
    success: false
    extractedText: string
    items: ExtractedItem[]
    metadata?: any
  } {
    if (debugMode) {
      console.error(`❌ OCRエラー (${context}):`, error)
    }
    
    return {
      success: false,
      extractedText: '',
      items: [],
      metadata: {
        error: true,
        context,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * デバッグログ出力
   */
  static debugLog(message: string, data?: any, debugMode: boolean = false): void {
    if (debugMode) {
      if (data) {
        console.log(message, data)
      } else {
        console.log(message)
      }
    }
  }

  /**
   * 統計情報生成
   */
  static generateProcessingStats(
    items: ExtractedItem[], 
    processingTime: number, 
    originalCount?: number
  ): {
    itemsDetected: number
    processingTime: number
    reductionRate?: string
    averageConfidence: number
  } {
    const avgConfidence = items.length > 0 
      ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length 
      : 0

    const stats = {
      itemsDetected: items.length,
      processingTime,
      averageConfidence: Math.round(avgConfidence * 100) / 100
    }

    if (originalCount && originalCount > 0) {
      const reductionRate = ((originalCount - items.length) / originalCount * 100).toFixed(1)
      return { ...stats, reductionRate: `${reductionRate}%` }
    }

    return stats
  }

  // ========================================
  // 4. 通貨検出・判定
  // ========================================

  /**
   * 統一された通貨検出
   */
  static detectCurrency(text: string): string {
    // 円記号があれば確実にJPY
    if (text.includes('¥') || text.includes('円')) return 'JPY'
    
    // ドル記号があれば確実にUSD
    if (text.includes('$') || text.includes('USD')) return 'USD'
    
    // 英語の特徴的な単語を検出
    const englishPatterns = [
      /\b(total|subtotal|tax|item|price|amount|receipt|store|thank you)\b/i,
      /\b(walmart|target|cvs|walgreens|safeway|kroger|costco)\b/i,
      /\b(cash|credit|debit|change)\b/i
    ]
    
    const hasEnglishFeatures = englishPatterns.some(pattern => pattern.test(text))
    
    // 小数点第2位形式の価格パターン（ドル特有）
    const hasDollarPricing = /\b\d+\.\d{2}\b/.test(text)
    
    // 英語の特徴 + 小数点価格 = USD
    if (hasEnglishFeatures || hasDollarPricing) {
      return 'USD'
    }
    
    return 'JPY' // デフォルトは日本円
  }

  /**
   * 通貨フォーマット
   */
  static formatPrice(price: number, currency: string = 'JPY'): string {
    if (currency === 'USD') {
      return `$${price.toFixed(2)}`
    } else {
      return `¥${Math.round(price).toLocaleString()}`
    }
  }

  // ========================================
  // 5. 商品名正規化・バリデーション
  // ========================================

  /**
   * 統一された商品名正規化
   */
  static normalizeProductName(name: string): string {
    let normalized = name.trim()
    
    // 先頭の記号除去
    normalized = normalized.replace(/^[※*\s]+/, '').trim()
    
    // 末尾の記号除去
    normalized = normalized.replace(/[*\s]+$/, '').trim()
    
    // 空白正規化
    normalized = normalized.replace(/\s+/g, ' ')
    
    // OCR誤読修正
    normalized = this.fixOCRErrors(normalized)
    
    return normalized
  }

  /**
   * 商品名らしさの判定
   */
  static isLikelyProductName(text: string): boolean {
    if (!text || text.length < 2 || text.length > 50) return false
    if (/^\d+$/.test(text)) return false
    if (/^[¥\d\s\-*]+$/.test(text)) return false
    
    // 日本語を含む、または英字を含む
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
    const hasAlpha = /[a-zA-Z]/.test(text)
    
    return hasJapanese || hasAlpha
  }

  /**
   * 商品名の品質スコア
   */
  static calculateNameQuality(name: string): number {
    let score = 0
    
    // 適切な長さ
    if (name.length >= 2 && name.length <= 20) score += 3
    if (name.length >= 3 && name.length <= 15) score += 2
    
    // 日本語が含まれる
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name)) score += 5
    
    // 英数字のみでない
    if (!/^[A-Za-z0-9\s]+$/.test(name)) score += 2
    
    // 数字のみでない
    if (!/^\d+$/.test(name)) score += 3
    
    // 記号が少ない
    const symbolCount = (name.match(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length
    if (symbolCount === 0) score += 2
    else if (symbolCount <= 1) score += 1
    
    return score
  }

  /**
   * システム情報の検出
   */
  static isSystemInfo(name: string): boolean {
    const systemPatterns = [
      /スキャンレジ\d+/,
      /スキャン\s*No\d+/,
      /領収証明細/,
      /スNo\s*\d+/,
      /レシート\s*No/,
      /取引番号/,
      /店舗コード/,
      /レジ番号/,
      /^R\d{3,4}$/,
      /^REG\d+$/,
      /ひらいし$/,  // 店員名など
      /^[A-Z]{2,3}\d{4,}$/  // システムコード
    ]
    
    return systemPatterns.some(pattern => pattern.test(name))
  }

  /**
   * レシートメタデータの検出
   */
  static isReceiptMetadata(name: string): boolean {
    const metadataKeywords = [
      '小計', '合計', 'お釣り', 'おつり', 'お預り', 'おあずかり',
      '現金', '釣銭', '税込', '税抜', '消費税', '内税', '外税',
      '対象額', '課税', '非課税', 'ポイント', 'カード番号',
      '営業時間', '住所', 'TEL', '電話', 'ありがとう', 'またお越し',
      'クレジット', 'VISA', 'Master', 'JCB', 'AMEX',
      '領収書', 'レシート', '明細', '証明', '控え'
    ]
    
    // キーワードマッチ
    if (metadataKeywords.some(keyword => name.includes(keyword))) {
      return true
    }
    
    // パーセンテージ表記
    if (/\(\d+%\)/.test(name) || /\d+%\s*対象/.test(name)) {
      return true
    }
    
    return false
  }

  // ========================================
  // 6. 重複除去・データクリーニング
  // ========================================

  /**
   * 重複アイテムの除去
   */
  static removeDuplicateItems(items: ExtractedItem[]): ExtractedItem[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = `${item.name.toLowerCase()}-${item.price}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * 商品名で重複グループ化
   */
  static groupDuplicatesByName(items: ExtractedItem[]): Map<string, ExtractedItem[]> {
    const groups = new Map<string, ExtractedItem[]>()
    
    items.forEach(item => {
      const key = this.normalizeProductName(item.name).toLowerCase()
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(item)
    })
    
    return groups
  }

  /**
   * 重複グループから最適なアイテムを選択
   */
  static selectBestItemFromGroup(items: ExtractedItem[]): ExtractedItem {
    if (items.length === 1) return items[0]
    
    // 1. 最も妥当な価格のものを優先
    const validPriceItems = items.filter(item => 
      this.isValidPrice(item.price)
    )
    
    if (validPriceItems.length === 1) {
      return validPriceItems[0]
    }
    
    if (validPriceItems.length > 1) {
      // 2. 信頼度が高いものを優先
      const sortedByConfidence = validPriceItems.sort((a, b) => b.confidence - a.confidence)
      
      // 3. 商品名がより適切なものを優先
      const sortedByName = sortedByConfidence.sort((a, b) => {
        const aScore = this.calculateNameQuality(a.name)
        const bScore = this.calculateNameQuality(b.name)
        return bScore - aScore
      })
      
      return sortedByName[0]
    }
    
    // 妥当な価格がない場合は、最も適切な商品名のものを選択
    return items.sort((a, b) => {
      const aScore = this.calculateNameQuality(a.name)
      const bScore = this.calculateNameQuality(b.name)
      return bScore - aScore
    })[0]
  }

  // ========================================
  // 7. フォールバック処理
  // ========================================

  /**
   * 基本的なフォールバック解析
   */
  static basicFallbackParsing(text: string): ExtractedItem[] {
    const lines = this.preprocessOCRText(text)
    const items: ExtractedItem[] = []
    
    const pricePattern = /(.+?)\s+(\d+(?:\.\d{1,2})?)\s*[円¥$]?\s*$/
    
    lines.forEach((line, index) => {
      const match = line.match(pricePattern)
      if (match) {
        const name = match[1].trim()
        const price = this.parsePrice(match[2], line)
        
        if (this.isLikelyProductName(name) && this.isValidPrice(price)) {
          items.push({
            name: this.normalizeProductName(name),
            price,
            quantity: 1,
            confidence: 0.3,
            sourcePattern: 'fallback-basic',
            lineNumbers: [index],
            rawText: line,
            currency: this.detectCurrency(line)
          })
        }
      }
    })
    
    return this.removeDuplicateItems(items)
  }

  // ========================================
  // 8. バリデーション・品質管理
  // ========================================

  /**
   * アイテムの基本的なバリデーション
   */
  static validateExtractedItem(item: ExtractedItem): {
    isValid: boolean
    issues: string[]
    score: number
  } {
    const issues: string[] = []
    let score = 1.0
    
    // 商品名チェック
    if (!item.name || item.name.length < 2) {
      issues.push('商品名が短すぎます')
      score *= 0.3
    }
    
    if (item.name && item.name.length > 50) {
      issues.push('商品名が長すぎます')
      score *= 0.8
    }
    
    // 価格チェック
    if (!this.isValidPrice(item.price)) {
      issues.push('価格が無効です')
      score *= 0.2
    }
    
    // 数量チェック
    if (item.quantity !== undefined && item.quantity <= 0) {
      issues.push('数量が無効です')
      score *= 0.5
    }
    
    // システム情報チェック
    if (this.isSystemInfo(item.name)) {
      issues.push('システム情報が商品として検出されています')
      score *= 0.1
    }
    
    // メタデータチェック
    if (this.isReceiptMetadata(item.name)) {
      issues.push('レシートメタデータが商品として検出されています')
      score *= 0.1
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      score
    }
  }

  /**
   * 結果の品質評価
   */
  static evaluateResultQuality(items: ExtractedItem[]): {
    overallScore: number
    itemScores: number[]
    validItems: number
    totalItems: number
    issues: string[]
  } {
    const itemScores: number[] = []
    const allIssues: string[] = []
    let validItems = 0
    
    items.forEach((item, index) => {
      const validation = this.validateExtractedItem(item)
      itemScores.push(validation.score)
      
      if (validation.isValid) {
        validItems++
      }
      
      validation.issues.forEach(issue => {
        allIssues.push(`Item ${index + 1}: ${issue}`)
      })
    })
    
    const overallScore = itemScores.length > 0 
      ? itemScores.reduce((sum, score) => sum + score, 0) / itemScores.length 
      : 0
    
    return {
      overallScore,
      itemScores,
      validItems,
      totalItems: items.length,
      issues: allIssues
    }
  }
}