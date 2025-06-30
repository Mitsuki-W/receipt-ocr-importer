import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * 大型店舗レシートの標準パターンパーサー
 * パターン: 商品名 → X(数字) → 商品番号 → 1* → 合計価格
 */
export class WarehouseStandardParser {

  /**
   * 大型店舗レシートの標準パターンで解析
   */
  static parseWarehouseReceipt(ocrText: string): ExtractedItem[] {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const items: ExtractedItem[] = []
    
    console.log(`🏪 大型店舗標準パーサー開始: ${lines.length}行`)
    
    const processedLines = new Set<number>()
    
    // メインの抽出ループ
    for (let i = 0; i < lines.length - 4; i++) {
      if (processedLines.has(i)) continue
      
      const productInfo = this.findWarehouseStandardPattern(lines, i)
      
      if (productInfo) {
        console.log(`✅ 大型店舗商品: ${productInfo.name} x${productInfo.quantity} - ¥${productInfo.price}`)
        
        items.push({
          name: this.normalizeProductName(productInfo.name),
          price: productInfo.price,
          quantity: productInfo.quantity,
          confidence: productInfo.confidence,
          sourcePattern: 'warehouse-standard',
          lineNumbers: productInfo.usedLines,
          rawText: productInfo.usedLines.map((idx: number) => lines[idx] || '').join(' | '),
          category: this.categorizeProduct(productInfo.name),
          metadata: {
            productCode: productInfo.productCode,
            hasMultiplier: productInfo.hasMultiplier,
            originalPattern: productInfo.pattern
          }
        })
        
        // 使用した行をマーク
        productInfo.usedLines.forEach((lineIdx: number) => processedLines.add(lineIdx))
        
        // 次の検索位置を調整
        i = Math.max(...productInfo.usedLines)
      }
    }
    
    // フォールバック: 短いパターンも検索
    const fallbackItems = this.findFallbackPatterns(lines, processedLines)
    items.push(...fallbackItems)
    
    console.log(`✨ 大型店舗標準解析完了: ${items.length}件`)
    
    return this.removeDuplicates(items)
  }

  /**
   * 大型店舗標準パターンの検索
   * パターン: 商品名 → X(数字) → 商品番号 → 1* → 合計価格
   */
  private static findWarehouseStandardPattern(lines: string[], startIndex: number): {
    name: string
    quantity: number
    price: number
    productCode: string | null
    hasMultiplier: boolean
    confidence: number
    pattern: string
    usedLines: number[]
  } | null {
    // 最低4行必要（商品名、X数字、商品番号、価格）
    if (startIndex + 3 >= lines.length) return null
    
    const line1 = lines[startIndex]?.trim()     // 商品名
    const line2 = lines[startIndex + 1]?.trim() // X(数字) または商品番号
    const line3 = lines[startIndex + 2]?.trim() // 商品番号 または 1*
    const line4 = lines[startIndex + 3]?.trim() // 1* または 価格
    const line5 = lines[startIndex + 4]?.trim() // 価格（オプション）
    
    // 商品名の基本チェック
    if (!this.isValidProductName(line1)) return null
    
    // パターン1: 商品名 → X(数字) → 商品番号 → 1* → 価格
    let multiplierMatch = line2?.match(/^X(\d+)$/i)
    if (multiplierMatch) {
      const quantity = parseInt(multiplierMatch[1])
      const productCodeMatch = line3?.match(/^(\d{5,7})$/)
      const oneStarMatch = line4?.match(/^1\*?$/)
      
      if (productCodeMatch && oneStarMatch && line5) {
        const price = this.extractPrice(line5)
        if (price) {
          return {
            name: line1,
            quantity: quantity,
            price: price,
            productCode: productCodeMatch[1],
            hasMultiplier: true,
            confidence: 0.95,
            pattern: 'name-X-code-1star-price',
            usedLines: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4]
          }
        }
      }
    }
    
    // パターン2: 商品名 → 商品番号 → 1* → 価格（数量1の場合）
    const productCodeMatch = line2?.match(/^(\d{5,7})$/)
    if (productCodeMatch) {
      const oneStarMatch = line3?.match(/^1\*?$/)
      if (oneStarMatch) {
        const price = this.extractPrice(line4)
        if (price) {
          return {
            name: line1,
            quantity: 1,
            price: price,
            productCode: productCodeMatch[1],
            hasMultiplier: false,
            confidence: 0.9,
            pattern: 'name-code-1star-price',
            usedLines: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3]
          }
        }
      }
    }
    
    // パターン3: 商品名 → X(数字) → 1* → 価格（商品番号なし）
    multiplierMatch = line2?.match(/^X(\d+)$/i)
    if (multiplierMatch) {
      const quantity = parseInt(multiplierMatch[1])
      const oneStarMatch = line3?.match(/^1\*?$/)
      if (oneStarMatch) {
        const price = this.extractPrice(line4)
        if (price) {
          return {
            name: line1,
            quantity: quantity,
            price: price,
            productCode: null,
            hasMultiplier: true,
            confidence: 0.85,
            pattern: 'name-X-1star-price',
            usedLines: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3]
          }
        }
      }
    }
    
    // パターン4: 商品名 → 1* → 価格（シンプルパターン）
    const oneStarMatch = line2?.match(/^1\*?$/)
    if (oneStarMatch) {
      const price = this.extractPrice(line3)
      if (price) {
        return {
          name: line1,
          quantity: 1,
          price: price,
          productCode: null,
          hasMultiplier: false,
          confidence: 0.8,
          pattern: 'name-1star-price',
          usedLines: [startIndex, startIndex + 1, startIndex + 2]
        }
      }
    }
    
    return null
  }

  /**
   * フォールバックパターンの検索
   */
  private static findFallbackPatterns(lines: string[], processedLines: Set<number>): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    for (let i = 0; i < lines.length - 1; i++) {
      if (processedLines.has(i)) continue
      
      const line1 = lines[i]?.trim()
      const line2 = lines[i + 1]?.trim()
      
      // フォールバック: 商品名らしき行 + 価格らしき行
      if (this.isValidProductName(line1)) {
        const price = this.extractPrice(line2)
        if (price && price >= 100 && price <= 15000) {
          console.log(`🔍 フォールバック: ${line1} - ¥${price}`)
          
          items.push({
            name: this.normalizeProductName(line1),
            price: price,
            quantity: 1,
            confidence: 0.6,
            sourcePattern: 'warehouse-fallback',
            lineNumbers: [i, i + 1],
            rawText: `${line1} | ${line2}`,
            category: this.categorizeProduct(line1),
            metadata: {
              fallback: true
            }
          })
          
          processedLines.add(i)
          processedLines.add(i + 1)
        }
      }
    }
    
    return items
  }

  /**
   * 価格の抽出
   */
  private static extractPrice(text: string): number | null {
    if (!text) return null
    
    // パターン1: ¥1,234
    let match = text.match(/¥([\d,]+)/)
    if (match) {
      return parseInt(match[1].replace(/,/g, ''))
    }
    
    // パターン2: 1,234円
    match = text.match(/^([\d,]+)円$/)
    if (match) {
      return parseInt(match[1].replace(/,/g, ''))
    }
    
    // パターン3: 1234 (数字のみ)
    match = text.match(/^([\d,]+)$/)
    if (match) {
      const price = parseInt(match[1].replace(/,/g, ''))
      // 大型店舗の妥当な価格帯
      if (price >= 50 && price <= 50000) {
        return price
      }
    }
    
    // パターン4: "1*" が混在している場合
    match = text.match(/([\d,]+)/)
    if (match) {
      const price = parseInt(match[1].replace(/,/g, ''))
      if (price >= 100 && price <= 15000) {
        return price
      }
    }
    
    return null
  }

  /**
   * 有効な商品名かどうかの判定
   */
  private static isValidProductName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 60) return false
    
    // 文字が含まれている（日本語、英語、数字）
    if (!/[あ-んア-ンa-zA-Z0-9]/.test(name)) return false
    
    // 除外パターン
    const excludePatterns = [
      /^[\d\s,]+$/,               // 数字・記号のみ
      /^X\d+$/i,                  // X数字パターン
      /^\d{5,7}$/,                // 商品コード
      /^1\*?$/,                   // 1*パターン
      /^¥[\d,]+$/,                // 価格パターン
      /^[\d,]+円?$/,              // 価格パターン
      /WHOLESALE|STORE/i,         // ヘッダー
      /合計|小計|税|売上/,        // 集計系
      /^\d{4}年\d{1,2}月/,        // 日付
      /TEL|FAX|住所/,             // 店舗情報
      /ありがとう|またお越し/,    // 挨拶
      /会員|MEMBER|BIZ|GOLD/i,    // 会員情報
      /RECEIPT|TOTAL/i            // レシート用語
    ]
    
    return !excludePatterns.some(pattern => pattern.test(name))
  }

  /**
   * 商品名の正規化
   */
  private static normalizeProductName(name: string): string {
    let normalized = name.trim()
    
    // OCR誤読の修正
    const ocrFixes = [
      { from: /⚫/g, to: '個' },
      { from: /°/g, to: '個' },
      { from: /\./g, to: '個' },
      { from: /X(\d)/gi, to: '×$1' },
      { from: /L(\d)/g, to: 'L×$1' },
      { from: /G(\d)/g, to: 'g×$1' }
    ]
    
    ocrFixes.forEach(({ from, to }) => {
      normalized = normalized.replace(from, to)
    })
    
    // 先頭の記号除去
    normalized = normalized.replace(/^[※*]+/, '').trim()
    
    return normalized
  }

  /**
   * 商品のカテゴリ分類
   */
  private static categorizeProduct(name: string): string {
    const lowerName = name.toLowerCase()
    
    const categories = [
      { keywords: ['ugg', 'シューズ', '靴', 'shoe'], category: '靴・アパレル' },
      { keywords: ['ヨーグルト', 'yogurt', 'ユタ', 'ユダ'], category: '乳製品' },
      { keywords: ['牛乳', 'ミルク', 'milk', 'キュウニュウ'], category: '乳製品' },
      { keywords: ['スンドゥ', 'チゲ', '冷凍'], category: '冷凍食品' },
      { keywords: ['うずら', '卵', 'egg', 'たまご'], category: '卵・乳製品' },
      { keywords: ['prosciutto', 'ham', 'ハム', '生ハム'], category: '肉類・魚介類' },
      { keywords: ['シュリンプ', 'shrimp', 'エビ', 'カクテル'], category: '肉類・魚介類' },
      { keywords: ['グレープフルーツ', 'grapefruit', 'フルーツ', 'カップ'], category: '野菜・果物' },
      { keywords: ['tissue', 'ティッシュ', 'バス', 'トイレット'], category: '日用品' },
      { keywords: ['リンネル', 'bag', 'バッグ', 'ショルダー'], category: '電子機器・バッグ' },
      { keywords: ['野菜', 'vegetable', 'サラダ', 'レタス'], category: '野菜・果物' },
      { keywords: ['肉', 'meat', '牛', '豚', '鶏'], category: '肉類・魚介類' }
    ]
    
    for (const cat of categories) {
      if (cat.keywords.some(keyword => lowerName.includes(keyword))) {
        return cat.category
      }
    }
    
    return 'その他'
  }

  /**
   * 重複除去
   */
  private static removeDuplicates(items: ExtractedItem[]): ExtractedItem[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = `${item.name.toLowerCase()}-${item.price}`
      if (seen.has(key)) {
        console.log(`🔄 重複除去: ${item.name} - ¥${item.price}`)
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * デバッグ用: パターン分析
   */
  static analyzePatterns(ocrText: string): {
    possibleProducts: Array<{
      line: number
      content: string
      type: string
      confidence: number
    }>
    patternStats: Record<string, number>
  } {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const possibleProducts: Array<{
      line: number
      content: string
      type: string
      confidence: number
    }> = []
    const patternStats = {
      productNames: 0,
      multipliers: 0,
      productCodes: 0,
      oneStars: 0,
      prices: 0
    }
    
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      
      if (this.isValidProductName(trimmed)) {
        possibleProducts.push({
          line: index,
          content: trimmed,
          type: '商品名候補',
          confidence: 0.8
        })
        patternStats.productNames++
      }
      
      if (/^X\d+$/i.test(trimmed)) {
        possibleProducts.push({
          line: index,
          content: trimmed,
          type: '数量倍数',
          confidence: 0.9
        })
        patternStats.multipliers++
      }
      
      if (/^\d{5,7}$/.test(trimmed)) {
        possibleProducts.push({
          line: index,
          content: trimmed,
          type: '商品コード',
          confidence: 0.95
        })
        patternStats.productCodes++
      }
      
      if (/^1\*?$/.test(trimmed)) {
        possibleProducts.push({
          line: index,
          content: trimmed,
          type: '1*パターン',
          confidence: 0.9
        })
        patternStats.oneStars++
      }
      
      if (this.extractPrice(trimmed)) {
        possibleProducts.push({
          line: index,
          content: trimmed,
          type: '価格',
          confidence: 0.85
        })
        patternStats.prices++
      }
    })
    
    return { possibleProducts, patternStats }
  }
}