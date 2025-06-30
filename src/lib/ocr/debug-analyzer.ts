import { OCRParseResult, ExtractedItem, OCRPatternConfig } from '@/types/ocr-patterns'

export interface DebugAnalysis {
  textAnalysis: {
    totalLines: number
    nonEmptyLines: number
    avgLineLength: number
    hasJapanese: boolean
    hasNumbers: boolean
    hasSpecialChars: boolean
    suspiciousLines: string[]
    priceLines: string[]
    itemLines: string[]
  }
  patternAnalysis: {
    storeDetection: {
      detectedStore: string | null
      confidence: number
      matchedKeywords: string[]
      allCandidates: Array<{store: string, score: number}>
    }
    patternMatches: Array<{
      patternId: string
      matchCount: number
      avgConfidence: number
      successfulMatches: string[]
      failedAttempts: string[]
    }>
  }
  resultAnalysis: {
    totalItems: number
    itemsWithPrice: number
    itemsWithQuantity: number
    avgItemConfidence: number
    suspiciousItems: ExtractedItem[]
    qualityScore: number
    suggestions: string[]
  }
  performanceMetrics: {
    processingTime: number
    memoryUsage?: number
    cacheHits: number
    cacheMisses: number
  }
}

export class OCRDebugAnalyzer {
  
  /**
   * OCR結果の詳細分析を実行
   */
  static analyzeOCRResult(
    originalText: string,
    result: OCRParseResult,
    patterns: OCRPatternConfig[]
  ): DebugAnalysis {
    
    const textAnalysis = this.analyzeText(originalText)
    const patternAnalysis = this.analyzePatterns(originalText, result, patterns)
    const resultAnalysis = this.analyzeResults(result)
    const performanceMetrics = this.analyzePerformance(result)

    return {
      textAnalysis,
      patternAnalysis,
      resultAnalysis,
      performanceMetrics
    }
  }

  /**
   * テキスト内容の詳細分析
   */
  private static analyzeText(text: string) {
    const lines = text.split('\n')
    const nonEmptyLines = lines.filter(line => line.trim())
    
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
    const hasNumbers = /\d/.test(text)
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(text)
    
    // 怪しい行の検出
    const suspiciousLines = nonEmptyLines.filter(line => {
      const trimmed = line.trim()
      return (
        trimmed.length > 100 || // 長すぎる行
        trimmed.length < 2 ||   // 短すぎる行
        /^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(trimmed) || // 記号のみ
        (trimmed.match(/\d/g) || []).length > trimmed.length * 0.8 // 数字が多すぎる
      )
    })

    // 価格らしい行の検出
    const priceLines = nonEmptyLines.filter(line => {
      return /\d{2,5}\s*[円¥]?$/.test(line.trim()) || 
             /¥\s*\d{2,5}/.test(line.trim()) ||
             /\d+\*\s*$/.test(line.trim())
    })

    // 商品名らしい行の検出
    const itemLines = nonEmptyLines.filter(line => {
      const trimmed = line.trim()
      return trimmed.length >= 2 && 
             trimmed.length <= 50 &&
             !/^\d+$/.test(trimmed) &&
             !/^[¥\d\s\-*]+$/.test(trimmed) &&
             hasJapanese ? /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(trimmed) : true
    })

    return {
      totalLines: lines.length,
      nonEmptyLines: nonEmptyLines.length,
      avgLineLength: nonEmptyLines.reduce((sum, line) => sum + line.length, 0) / nonEmptyLines.length,
      hasJapanese,
      hasNumbers,
      hasSpecialChars,
      suspiciousLines,
      priceLines,
      itemLines
    }
  }

  /**
   * パターンマッチング分析
   */
  private static analyzePatterns(
    text: string, 
    result: OCRParseResult, 
    patterns: OCRPatternConfig[]
  ) {
    // 店舗検出分析
    const storeDetection = this.analyzeStoreDetection(text)
    
    // パターンマッチング分析
    const patternMatches = patterns.map(pattern => {
      const matches = this.testPatternAgainstText(text, pattern)
      return {
        patternId: pattern.id,
        matchCount: matches.successful.length,
        avgConfidence: matches.avgConfidence,
        successfulMatches: matches.successful,
        failedAttempts: matches.failed
      }
    })

    return {
      storeDetection,
      patternMatches
    }
  }

  /**
   * 店舗検出の詳細分析
   */
  private static analyzeStoreDetection(text: string) {
    const normalizedText = text.toLowerCase()
    
    const storePatterns = {
      'warehouse': ['warehouse', 'wholesale', '大型店', 'コストコ', 'costco'],
      'supermarket-a': ['スーパーa', 'super-a', 'ライフ', 'life'],
      'supermarket-b': ['スーパーb', 'super-b', 'イオン', 'aeon'],
      'convenience-a': ['コンビニa', 'convenience-a', 'セブン', 'seven'],
      'convenience-b': ['コンビニb', 'convenience-b', 'ファミマ', 'family']
    }

    const candidates: Array<{store: string, score: number}> = []
    let detectedStore: string | null = null
    let bestScore = 0
    const matchedKeywords: string[] = []

    for (const [storeId, keywords] of Object.entries(storePatterns)) {
      let score = 0
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          score += 1
          matchedKeywords.push(keyword)
        }
      }
      
      if (score > 0) {
        candidates.push({ store: storeId, score })
        if (score > bestScore) {
          bestScore = score
          detectedStore = storeId
        }
      }
    }

    return {
      detectedStore,
      confidence: bestScore / Math.max(...Object.values(storePatterns).map(arr => arr.length)),
      matchedKeywords,
      allCandidates: candidates.sort((a, b) => b.score - a.score)
    }
  }

  /**
   * パターンのテスト実行
   */
  private static testPatternAgainstText(text: string, pattern: OCRPatternConfig) {
    const lines = text.split('\n').filter(line => line.trim())
    const successful: string[] = []
    const failed: string[] = []
    let totalConfidence = 0
    let matchCount = 0

    // 単行パターンのテスト
    if (pattern.patterns) {
      for (const patternRule of pattern.patterns) {
        try {
          const regex = new RegExp(patternRule.regex, 'i')
          for (const line of lines) {
            const match = line.match(regex)
            if (match) {
              successful.push(`${patternRule.name}: ${line}`)
              totalConfidence += patternRule.confidence || 0.5
              matchCount++
            }
          }
        } catch (error) {
          failed.push(`Regex error in ${patternRule.name}: ${error}`)
        }
      }
    }

    // 複数行パターンのテスト
    if (pattern.multiLinePatterns) {
      for (const multiPattern of pattern.multiLinePatterns) {
        try {
          // 複数行パターンの簡易テスト
          for (let i = 0; i < lines.length - (multiPattern.lineCount || 1); i++) {
            const testLines = lines.slice(i, i + (multiPattern.lineCount || 1))
            // ここで実際のパターンマッチングをシミュレート
            if (this.testMultiLinePattern(testLines, multiPattern)) {
              successful.push(`${multiPattern.name}: ${testLines.join(' | ')}`)
              totalConfidence += multiPattern.confidence || 0.5
              matchCount++
            }
          }
        } catch (error) {
          failed.push(`Multi-line pattern error in ${multiPattern.name}: ${error}`)
        }
      }
    }

    return {
      successful,
      failed,
      avgConfidence: matchCount > 0 ? totalConfidence / matchCount : 0
    }
  }

  /**
   * 複数行パターンの簡易テスト
   */
  private static testMultiLinePattern(lines: string[], pattern: any): boolean {
    // 簡易的なテスト実装
    if (lines.length < (pattern.lineCount || 1)) return false
    
    // 価格らしいパターンが含まれているか
    const hasPrice = lines.some(line => /\d{2,5}/.test(line))
    // 商品名らしいパターンが含まれているか
    const hasItem = lines.some(line => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(line) && line.length >= 2)
    
    return hasPrice && hasItem
  }

  /**
   * 結果の品質分析
   */
  private static analyzeResults(result: OCRParseResult) {
    const items = result.items
    const totalItems = items.length
    const itemsWithPrice = items.filter(item => item.price && item.price > 0).length
    const itemsWithQuantity = items.filter(item => item.quantity && item.quantity > 0).length
    
    const avgItemConfidence = totalItems > 0 
      ? items.reduce((sum, item) => sum + item.confidence, 0) / totalItems 
      : 0

    // 怪しいアイテムの検出
    const suspiciousItems = items.filter(item => {
      return (
        !item.price || item.price <= 0 || item.price > 99999 ||
        !item.name || item.name.length < 2 || item.name.length > 50 ||
        item.confidence < 0.2 ||
        /^\d+$/.test(item.name) ||
        /^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(item.name)
      )
    })

    // 品質スコアの計算
    const qualityScore = this.calculateQualityScore(items, result.confidence)

    // 改善提案の生成
    const suggestions = this.generateSuggestions(items, result, suspiciousItems)

    return {
      totalItems,
      itemsWithPrice,
      itemsWithQuantity,
      avgItemConfidence,
      suspiciousItems,
      qualityScore,
      suggestions
    }
  }

  /**
   * 品質スコアの計算
   */
  private static calculateQualityScore(items: ExtractedItem[], overallConfidence: number): number {
    if (items.length === 0) return 0

    const priceValidityScore = items.filter(item => 
      item.price && item.price > 0 && item.price <= 99999
    ).length / items.length

    const nameValidityScore = items.filter(item => 
      item.name && item.name.length >= 2 && item.name.length <= 50 &&
      !/^\d+$/.test(item.name)
    ).length / items.length

    const confidenceScore = overallConfidence

    return (priceValidityScore * 0.4 + nameValidityScore * 0.4 + confidenceScore * 0.2)
  }

  /**
   * 改善提案の生成
   */
  private static generateSuggestions(
    items: ExtractedItem[], 
    result: OCRParseResult, 
    suspiciousItems: ExtractedItem[]
  ): string[] {
    const suggestions: string[] = []

    if (items.length === 0) {
      suggestions.push('商品が検出されませんでした。画像の品質を確認してください。')
    }

    if (suspiciousItems.length > items.length * 0.3) {
      suggestions.push('不正な商品データが多数検出されました。OCRパターンの調整が必要です。')
    }

    const itemsWithoutPrice = items.filter(item => !item.price || item.price <= 0)
    if (itemsWithoutPrice.length > items.length * 0.5) {
      suggestions.push('価格が検出されていない商品が多すぎます。価格パターンの改善が必要です。')
    }

    if (result.confidence < 0.5) {
      suggestions.push('全体的な信頼度が低いです。店舗認識パターンの改善を推奨します。')
    }

    if (result.metadata.fallbackUsed) {
      suggestions.push('フォールバック処理が使用されました。専用パターンの追加を検討してください。')
    }

    return suggestions
  }

  /**
   * パフォーマンス分析
   */
  private static analyzePerformance(result: OCRParseResult) {
    return {
      processingTime: result.metadata.processingTime || 0,
      cacheHits: 0, // 実装時に追加
      cacheMisses: 0 // 実装時に追加
    }
  }

  /**
   * 詳細なデバッグレポートを生成
   */
  static generateDebugReport(analysis: DebugAnalysis): string {
    const report = []
    
    report.push('=== OCR デバッグレポート ===\n')
    
    // テキスト分析
    report.push('📄 テキスト分析:')
    report.push(`  - 総行数: ${analysis.textAnalysis.totalLines}`)
    report.push(`  - 有効行数: ${analysis.textAnalysis.nonEmptyLines}`)
    report.push(`  - 平均行長: ${analysis.textAnalysis.avgLineLength.toFixed(1)}文字`)
    report.push(`  - 日本語: ${analysis.textAnalysis.hasJapanese ? 'あり' : 'なし'}`)
    report.push(`  - 価格行数: ${analysis.textAnalysis.priceLines.length}`)
    report.push(`  - 商品行数: ${analysis.textAnalysis.itemLines.length}`)
    if (analysis.textAnalysis.suspiciousLines.length > 0) {
      report.push(`  - 怪しい行: ${analysis.textAnalysis.suspiciousLines.length}件`)
    }
    report.push('')

    // 店舗検出
    report.push('🏪 店舗検出:')
    report.push(`  - 検出結果: ${analysis.patternAnalysis.storeDetection.detectedStore || '不明'}`)
    report.push(`  - 信頼度: ${(analysis.patternAnalysis.storeDetection.confidence * 100).toFixed(1)}%`)
    if (analysis.patternAnalysis.storeDetection.matchedKeywords.length > 0) {
      report.push(`  - マッチキーワード: ${analysis.patternAnalysis.storeDetection.matchedKeywords.join(', ')}`)
    }
    report.push('')

    // 結果分析
    report.push('📊 結果分析:')
    report.push(`  - 検出商品数: ${analysis.resultAnalysis.totalItems}`)
    report.push(`  - 価格あり: ${analysis.resultAnalysis.itemsWithPrice}/${analysis.resultAnalysis.totalItems}`)
    report.push(`  - 平均信頼度: ${(analysis.resultAnalysis.avgItemConfidence * 100).toFixed(1)}%`)
    report.push(`  - 品質スコア: ${(analysis.resultAnalysis.qualityScore * 100).toFixed(1)}%`)
    if (analysis.resultAnalysis.suspiciousItems.length > 0) {
      report.push(`  - 怪しい商品: ${analysis.resultAnalysis.suspiciousItems.length}件`)
    }
    report.push('')

    // 改善提案
    if (analysis.resultAnalysis.suggestions.length > 0) {
      report.push('💡 改善提案:')
      analysis.resultAnalysis.suggestions.forEach(suggestion => {
        report.push(`  - ${suggestion}`)
      })
      report.push('')
    }

    // パフォーマンス
    report.push('⚡ パフォーマンス:')
    report.push(`  - 処理時間: ${analysis.performanceMetrics.processingTime}ms`)
    
    return report.join('\n')
  }
}