import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * 汎用レシートパーサー - 様々な大型店舗レシートに対応
 * 動的パターン認識により高い検出性能を実現
 */
export class UniversalReceiptParser {

  /**
   * 汎用レシート解析（自動パターン検出）
   */
  static parseReceipt(ocrText: string): ExtractedItem[] {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const items: ExtractedItem[] = []
    
    console.log(`🏪 汎用レシートパーサー開始: ${lines.length}行`)
    
    // Step 1: レシート構造の自動推測
    const structure = this.analyzeReceiptStructure(lines)
    console.log(`📊 検出パターン: ${structure.dominantPattern}`)
    
    // Step 2: 優先度順でパターンマッチング
    const patterns = this.getPriorityPatterns(structure)
    
    for (const pattern of patterns) {
      const patternItems = this.extractByPattern(lines, pattern, items)
      items.push(...patternItems)
      
      if (items.length > 0) {
        console.log(`✅ ${pattern.name}: ${patternItems.length}件検出`)
      }
    }
    
    // Step 3: 後処理とバリデーション
    const finalItems = this.postProcessItems(items, lines)
    
    console.log(`✨ 汎用解析完了: ${finalItems.length}件`)
    return finalItems
  }

  /**
   * レシート構造の自動分析
   */
  private static analyzeReceiptStructure(lines: string[]): {
    dominantPattern: string
    confidence: number
    characteristics: {
      hasProductCodes: boolean
      hasQuantityMultipliers: boolean
      hasTaxIndicators: boolean
      hasUnitPrices: boolean
      averageItemLines: number
    }
  } {
    const analysis = {
      productCodes: 0,         // 5-7桁の商品コード
      quantityX: 0,           // X数字パターン
      taxIndicators: 0,       // T/E税区分
      unitPrices: 0,          // 単価パターン
      oneStarPattern: 0,      // 1*パターン
      priceLines: 0,          // 価格行
      productNames: 0         // 商品名候補
    }
    
    lines.forEach(line => {
      const trimmed = line.trim()
      
      if (/^\d{5,7}$/.test(trimmed)) analysis.productCodes++
      if (/^X\d+$/i.test(trimmed)) analysis.quantityX++
      if (/[\d,]+\s+[TE]$/.test(trimmed)) analysis.taxIndicators++
      if (/^1\*?$/.test(trimmed)) analysis.oneStarPattern++
      if (/^[\d,]+$/.test(trimmed) && parseInt(trimmed.replace(/,/g, '')) > 100) analysis.unitPrices++
      if (this.isPricePattern(trimmed)) analysis.priceLines++
      if (this.isProductNameCandidate(trimmed)) analysis.productNames++
    })
    
    // 主要パターンの判定
    let dominantPattern = 'generic'
    let confidence = 0.5
    
    // 5行標準パターン（商品名→コード→数量→単価→合計+税）
    if (analysis.productCodes > 3 && analysis.taxIndicators > 3 && analysis.unitPrices > 3) {
      dominantPattern = '5line-standard'
      confidence = 0.9
    }
    // 4行倍数パターン（商品名→X数字→1*→価格）
    else if (analysis.quantityX > 2 && analysis.oneStarPattern > 2) {
      dominantPattern = '4line-multiplier'
      confidence = 0.85
    }
    // 3行シンプルパターン（商品名→コード→価格+税）
    else if (analysis.productCodes > 2 && analysis.taxIndicators > 2) {
      dominantPattern = '3line-simple'
      confidence = 0.8
    }
    // 2行ベーシックパターン（商品名→価格）
    else if (analysis.priceLines > 3 && analysis.productNames > 3) {
      dominantPattern = '2line-basic'
      confidence = 0.7
    }
    
    return {
      dominantPattern,
      confidence,
      characteristics: {
        hasProductCodes: analysis.productCodes > 2,
        hasQuantityMultipliers: analysis.quantityX > 1,
        hasTaxIndicators: analysis.taxIndicators > 2,
        hasUnitPrices: analysis.unitPrices > 2,
        averageItemLines: analysis.productNames > 0 ? 
          (analysis.productCodes + analysis.priceLines) / analysis.productNames : 3
      }
    }
  }

  /**
   * 優先度付きパターンの取得
   */
  private static getPriorityPatterns(structure: any): Array<{
    name: string
    priority: number
    extractor: (lines: string[], items: ExtractedItem[]) => ExtractedItem[]
  }> {
    const patterns = [
      {
        name: '5行標準パターン',
        priority: structure.dominantPattern === '5line-standard' ? 10 : 7,
        extractor: this.extractFiveLinePattern.bind(this)
      },
      {
        name: '4行倍数パターン', 
        priority: structure.dominantPattern === '4line-multiplier' ? 10 : 8,
        extractor: this.extractMultiplierPattern.bind(this)
      },
      {
        name: '3行シンプルパターン',
        priority: structure.dominantPattern === '3line-simple' ? 10 : 6,
        extractor: this.extractThreeLinePattern.bind(this)
      },
      {
        name: '柔軟パターン',
        priority: 5,
        extractor: this.extractFlexiblePattern.bind(this)
      },
      {
        name: '価格ベースパターン',
        priority: 3,
        extractor: this.extractPriceBasedPattern.bind(this)
      }
    ]
    
    return patterns.sort((a, b) => b.priority - a.priority)
  }

  /**
   * パターン別抽出実行
   */
  private static extractByPattern(
    lines: string[], 
    pattern: any, 
    existingItems: ExtractedItem[]
  ): ExtractedItem[] {
    try {
      return pattern.extractor(lines, existingItems)
    } catch (error) {
      console.warn(`⚠️ ${pattern.name}でエラー:`, error)
      return []
    }
  }

  /**
   * 5行標準パターン抽出
   */
  private static extractFiveLinePattern(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = this.getUsedLineNumbers(existingItems)
    
    for (let i = 0; i < lines.length - 4; i++) {
      if (usedLines.has(i)) continue
      
      const pattern = this.analyzeFiveLineSequence(lines, i)
      if (pattern && pattern.confidence > 0.8) {
        items.push({
          name: this.normalizeProductName(pattern.name),
          price: pattern.price,
          quantity: pattern.quantity,
          confidence: pattern.confidence,
          sourcePattern: '5line-standard',
          lineNumbers: pattern.usedLines,
          rawText: pattern.usedLines.map((idx: number) => lines[idx]).join(' | '),
          category: this.categorizeProduct(pattern.name),
          metadata: {
            productCode: pattern.productCode,
            taxType: pattern.taxType,
            unitPrice: pattern.unitPrice
          }
        })
        
        pattern.usedLines.forEach((lineIdx: number) => usedLines.add(lineIdx))
        i = Math.max(...pattern.usedLines)
      }
    }
    
    return items
  }

  /**
   * 5行シーケンス分析
   */
  private static analyzeFiveLineSequence(lines: string[], startIndex: number): {
    name: string
    quantity: number
    price: number
    productCode: string
    taxType: string
    unitPrice: number
    confidence: number
    usedLines: number[]
  } | null {
    if (startIndex + 4 >= lines.length) return null
    
    const line1 = lines[startIndex]?.trim()     // 商品名
    const line2 = lines[startIndex + 1]?.trim() // 商品コード
    const line3 = lines[startIndex + 2]?.trim() // 数量
    const line4 = lines[startIndex + 3]?.trim() // 単価
    const line5 = lines[startIndex + 4]?.trim() // 合計価格+税区分
    
    // 商品名チェック
    if (!this.isProductNameCandidate(line1)) return null
    
    // 商品コード（5-7桁）
    const codeMatch = line2?.match(/^(\d{5,7})$/)
    if (!codeMatch) return null
    
    // 数量
    const quantityMatch = line3?.match(/^(\d+)[個⚫°.]?$/)
    if (!quantityMatch) return null
    
    // 単価
    const unitPriceMatch = line4?.match(/^([\d,]+)$/)
    if (!unitPriceMatch) return null
    
    // 合計価格+税区分
    const totalMatch = line5?.match(/^([\d,]+)\s+([TE])$/)
    if (!totalMatch) return null
    
    const quantity = parseInt(quantityMatch[1])
    const unitPrice = parseInt(unitPriceMatch[1].replace(/,/g, ''))
    const totalPrice = parseInt(totalMatch[1].replace(/,/g, ''))
    
    // 計算チェック（10%の誤差まで許容）
    const expectedTotal = quantity * unitPrice
    const priceDiff = Math.abs(totalPrice - expectedTotal) / expectedTotal
    
    if (priceDiff > 0.1) return null
    
    return {
      name: line1.startsWith('※') ? line1.substring(1).trim() : line1,
      quantity,
      price: totalPrice,
      productCode: codeMatch[1],
      taxType: totalMatch[2],
      unitPrice,
      confidence: 0.95 - (priceDiff * 2), // 価格誤差に応じて信頼度調整
      usedLines: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4]
    }
  }

  /**
   * 4行倍数パターン抽出
   */
  private static extractMultiplierPattern(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = this.getUsedLineNumbers(existingItems)
    
    for (let i = 0; i < lines.length - 3; i++) {
      if (usedLines.has(i)) continue
      
      const line1 = lines[i]?.trim()     // 商品名
      const line2 = lines[i + 1]?.trim() // X数字 または 商品コード
      const line3 = lines[i + 2]?.trim() // 商品コード または 1*
      const line4 = lines[i + 3]?.trim() // 1* または 価格
      const line5 = lines[i + 4]?.trim() // 価格（オプション）
      
      if (!this.isProductNameCandidate(line1)) continue
      
      // パターン1: 商品名 → X数字 → 商品コード → 1* → 価格
      const multiplierMatch = line2?.match(/^X(\d+)$/i)
      if (multiplierMatch) {
        const quantity = parseInt(multiplierMatch[1])
        const codeMatch = line3?.match(/^(\d{5,7})$/)
        const oneStarMatch = line4?.match(/^1\*?$/)
        
        if (codeMatch && oneStarMatch && line5) {
          const price = this.extractPrice(line5)
          if (price && price >= 100 && price <= 50000) {
            items.push({
              name: this.normalizeProductName(line1),
              price,
              quantity,
              confidence: 0.9,
              sourcePattern: '4line-multiplier',
              lineNumbers: [i, i + 1, i + 2, i + 3, i + 4],
              rawText: `${line1} | ${line2} | ${line3} | ${line4} | ${line5}`,
              category: this.categorizeProduct(line1),
              metadata: {
                productCode: codeMatch[1],
                hasMultiplier: true,
                pattern: 'name-X-code-1star-price'
              }
            })
            
            for (let j = i; j <= i + 4; j++) usedLines.add(j)
            i += 4
            continue
          }
        }
      }
      
      // パターン2: 商品名 → X数字 → 1* → 価格
      if (multiplierMatch) {
        const quantity = parseInt(multiplierMatch[1])
        const oneStarMatch = line3?.match(/^1\*?$/)
        
        if (oneStarMatch) {
          const price = this.extractPrice(line4)
          if (price && price >= 100 && price <= 50000) {
            items.push({
              name: this.normalizeProductName(line1),
              price,
              quantity,
              confidence: 0.85,
              sourcePattern: '4line-multiplier',
              lineNumbers: [i, i + 1, i + 2, i + 3],
              rawText: `${line1} | ${line2} | ${line3} | ${line4}`,
              category: this.categorizeProduct(line1),
              metadata: {
                hasMultiplier: true,
                pattern: 'name-X-1star-price'
              }
            })
            
            for (let j = i; j <= i + 3; j++) usedLines.add(j)
            i += 3
            continue
          }
        }
      }
    }
    
    return items
  }

  /**
   * 3行シンプルパターン抽出
   */
  private static extractThreeLinePattern(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = this.getUsedLineNumbers(existingItems)
    
    for (let i = 0; i < lines.length - 2; i++) {
      if (usedLines.has(i)) continue
      
      const line1 = lines[i]?.trim()     // 商品名
      const line2 = lines[i + 1]?.trim() // 商品コード
      const line3 = lines[i + 2]?.trim() // 価格+税区分
      
      if (!this.isProductNameCandidate(line1)) continue
      
      const codeMatch = line2?.match(/^(\d{5,7})$/)
      const priceMatch = line3?.match(/^([\d,]+)\s+([TE])$/)
      
      if (codeMatch && priceMatch) {
        const price = parseInt(priceMatch[1].replace(/,/g, ''))
        if (price >= 100 && price <= 50000) {
          items.push({
            name: this.normalizeProductName(line1),
            price,
            quantity: 1,
            confidence: 0.8,
            sourcePattern: '3line-simple',
            lineNumbers: [i, i + 1, i + 2],
            rawText: `${line1} | ${line2} | ${line3}`,
            category: this.categorizeProduct(line1),
            metadata: {
              productCode: codeMatch[1],
              taxType: priceMatch[2]
            }
          })
          
          usedLines.add(i)
          usedLines.add(i + 1)
          usedLines.add(i + 2)
          i += 2
        }
      }
    }
    
    return items
  }

  /**
   * 柔軟パターン抽出
   */
  private static extractFlexiblePattern(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = this.getUsedLineNumbers(existingItems)
    
    for (let i = 0; i < lines.length - 1; i++) {
      if (usedLines.has(i)) continue
      
      const line = lines[i].trim()
      if (!this.isProductNameCandidate(line)) continue
      
      // 次の5行以内で価格を探す
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (usedLines.has(j)) continue
        
        const nextLine = lines[j].trim()
        const price = this.extractPrice(nextLine)
        
        if (price && price >= 100 && price <= 50000) {
          // 中間行に商品コードがあるかチェック
          let productCode = null
          for (let k = i + 1; k < j; k++) {
            const middleLine = lines[k].trim()
            const codeMatch = middleLine.match(/^(\d{5,7})$/)
            if (codeMatch) {
              productCode = codeMatch[1]
              break
            }
          }
          
          items.push({
            name: this.normalizeProductName(line),
            price,
            quantity: 1,
            confidence: 0.7,
            sourcePattern: 'flexible',
            lineNumbers: [i, j],
            rawText: `${line} | ${nextLine}`,
            category: this.categorizeProduct(line),
            metadata: {
              productCode,
              lineDistance: j - i
            }
          })
          
          usedLines.add(i)
          usedLines.add(j)
          break
        }
      }
    }
    
    return items
  }

  /**
   * 価格ベースパターン抽出
   */
  private static extractPriceBasedPattern(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = this.getUsedLineNumbers(existingItems)
    
    // 価格行から逆算して商品名を探す
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      
      const line = lines[i].trim()
      const price = this.extractPrice(line)
      
      if (price && price >= 200 && price <= 30000) {
        // 前の3行以内で商品名を探す
        for (let j = Math.max(0, i - 3); j < i; j++) {
          if (usedLines.has(j)) continue
          
          const prevLine = lines[j].trim()
          if (this.isProductNameCandidate(prevLine)) {
            items.push({
              name: this.normalizeProductName(prevLine),
              price,
              quantity: 1,
              confidence: 0.6,
              sourcePattern: 'price-based',
              lineNumbers: [j, i],
              rawText: `${prevLine} | ${line}`,
              category: this.categorizeProduct(prevLine),
              metadata: {
                pricePattern: this.getPricePattern(line),
                reverse: true
              }
            })
            
            usedLines.add(j)
            usedLines.add(i)
            break
          }
        }
      }
    }
    
    return items
  }

  /**
   * 後処理とバリデーション
   */
  private static postProcessItems(items: ExtractedItem[], lines: string[]): ExtractedItem[] {
    // 重複除去
    const uniqueItems = this.removeDuplicates(items)
    
    // 価格妥当性チェック
    const validItems = uniqueItems.filter(item => {
      if (!item.price || item.price < 50 || item.price > 100000) return false
      if (!item.name || item.name.length < 2) return false
      return true
    })
    
    // 信頼度による並び替え
    return validItems.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * ユーティリティメソッド群
   */
  private static getUsedLineNumbers(items: ExtractedItem[]): Set<number> {
    const used = new Set<number>()
    items.forEach(item => {
      item.lineNumbers?.forEach(lineNum => used.add(lineNum))
    })
    return used
  }

  private static isProductNameCandidate(text: string): boolean {
    if (!text || text.length < 2 || text.length > 60) return false
    
    // 基本的な文字種チェック
    if (!/[あ-んア-ンa-zA-Z0-9]/.test(text)) return false
    
    // 除外パターンの詳細チェック
    const excludePatterns = [
      /^[\d\s,]+$/,               // 数字・記号のみ
      /^X\d+$/i,                  // X数字パターン
      /^\d{5,7}$/,                // 商品コード
      /^1\*?$/,                   // 1*パターン
      /^¥[\d,]+$/,                // 価格パターン
      /^[\d,]+円?$/,              // 価格パターン
      /^[\d,]+\s+[TE]$/,          // 価格+税区分
      /合計|小計|税|売上|対象額/, // 集計系
      /WHOLESALE|STORE/i,         // ヘッダー
      /receipt|total/i,           // レシート用語
      /^(\d{4}年\d{1,2}月|\d{1,2}\/\d{1,2})/,  // 日付
      /TEL|FAX|住所/,             // 店舗情報
      /ありがとう|またお越し/,    // 挨拶
      /会員|MEMBER|BIZ|GOLD/i,    // 会員情報
    ]
    
    // 除外パターンに該当する場合はfalse
    if (excludePatterns.some(pattern => pattern.test(text))) {
      return false
    }
    
    // 積極的な商品名判定（信頼度ベース）
    let confidence = 0.3 // ベース信頼度
    
    // 長さによる加点
    if (text.length >= 4) confidence += 0.1
    if (text.length >= 8) confidence += 0.1
    
    // 文字種による加点
    if (/[あ-んア-ン]/.test(text)) confidence += 0.2  // ひらがな・カタカナ
    if (/[a-zA-Z]/.test(text)) confidence += 0.15     // アルファベット
    if (/[0-9]/.test(text) && text.length > 3) confidence += 0.05 // 数字（適度に）
    
    // 商品らしい記号・パターン
    if (/[×・]/.test(text)) confidence += 0.1         // 商品表記によくある記号
    if (/\d+(g|G|ml|ML|L|個|本|袋|パック)/.test(text)) confidence += 0.15 // 単位表記
    
    // 商品らしいキーワード（カテゴリ別）
    const productKeywords = [
      // 食品
      'ヨーグルト', '牛乳', 'ミルク', 'チゲ', 'スープ', '卵', 'エッグ', 
      'ハム', 'シュリンプ', 'エビ', 'フルーツ', 'グレープ', '野菜', 'サラダ',
      // 日用品
      'ティッシュ', 'バッグ', 'シューズ', '靴',
      // 英語
      'yogurt', 'milk', 'egg', 'ham', 'fruit', 'tissue', 'bag', 'shoe'
    ]
    
    if (productKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
      confidence += 0.25
    }
    
    // ブランド名パターン
    if (/^[A-Z]+\s+[A-Z]+/.test(text)) {
      confidence += 0.1  // 大文字ブランド名
    }
    
    // KS（カークランド）やその他のブランド略称
    if (/^KS\s+/i.test(text) || /^\w{2,4}\s+[A-Z]/.test(text)) {
      confidence += 0.15
    }
    
    // 最終判定（閾値を下げて検出率向上）
    return confidence > 0.5  // 0.6から0.5に下げて検出感度を上げる
  }

  private static isPricePattern(text: string): boolean {
    const patterns = [
      /^[\d,]+\s+[TE]$/,    // 価格+税区分
      /^¥[\d,]+$/,          // ¥記号付き
      /^[\d,]+円$/,         // 円記号付き
      /^[\d,]{3,}$/         // 数字のみ（3桁以上）
    ]
    return patterns.some(pattern => pattern.test(text))
  }

  private static extractPrice(text: string): number | null {
    if (!text) return null
    
    // パターン1: ¥1,234
    let match = text.match(/¥([\d,]+)/)
    if (match) return parseInt(match[1].replace(/,/g, ''))
    
    // パターン2: 1,234円
    match = text.match(/^([\d,]+)円$/)
    if (match) return parseInt(match[1].replace(/,/g, ''))
    
    // パターン3: 1,234 T/E
    match = text.match(/^([\d,]+)\s+[TE]$/)
    if (match) return parseInt(match[1].replace(/,/g, ''))
    
    // パターン4: 1234 (数字のみ)
    match = text.match(/^([\d,]+)$/)
    if (match) {
      const price = parseInt(match[1].replace(/,/g, ''))
      return (price >= 50 && price <= 100000) ? price : null
    }
    
    return null
  }

  private static normalizeProductName(name: string): string {
    let normalized = name.trim()
    
    // OCR誤読の修正
    const fixes = [
      { from: /⚫/g, to: '個' },
      { from: /°/g, to: '個' },
      { from: /\./g, to: '個' },
      { from: /X(\d)/gi, to: '×$1' },
      { from: /L(\d)/g, to: 'L×$1' },
      { from: /G(\d)/g, to: 'g×$1' }
    ]
    
    fixes.forEach(({ from, to }) => {
      normalized = normalized.replace(from, to)
    })
    
    // 先頭の記号除去
    normalized = normalized.replace(/^[※*]+/, '').trim()
    
    return normalized
  }

  private static categorizeProduct(name: string): string {
    const lowerName = name.toLowerCase()
    
    const categories = [
      { keywords: ['シューズ', '靴', 'shoe', 'スニーカー'], category: '靴・アパレル' },
      { keywords: ['ヨーグルト', 'yogurt', '牛乳', 'milk', 'ミルク'], category: '乳製品' },
      { keywords: ['冷凍', 'チゲ', 'スープ', 'フローズン'], category: '冷凍食品' },
      { keywords: ['卵', 'egg', 'たまご', 'エッグ'], category: '卵・乳製品' },
      { keywords: ['ハム', 'ham', 'シュリンプ', 'shrimp', 'エビ', '肉'], category: '肉類・魚介類' },
      { keywords: ['フルーツ', 'fruit', 'グレープ', '果物'], category: '野菜・果物' },
      { keywords: ['ティッシュ', 'tissue', 'バス', 'トイレット'], category: '日用品' },
      { keywords: ['バッグ', 'bag', 'リンネル', 'ショルダー'], category: '電子機器・バッグ' },
      { keywords: ['野菜', 'vegetable', 'サラダ', 'レタス'], category: '野菜・果物' }
    ]
    
    for (const cat of categories) {
      if (cat.keywords.some(keyword => lowerName.includes(keyword))) {
        return cat.category
      }
    }
    
    return 'その他'
  }

  private static getPricePattern(text: string): string {
    if (/^[\d,]+\s+[TE]$/.test(text)) return 'price-tax'
    if (/^¥[\d,]+$/.test(text)) return 'yen-prefix'
    if (/^[\d,]+円$/.test(text)) return 'yen-suffix'
    if (/^[\d,]+$/.test(text)) return 'number-only'
    return 'unknown'
  }

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
    structure: any
    patternStats: Record<string, number>
    recommendations: string[]
  } {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const structure = this.analyzeReceiptStructure(lines)
    
    const stats = {
      totalLines: lines.length,
      productNameCandidates: lines.filter(line => this.isProductNameCandidate(line.trim())).length,
      pricePatterns: lines.filter(line => this.isPricePattern(line.trim())).length,
      productCodes: lines.filter(line => /^\d{5,7}$/.test(line.trim())).length,
      quantityMultipliers: lines.filter(line => /^X\d+$/i.test(line.trim())).length
    }
    
    const recommendations = [
      `推奨パターン: ${structure.dominantPattern}`,
      `信頼度: ${(structure.confidence * 100).toFixed(1)}%`,
      stats.productNameCandidates < 5 ? '商品名候補が少ないため、OCR精度の確認が必要' : '',
      stats.pricePatterns < 3 ? '価格パターンが少ないため、フォーマットの確認が必要' : '',
      structure.confidence < 0.7 ? '構造解析の信頼度が低いため、複数パターンでの解析を推奨' : ''
    ].filter(Boolean)
    
    return {
      structure,
      patternStats: stats,
      recommendations
    }
  }
}