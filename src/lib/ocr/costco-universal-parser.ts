import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * 汎用Costcoレシートパーサー（どのCostcoレシートでも対応）
 */
export class CostcoUniversalParser {

  /**
   * 任意のCostcoレシートを解析
   */
  static parseCostcoReceipt(ocrText: string): ExtractedItem[] {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const items: ExtractedItem[] = []
    
    console.log(`🏪 Costco汎用パーサー開始: ${lines.length}行`)
    
    // Step 1: Costco特有のパターンで商品を検出
    const costcoItems = this.findCostcoPatterns(lines)
    items.push(...costcoItems)
    
    // Step 2: 5行パターンで検出
    const fiveLineItems = this.findFiveLinePatterns(lines, items)
    items.push(...fiveLineItems)
    
    // Step 3: 軽減税率商品（※付き）を検出
    const reducedTaxItems = this.findReducedTaxItems(lines, items)
    items.push(...reducedTaxItems)
    
    // Step 4: 一般的な価格パターンで検出
    const genericItems = this.findGenericItems(lines, items)
    items.push(...genericItems)
    
    console.log(`✨ Costco汎用解析完了: ${items.length}件`)
    
    return this.removeDuplicates(items)
  }

  /**
   * Costco特有のパターンで商品検出
   */
  private static findCostcoPatterns(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const processedLines = new Set<number>()
    
    for (let i = 0; i < lines.length - 4; i++) {
      if (processedLines.has(i)) continue
      
      // Costco標準の5行パターンをチェック
      const pattern = this.analyzeFiveLinePattern(lines, i)
      
      if (pattern && this.isCostcoProduct(pattern)) {
        console.log(`🎯 Costco商品: ${pattern.name} - ¥${pattern.price}`)
        
        items.push({
          name: this.normalizeCostcoProductName(pattern.name),
          price: pattern.price,
          quantity: pattern.quantity || 1,
          confidence: 0.9,
          sourcePattern: 'costco-5line',
          lineNumbers: pattern.usedLines,
          rawText: pattern.usedLines.map(idx => lines[idx]).join(' | '),
          category: this.categorizeCostcoProduct(pattern.name),
          metadata: {
            productCode: pattern.productCode,
            taxType: pattern.taxType,
            reducedTaxRate: pattern.taxType === 'E',
            hasAsterisk: pattern.hasAsterisk
          }
        })
        
        pattern.usedLines.forEach(lineIdx => processedLines.add(lineIdx))
        i = Math.max(...pattern.usedLines)
      }
    }
    
    return items
  }

  /**
   * 5行パターンの分析
   */
  private static analyzeFiveLinePattern(lines: string[], startIndex: number): any | null {
    if (startIndex + 4 >= lines.length) return null
    
    const line1 = lines[startIndex]?.trim()     // 商品名
    const line2 = lines[startIndex + 1]?.trim() // 商品コード
    const line3 = lines[startIndex + 2]?.trim() // 数量
    const line4 = lines[startIndex + 3]?.trim() // 単価
    const line5 = lines[startIndex + 4]?.trim() // 合計価格+税区分
    
    // 基本チェック
    if (!line1 || !line2 || !line3 || !line4 || !line5) return null
    
    // 商品コード（5-7桁）
    const codeMatch = line2.match(/^(\d{5,7})$/)
    if (!codeMatch) return null
    
    // 数量パターン
    const quantityMatch = line3.match(/^(\d+)[個⚫°.]?$/)
    if (!quantityMatch) return null
    
    // 単価（数字・カンマ区切り）
    const unitPriceMatch = line4.match(/^([\d,]+)$/)
    if (!unitPriceMatch) return null
    
    // 合計価格+税区分
    const totalMatch = line5.match(/^([\d,]+)\s+([TE])$/)
    if (!totalMatch) return null
    
    const price = parseInt(totalMatch[1].replace(/,/g, ''))
    
    // Costcoの価格帯チェック
    if (price < 100 || price > 50000) return null
    
    return {
      name: line1.startsWith('※') ? line1.substring(1).trim() : line1,
      productCode: codeMatch[1],
      quantity: parseInt(quantityMatch[1]),
      price: price,
      taxType: totalMatch[2],
      hasAsterisk: line1.startsWith('※'),
      usedLines: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4]
    }
  }

  /**
   * Costco商品かどうかの判定
   */
  private static isCostcoProduct(pattern: any): boolean {
    const name = pattern.name.toLowerCase()
    
    // 明らかに商品ではないものを除外
    const excludePatterns = [
      /^[\d\s]+$/,           // 数字・空白のみ
      /合計|小計|税|売上/,   // 集計系
      /^\d{4}年\d{1,2}月/,   // 日付
      /wholesale|biz|gold/i, // ヘッダー
      /receipt|total/i       // レシート用語
    ]
    
    if (excludePatterns.some(pattern => pattern.test(name))) {
      return false
    }
    
    // 基本的な商品名の特徴
    return (
      name.length >= 2 && 
      name.length <= 50 &&
      (/[あ-んア-ンa-zA-Z]/.test(name)) // 文字を含む
    )
  }

  /**
   * 軽減税率商品（※付き）の検出
   */
  private static findReducedTaxItems(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()
    
    // 既存アイテムの行をマーク
    existingItems.forEach(item => {
      item.lineNumbers?.forEach(lineNum => usedLines.add(lineNum))
    })
    
    for (let i = 0; i < lines.length - 1; i++) {
      if (usedLines.has(i)) continue
      
      const line = lines[i].trim()
      
      // ※で始まる商品名
      if (line.startsWith('※') && line.length > 3) {
        // 近くの行で "E" 税区分を探す
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const nextLine = lines[j].trim()
          const priceMatch = nextLine.match(/^([\d,]+)\s+E$/)
          
          if (priceMatch) {
            const price = parseInt(priceMatch[1].replace(/,/g, ''))
            if (price >= 100 && price <= 10000) {
              const productName = line.substring(1).trim()
              
              console.log(`※ 軽減税率商品: ${productName} - ¥${price}`)
              
              items.push({
                name: this.normalizeCostcoProductName(productName),
                price: price,
                quantity: 1,
                confidence: 0.8,
                sourcePattern: 'costco-reduced-tax',
                lineNumbers: [i, j],
                rawText: `${line} | ${nextLine}`,
                category: this.categorizeCostcoProduct(productName),
                metadata: {
                  taxType: 'E',
                  reducedTaxRate: true,
                  hasAsterisk: true
                }
              })
              
              usedLines.add(i)
              usedLines.add(j)
              break
            }
          }
        }
      }
    }
    
    return items
  }

  /**
   * 5行パターンの検出（より柔軟）
   */
  private static findFiveLinePatterns(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()
    
    existingItems.forEach(item => {
      item.lineNumbers?.forEach(lineNum => usedLines.add(lineNum))
    })
    
    for (let i = 0; i < lines.length - 2; i++) {
      if (usedLines.has(i)) continue
      
      // 3行パターン: 商品名 → コード → 価格+税区分
      const line1 = lines[i]?.trim()
      const line2 = lines[i + 1]?.trim()
      const line3 = lines[i + 2]?.trim()
      
      if (this.isLikelyProductName(line1)) {
        const codeMatch = line2?.match(/^(\d{5,7})$/)
        const priceMatch = line3?.match(/^([\d,]+)\s+([TE])$/)
        
        if (codeMatch && priceMatch) {
          const price = parseInt(priceMatch[1].replace(/,/g, ''))
          if (price >= 100 && price <= 15000) {
            console.log(`📦 3行パターン: ${line1} - ¥${price}`)
            
            items.push({
              name: this.normalizeCostcoProductName(line1),
              price: price,
              quantity: 1,
              confidence: 0.7,
              sourcePattern: 'costco-3line',
              lineNumbers: [i, i + 1, i + 2],
              rawText: `${line1} | ${line2} | ${line3}`,
              category: this.categorizeCostcoProduct(line1),
              metadata: {
                productCode: codeMatch[1],
                taxType: priceMatch[2],
                reducedTaxRate: priceMatch[2] === 'E'
              }
            })
            
            usedLines.add(i)
            usedLines.add(i + 1)
            usedLines.add(i + 2)
          }
        }
      }
    }
    
    return items
  }

  /**
   * 一般的な商品パターンの検出
   */
  private static findGenericItems(lines: string[], existingItems: ExtractedItem[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()
    
    existingItems.forEach(item => {
      item.lineNumbers?.forEach(lineNum => usedLines.add(lineNum))
    })
    
    // 価格から逆算して商品を探す
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      
      const line = lines[i].trim()
      const priceMatch = line.match(/^([\d,]+)\s+([TE])$/)
      
      if (priceMatch) {
        const price = parseInt(priceMatch[1].replace(/,/g, ''))
        if (price >= 200 && price <= 8000) {
          
          // 前の行で商品名を探す
          for (let j = Math.max(0, i - 3); j < i; j++) {
            if (usedLines.has(j)) continue
            
            const prevLine = lines[j].trim()
            if (this.isLikelyProductName(prevLine)) {
              console.log(`🔍 汎用パターン: ${prevLine} - ¥${price}`)
              
              items.push({
                name: this.normalizeCostcoProductName(prevLine),
                price: price,
                quantity: 1,
                confidence: 0.6,
                sourcePattern: 'costco-generic',
                lineNumbers: [j, i],
                rawText: `${prevLine} | ${line}`,
                category: this.categorizeCostcoProduct(prevLine),
                metadata: {
                  taxType: priceMatch[2],
                  reducedTaxRate: priceMatch[2] === 'E',
                  generic: true
                }
              })
              
              usedLines.add(j)
              usedLines.add(i)
              break
            }
          }
        }
      }
    }
    
    return items
  }

  /**
   * 商品名らしいかどうかの判定
   */
  private static isLikelyProductName(text: string): boolean {
    if (!text || text.length < 2 || text.length > 40) return false
    
    // 文字が含まれている
    if (!/[あ-んア-ンa-zA-Z]/.test(text)) return false
    
    // 除外パターン
    const excludePatterns = [
      /^\d+$/,                    // 数字のみ
      /^[\d,]+\s+[TE]$/,         // 価格パターン
      /^\d{5,7}$/,               // 商品コード
      /^\d+[個⚫°.]$/,           // 数量パターン
      /合計|小計|税|売上|対象額/, // 集計系
      /wholesale|biz|gold/i,     // Costcoヘッダー
      /receipt|total/i,          // レシート用語
      /^\d{4}年\d{1,2}月/        // 日付
    ]
    
    return !excludePatterns.some(pattern => pattern.test(text))
  }

  /**
   * Costco商品名の正規化
   */
  private static normalizeCostcoProductName(name: string): string {
    let normalized = name
    
    // OCR誤読の修正
    const ocrFixes = [
      { from: /⚫/g, to: '個' },
      { from: /°/g, to: '個' },
      { from: /ユ夕/g, to: 'ユタ' },
      { from: /X(\d)/g, to: '×$1' }
    ]
    
    ocrFixes.forEach(({ from, to }) => {
      normalized = normalized.replace(from, to)
    })
    
    // Costco特有の表記の統一
    const costcoNormalization = [
      { from: /KS /gi, to: 'カークランド ' },
      { from: /150GX12/gi, to: '150g×12個' },
      { from: /1LX2/gi, to: '1L×2本' },
      { from: /BATH TISSUE/gi, to: 'バスティッシュ' },
      { from: /PROSCIUTTO CRUDO/gi, to: 'プロシュート' }
    ]
    
    costcoNormalization.forEach(({ from, to }) => {
      normalized = normalized.replace(from, to)
    })
    
    return normalized.trim()
  }

  /**
   * Costco商品のカテゴリ分類
   */
  private static categorizeCostcoProduct(name: string): string {
    const lowerName = name.toLowerCase()
    
    const categories = [
      { keywords: ['ugg', 'シューズ', '靴'], category: '靴・アパレル' },
      { keywords: ['ヨーグルト', 'yogurt', '牛乳', 'milk'], category: '乳製品' },
      { keywords: ['スンドゥ', 'チゲ', '冷凍'], category: '冷凍食品' },
      { keywords: ['うずら', '卵', 'egg'], category: '卵・乳製品' },
      { keywords: ['prosciutto', 'ham', 'ハム', 'シュリンプ', 'shrimp'], category: '肉類・魚介類' },
      { keywords: ['グレープフルーツ', 'grapefruit', 'フルーツ'], category: '野菜・果物' },
      { keywords: ['tissue', 'ティッシュ', 'バス'], category: '日用品' },
      { keywords: ['リンネル', 'bag', 'バッグ'], category: '電子機器・バッグ' }
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
      const key = `${item.name}-${item.price}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}