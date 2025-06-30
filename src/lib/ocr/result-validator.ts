import { ExtractedItem } from '@/types/ocr-patterns'

export interface ValidationResult {
  isValid: boolean
  confidence: number
  issues: ValidationIssue[]
  suggestions: ValidationSuggestion[]
  correctedItem?: ExtractedItem
}

export interface ValidationIssue {
  type: 'price' | 'name' | 'quantity' | 'format' | 'duplicate'
  severity: 'error' | 'warning' | 'info'
  message: string
  field: string
  originalValue: any
  suggestedValue?: any
}

export interface ValidationSuggestion {
  type: 'correction' | 'enhancement' | 'alternative'
  message: string
  action: string
  newValue: any
  confidence: number
}

export interface ValidationRule {
  name: string
  description: string
  validator: (item: ExtractedItem, context?: ValidationContext) => ValidationResult
  priority: number
  enabled: boolean
}

export interface ValidationContext {
  allItems: ExtractedItem[]
  originalText: string
  detectedStore?: string
  priceStatistics?: {
    min: number
    max: number
    avg: number
    median: number
  }
}

export class OCRResultValidator {
  private validationRules: ValidationRule[] = []
  private pricePatterns: Map<string, RegExp> = new Map()
  private namePatterns: Map<string, RegExp> = new Map()

  constructor() {
    this.initializeValidationRules()
    this.initializePatterns()
  }

  /**
   * 単一アイテムの検証
   */
  validateItem(item: ExtractedItem, context?: ValidationContext): ValidationResult {
    const issues: ValidationIssue[] = []
    const suggestions: ValidationSuggestion[] = []
    let overallConfidence = item.confidence
    let correctedItem: ExtractedItem | undefined

    // 全ての検証ルールを実行
    for (const rule of this.validationRules) {
      if (!rule.enabled) continue

      try {
        const ruleResult = rule.validator(item, context)
        issues.push(...ruleResult.issues)
        suggestions.push(...ruleResult.suggestions)

        // 信頼度の調整
        if (ruleResult.confidence < overallConfidence) {
          overallConfidence = ruleResult.confidence
        }

        // 修正提案があれば採用
        if (ruleResult.correctedItem && !correctedItem) {
          correctedItem = ruleResult.correctedItem
        }
      } catch (error) {
        console.warn(`Validation rule ${rule.name} failed:`, error)
      }
    }

    // エラーレベルの問題があれば無効とする
    const hasErrors = issues.some(issue => issue.severity === 'error')

    return {
      isValid: !hasErrors,
      confidence: overallConfidence,
      issues,
      suggestions,
      correctedItem
    }
  }

  /**
   * 複数アイテムの一括検証
   */
  validateItems(items: ExtractedItem[], originalText: string, detectedStore?: string): {
    results: Map<number, ValidationResult>
    globalIssues: ValidationIssue[]
    globalSuggestions: ValidationSuggestion[]
    correctedItems: ExtractedItem[]
  } {
    const results = new Map<number, ValidationResult>()
    const globalIssues: ValidationIssue[] = []
    const globalSuggestions: ValidationSuggestion[] = []
    const correctedItems: ExtractedItem[] = []

    // 価格統計の計算
    const priceStatistics = this.calculatePriceStatistics(items)
    const context: ValidationContext = {
      allItems: items,
      originalText,
      detectedStore,
      priceStatistics
    }

    // 個別アイテム検証
    items.forEach((item, index) => {
      const validation = this.validateItem(item, context)
      results.set(index, validation)

      if (validation.correctedItem) {
        correctedItems.push(validation.correctedItem)
      } else {
        correctedItems.push(item)
      }
    })

    // グローバル検証（重複チェックなど）
    const globalValidation = this.performGlobalValidation(items, context)
    globalIssues.push(...globalValidation.issues)
    globalSuggestions.push(...globalValidation.suggestions)

    return {
      results,
      globalIssues,
      globalSuggestions,
      correctedItems
    }
  }

  /**
   * 自動修正の実行
   */
  autoCorrectItems(items: ExtractedItem[], originalText: string, detectedStore?: string): {
    correctedItems: ExtractedItem[]
    corrections: Array<{
      index: number
      field: string
      originalValue: any
      correctedValue: any
      confidence: number
      reason: string
    }>
  } {
    const corrections: Array<{
      index: number
      field: string
      originalValue: any
      correctedValue: any
      confidence: number
      reason: string
    }> = []

    const correctedItems = items.map((item, index) => {
      let corrected = { ...item }

      // 価格の自動修正
      const priceCorrection = this.autoCorrectPrice(item)
      if (priceCorrection) {
        corrections.push({
          index,
          field: 'price',
          originalValue: item.price,
          correctedValue: priceCorrection.value,
          confidence: priceCorrection.confidence,
          reason: priceCorrection.reason
        })
        corrected.price = priceCorrection.value
      }

      // 商品名の自動修正
      const nameCorrection = this.autoCorrectName(item)
      if (nameCorrection) {
        corrections.push({
          index,
          field: 'name',
          originalValue: item.name,
          correctedValue: nameCorrection.value,
          confidence: nameCorrection.confidence,
          reason: nameCorrection.reason
        })
        corrected.name = nameCorrection.value
      }

      // 数量の自動修正
      const quantityCorrection = this.autoCorrectQuantity(item)
      if (quantityCorrection) {
        corrections.push({
          index,
          field: 'quantity',
          originalValue: item.quantity,
          correctedValue: quantityCorrection.value,
          confidence: quantityCorrection.confidence,
          reason: quantityCorrection.reason
        })
        corrected.quantity = quantityCorrection.value
      }

      return corrected
    })

    return { correctedItems, corrections }
  }

  /**
   * 検証ルールの初期化
   */
  private initializeValidationRules() {
    this.validationRules = [
      {
        name: 'price-validation',
        description: '価格の妥当性検証',
        validator: this.validatePrice.bind(this),
        priority: 10,
        enabled: true
      },
      {
        name: 'name-validation',
        description: '商品名の妥当性検証',
        validator: this.validateName.bind(this),
        priority: 9,
        enabled: true
      },
      {
        name: 'quantity-validation',
        description: '数量の妥当性検証',
        validator: this.validateQuantity.bind(this),
        priority: 8,
        enabled: true
      },
      {
        name: 'format-validation',
        description: 'フォーマットの妥当性検証',
        validator: this.validateFormat.bind(this),
        priority: 7,
        enabled: true
      },
      {
        name: 'context-validation',
        description: 'コンテキストによる検証',
        validator: this.validateContext.bind(this),
        priority: 6,
        enabled: true
      }
    ]
  }

  /**
   * 価格検証
   */
  private validatePrice(item: ExtractedItem, context?: ValidationContext): ValidationResult {
    const issues: ValidationIssue[] = []
    const suggestions: ValidationSuggestion[] = []
    let confidence = item.confidence

    // 基本的な価格チェック
    if (!item.price || item.price <= 0) {
      issues.push({
        type: 'price',
        severity: 'error',
        message: '価格が設定されていないか、無効な値です',
        field: 'price',
        originalValue: item.price,
        suggestedValue: this.extractPriceFromText(item.rawText)
      })
      confidence *= 0.3
    } else if (item.price > 100000) {
      issues.push({
        type: 'price',
        severity: 'warning',
        message: '価格が異常に高額です',
        field: 'price',
        originalValue: item.price
      })
      confidence *= 0.6
    } else if (item.price < 10) {
      issues.push({
        type: 'price',
        severity: 'warning',
        message: '価格が異常に安価です',
        field: 'price',
        originalValue: item.price
      })
      confidence *= 0.8
    }

    // コンテキストによる価格チェック
    if (context?.priceStatistics) {
      const stats = context.priceStatistics
      if (item.price && item.price > stats.avg * 5) {
        suggestions.push({
          type: 'correction',
          message: '他の商品と比べて価格が高すぎる可能性があります',
          action: 'price-review',
          newValue: Math.round(stats.avg),
          confidence: 0.4
        })
      }
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      confidence,
      issues,
      suggestions
    }
  }

  /**
   * 商品名検証
   */
  private validateName(item: ExtractedItem, context?: ValidationContext): ValidationResult {
    const issues: ValidationIssue[] = []
    const suggestions: ValidationSuggestion[] = []
    let confidence = item.confidence

    // 基本的な商品名チェック
    if (!item.name || item.name.trim().length === 0) {
      issues.push({
        type: 'name',
        severity: 'error',
        message: '商品名が空です',
        field: 'name',
        originalValue: item.name
      })
      confidence *= 0.2
    } else if (item.name.length < 2) {
      issues.push({
        type: 'name',
        severity: 'warning',
        message: '商品名が短すぎます',
        field: 'name',
        originalValue: item.name
      })
      confidence *= 0.6
    } else if (item.name.length > 50) {
      issues.push({
        type: 'name',
        severity: 'warning',
        message: '商品名が長すぎます',
        field: 'name',
        originalValue: item.name,
        suggestedValue: item.name.substring(0, 50)
      })
      confidence *= 0.7
    }

    // パターンベースチェック
    if (/^\d+$/.test(item.name)) {
      issues.push({
        type: 'name',
        severity: 'error',
        message: '商品名が数字のみです',
        field: 'name',
        originalValue: item.name
      })
      confidence *= 0.3
    }

    if (/^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(item.name)) {
      issues.push({
        type: 'name',
        severity: 'error',
        message: '商品名が記号のみです',
        field: 'name',
        originalValue: item.name
      })
      confidence *= 0.3
    }

    // 商品名クリーンアップの提案
    const cleanedName = this.cleanupName(item.name)
    if (cleanedName !== item.name) {
      suggestions.push({
        type: 'enhancement',
        message: '商品名をクリーンアップできます',
        action: 'cleanup-name',
        newValue: cleanedName,
        confidence: 0.8
      })
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      confidence,
      issues,
      suggestions
    }
  }

  /**
   * 数量検証
   */
  private validateQuantity(item: ExtractedItem, context?: ValidationContext): ValidationResult {
    const issues: ValidationIssue[] = []
    const suggestions: ValidationSuggestion[] = []
    let confidence = item.confidence

    if (item.quantity !== undefined) {
      if (item.quantity <= 0) {
        issues.push({
          type: 'quantity',
          severity: 'error',
          message: '数量が0以下です',
          field: 'quantity',
          originalValue: item.quantity,
          suggestedValue: 1
        })
        confidence *= 0.5
      } else if (item.quantity > 100) {
        issues.push({
          type: 'quantity',
          severity: 'warning',
          message: '数量が異常に多いです',
          field: 'quantity',
          originalValue: item.quantity
        })
        confidence *= 0.7
      }
    } else {
      // 数量が未設定の場合のデフォルト提案
      suggestions.push({
        type: 'enhancement',
        message: '数量が設定されていません',
        action: 'set-default-quantity',
        newValue: 1,
        confidence: 0.9
      })
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      confidence,
      issues,
      suggestions
    }
  }

  /**
   * フォーマット検証
   */
  private validateFormat(item: ExtractedItem, context?: ValidationContext): ValidationResult {
    const issues: ValidationIssue[] = []
    const suggestions: ValidationSuggestion[] = []
    let confidence = item.confidence

    // 価格と商品名の整合性チェック
    if (item.rawText && item.name && item.price) {
      // 商品名に価格が含まれているかチェック
      const priceInName = item.name.match(/(\d+)\s*[円¥]/)?.[1]
      if (priceInName && parseInt(priceInName) !== item.price) {
        issues.push({
          type: 'format',
          severity: 'warning',
          message: '商品名に含まれる価格と抽出された価格が一致しません',
          field: 'consistency',
          originalValue: { name: item.name, price: item.price }
        })
        confidence *= 0.8
      }
    }

    // ソースパターンの信頼性チェック
    if (item.sourcePattern === 'fallback') {
      suggestions.push({
        type: 'alternative',
        message: 'フォールバック処理で抽出されました。手動確認を推奨します',
        action: 'manual-review',
        newValue: null,
        confidence: 0.3
      })
      confidence *= 0.9
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      confidence,
      issues,
      suggestions
    }
  }

  /**
   * コンテキスト検証
   */
  private validateContext(item: ExtractedItem, context?: ValidationContext): ValidationResult {
    const issues: ValidationIssue[] = []
    const suggestions: ValidationSuggestion[] = []
    let confidence = item.confidence

    if (context?.allItems) {
      // 重複チェック
      const duplicates = context.allItems.filter(other => 
        other !== item && 
        other.name.toLowerCase() === item.name.toLowerCase() &&
        Math.abs((other.price || 0) - (item.price || 0)) < 10
      )

      if (duplicates.length > 0) {
        issues.push({
          type: 'duplicate',
          severity: 'warning',
          message: '同じような商品が複数検出されています',
          field: 'duplicate',
          originalValue: item.name
        })
        confidence *= 0.8
      }
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      confidence,
      issues,
      suggestions
    }
  }

  /**
   * グローバル検証
   */
  private performGlobalValidation(items: ExtractedItem[], context: ValidationContext): {
    issues: ValidationIssue[]
    suggestions: ValidationSuggestion[]
  } {
    const issues: ValidationIssue[] = []
    const suggestions: ValidationSuggestion[] = []

    // 検出商品数の妥当性
    if (items.length === 0) {
      issues.push({
        type: 'format',
        severity: 'error',
        message: '商品が検出されませんでした',
        field: 'global',
        originalValue: items.length
      })
    } else if (items.length > 50) {
      issues.push({
        type: 'format',
        severity: 'warning',
        message: '検出商品数が異常に多いです',
        field: 'global',
        originalValue: items.length
      })
    }

    // 価格の分布チェック
    const pricesWithValues = items.filter(item => item.price && item.price > 0)
    if (pricesWithValues.length < items.length * 0.5) {
      suggestions.push({
        type: 'enhancement',
        message: '価格が検出されていない商品が多数あります',
        action: 'review-price-extraction',
        newValue: null,
        confidence: 0.6
      })
    }

    return { issues, suggestions }
  }

  /**
   * ヘルパーメソッド
   */
  private calculatePriceStatistics(items: ExtractedItem[]) {
    const prices = items
      .map(item => item.price)
      .filter((price): price is number => price !== undefined && price > 0)

    if (prices.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0 }
    }

    const sorted = prices.sort((a, b) => a - b)
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      median: sorted[Math.floor(sorted.length / 2)]
    }
  }

  private extractPriceFromText(text?: string): number | undefined {
    if (!text) return undefined
    const match = text.match(/(\d{2,5})/)?.[1]
    return match ? parseInt(match) : undefined
  }

  private cleanupName(name: string): string {
    return name
      .replace(/^[*\s]+/, '')
      .replace(/[*\s]+$/, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private autoCorrectPrice(item: ExtractedItem): { value: number; confidence: number; reason: string } | null {
    // 価格の自動修正ロジック
    if (!item.price || item.price <= 0) {
      const extractedPrice = this.extractPriceFromText(item.rawText)
      if (extractedPrice && extractedPrice > 0 && extractedPrice <= 99999) {
        return {
          value: extractedPrice,
          confidence: 0.7,
          reason: 'rawTextから価格を再抽出'
        }
      }
    }
    return null
  }

  private autoCorrectName(item: ExtractedItem): { value: string; confidence: number; reason: string } | null {
    const cleaned = this.cleanupName(item.name)
    if (cleaned !== item.name && cleaned.length >= 2) {
      return {
        value: cleaned,
        confidence: 0.8,
        reason: '商品名のクリーンアップ'
      }
    }
    return null
  }

  private autoCorrectQuantity(item: ExtractedItem): { value: number; confidence: number; reason: string } | null {
    if (!item.quantity || item.quantity <= 0) {
      return {
        value: 1,
        confidence: 0.9,
        reason: 'デフォルト数量の設定'
      }
    }
    return null
  }

  private initializePatterns() {
    // パターンの初期化（必要に応じて実装）
  }
}