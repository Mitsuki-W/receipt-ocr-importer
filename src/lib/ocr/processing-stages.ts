import { 
  OCRPatternConfig, 
  OCRParseResult, 
  ExtractedItem,
  ReceiptAnalysisContext
} from '@/types/ocr-patterns'

export interface ProcessingStage {
  name: string
  description: string
  execute: (context: ReceiptAnalysisContext, patterns: OCRPatternConfig[]) => Promise<OCRParseResult>
}

/**
 * OCR処理の段階的実行を管理するクラス
 */
export class ProcessingStageManager {
  private stages: ProcessingStage[] = []

  constructor() {
    this.initializeStages()
  }

  /**
   * すべての処理段階を取得
   */
  getStages(): ProcessingStage[] {
    return this.stages
  }

  private initializeStages() {
    this.stages = [
      {
        name: 'exact-pattern-matching',
        description: '厳密パターンマッチング',
        execute: this.exactPatternMatching.bind(this)
      },
      {
        name: 'flexible-pattern-matching',
        description: '柔軟パターンマッチング',
        execute: this.flexiblePatternMatching.bind(this)
      },
      {
        name: 'fuzzy-matching',
        description: 'ファジーマッチング',
        execute: this.fuzzyMatching.bind(this)
      },
      {
        name: 'ml-enhanced-matching',
        description: 'ML強化マッチング',
        execute: this.mlEnhancedMatching.bind(this)
      },
      {
        name: 'fallback-parsing',
        description: 'フォールバック処理',
        execute: this.fallbackParsing.bind(this)
      }
    ]
  }

  /**
   * 厳密パターンマッチング
   */
  private async exactPatternMatching(
    context: ReceiptAnalysisContext, 
    patterns: OCRPatternConfig[]
  ): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const exactPatterns = patterns.filter(p => p.priority === 'high')
    const patternsAttempted: string[] = []

    for (const pattern of exactPatterns) {
      if (pattern.patterns) {
        for (const patternRegex of pattern.patterns) {
          patternsAttempted.push(pattern.id)
          const matches = context.originalText.match(new RegExp(patternRegex.source, 'gm'))
          
          if (matches) {
            matches.forEach((match) => {
              const lineIndex = context.lines.findIndex(line => line.includes(match))
              if (lineIndex >= 0) {
                const extracted = this.extractItemFromMatch(match, pattern, lineIndex)
                if (extracted) {
                  items.push(extracted)
                }
              }
            })
          }
        }
      }
    }

    return {
      patternId: 'exact-matching',
      confidence: items.length > 0 ? 0.9 : 0.1,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted,
        fallbackUsed: false
      }
    }
  }

  /**
   * 柔軟パターンマッチング
   */
  private async flexiblePatternMatching(
    context: ReceiptAnalysisContext, 
    patterns: OCRPatternConfig[]
  ): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const flexiblePatterns = patterns.filter(p => p.priority === 'medium')
    const patternsAttempted: string[] = []

    for (const pattern of flexiblePatterns) {
      patternsAttempted.push(pattern.id)
      
      if (pattern.fuzzyPatterns) {
        for (const fuzzyPattern of pattern.fuzzyPatterns) {
          const regex = new RegExp(fuzzyPattern.pattern, 'gi')
          const matches = context.originalText.match(regex)
          
          if (matches) {
            matches.forEach((match) => {
              const lineIndex = context.lines.findIndex(line => line.includes(match))
              if (lineIndex >= 0) {
                const extracted = this.extractItemFromMatch(match, pattern, lineIndex)
                if (extracted) {
                  extracted.confidence *= fuzzyPattern.confidence
                  items.push(extracted)
                }
              }
            })
          }
        }
      }
    }

    return {
      patternId: 'flexible-matching',
      confidence: items.length > 0 ? 0.7 : 0.1,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted,
        fallbackUsed: false
      }
    }
  }

  /**
   * ファジーマッチング
   */
  private async fuzzyMatching(
    context: ReceiptAnalysisContext, 
    _patterns: OCRPatternConfig[]
  ): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const patternsAttempted: string[] = []

    // 価格パターンベースの抽出
    const pricePattern = /(.+?)\s*[\s¥$]\s*(\d{1,6}(?:[.,]\d{2})?)\s*$/gm
    let match

    while ((match = pricePattern.exec(context.originalText)) !== null) {
      const [fullMatch, nameCandidate, priceStr] = match
      const lineIndex = context.lines.findIndex(line => line.includes(fullMatch))
      
      if (lineIndex >= 0 && nameCandidate.trim().length >= 2) {
        const price = parseFloat(priceStr.replace(/[,¥$]/g, ''))
        const currency = this.detectCurrency(context.originalText)
        
        items.push({
          name: this.cleanItemName(nameCandidate),
          price,
          currency,
          confidence: 0.5,
          sourcePattern: 'fuzzy-price',
          lineNumbers: [lineIndex],
          rawText: fullMatch.trim(),
          quantity: 1
        })
      }
    }

    patternsAttempted.push('fuzzy-price-pattern')

    return {
      patternId: 'fuzzy-matching',
      confidence: items.length > 0 ? 0.5 : 0.1,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted,
        fallbackUsed: false
      }
    }
  }

  /**
   * ML強化マッチング
   */
  private async mlEnhancedMatching(
    context: ReceiptAnalysisContext, 
    _patterns: OCRPatternConfig[]
  ): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const patternsAttempted: string[] = ['ml-enhanced']

    // 機械学習ベースの抽出（簡易版）
    const lines = context.lines
    const currency = this.detectCurrency(context.originalText)
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 商品名と価格の分離を試行
      const scoreResult = this.scoreLineAsProduct(line)
      
      if (scoreResult.score > 0.3) {
        items.push({
          name: scoreResult.name,
          price: scoreResult.price,
          currency,
          confidence: scoreResult.score,
          sourcePattern: 'ml-enhanced',
          lineNumbers: [i],
          rawText: line,
          quantity: scoreResult.quantity || 1
        })
      }
    }

    return {
      patternId: 'ml-enhanced',
      confidence: items.length > 0 ? 0.6 : 0.1,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted,
        fallbackUsed: false
      }
    }
  }

  /**
   * フォールバック処理
   */
  private async fallbackParsing(
    context: ReceiptAnalysisContext, 
    _patterns: OCRPatternConfig[]
  ): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const currency = this.detectCurrency(context.originalText)
    
    // 基本的な価格パターン
    const basicPattern = /(.{2,50}?)\s+(\d{2,6})\s*$/
    
    context.lines.forEach((line, index) => {
      const match = line.match(basicPattern)
      if (match) {
        const [, name, priceStr] = match
        const price = parseInt(priceStr)
        
        if (price >= 1 && price <= 99999) {
          items.push({
            name: this.cleanItemName(name),
            price,
            currency,
            confidence: 0.3,
            sourcePattern: 'fallback',
            lineNumbers: [index],
            rawText: line,
            quantity: 1
          })
        }
      }
    })

    return {
      patternId: 'fallback',
      confidence: 0.3,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted: ['fallback'],
        fallbackUsed: true
      }
    }
  }

  /**
   * マッチからアイテムを抽出
   */
  private extractItemFromMatch(
    match: string, 
    pattern: OCRPatternConfig, 
    lineIndex: number
  ): ExtractedItem | null {
    // 価格を抽出
    const priceMatch = match.match(/(\d{1,6}(?:[.,]\d{2})?)/)
    if (!priceMatch) return null

    const price = parseFloat(priceMatch[1].replace(/[,]/g, ''))
    
    // 商品名を抽出
    const name = match.replace(/[\d.,¥$\s]+$/, '').trim()
    if (name.length < 2) return null

    const currency = this.detectCurrency(match)

    return {
      name: this.cleanItemName(name),
      price,
      currency,
      confidence: pattern.confidence || 0.7,
      sourcePattern: pattern.id,
      lineNumbers: [lineIndex],
      rawText: match,
      quantity: 1
    }
  }

  /**
   * 行を商品として評価
   */
  private scoreLineAsProduct(line: string): {
    score: number
    name: string
    price: number
    quantity?: number
  } {
    let score = 0
    let name = ''
    let price = 0
    let quantity = 1

    // 価格パターンの検出
    const pricePattern = /(\d{1,6}(?:[.,]\d{2})?)/
    const priceMatch = line.match(pricePattern)
    
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/[,]/g, ''))
      score += 0.3
      
      // 商品名部分を抽出
      name = line.replace(pricePattern, '').replace(/[¥$\s]+/g, ' ').trim()
      
      if (name.length >= 2 && name.length <= 50) {
        score += 0.2
      }
      
      // 価格の妥当性チェック
      if (price >= 1 && price <= 99999) {
        score += 0.2
      }
      
      // 商品名らしさの判定
      if (this.looksLikeProductName(name)) {
        score += 0.3
      }
    }

    return { score, name, price, quantity }
  }

  /**
   * 商品名らしさの判定
   */
  private looksLikeProductName(name: string): boolean {
    // 日本語文字が含まれている
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name)) return true
    
    // 英数字の商品名パターン
    if (/^[A-Za-z0-9\s\-'&.]+$/.test(name) && name.length >= 3) return true
    
    return false
  }

  /**
   * 通貨の検出
   */
  private detectCurrency(text: string): 'JPY' | 'USD' {
    if (text.includes('¥') || text.includes('円')) return 'JPY'
    if (text.includes('$') || text.includes('USD')) return 'USD'
    
    const englishPatterns = [
      /\b(total|subtotal|tax|item|price|amount|receipt|store|thank you)\b/i,
      /\b(walmart|target|cvs|walgreens|safeway|kroger|costco)\b/i
    ]
    
    const hasEnglishFeatures = englishPatterns.some(pattern => pattern.test(text))
    const hasDollarPricing = /\b\d+\.\d{2}\b/.test(text)
    
    if (hasEnglishFeatures || hasDollarPricing) {
      return 'USD'
    }
    
    return 'JPY'
  }

  /**
   * 商品名のクリーンアップ
   */
  private cleanItemName(name: string): string {
    return name
      .replace(/^[*\s]+/, '')
      .replace(/[*\s]+$/, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
}