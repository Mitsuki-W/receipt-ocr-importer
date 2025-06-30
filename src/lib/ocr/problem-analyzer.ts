import { ExtractedItem } from '@/types/ocr-patterns'

export interface ProblemAnalysis {
  duplicates: {
    items: ExtractedItem[]
    groups: Array<{
      pattern: string
      items: ExtractedItem[]
      confidence: number
    }>
  }
  invalidItems: {
    regNumbers: ExtractedItem[]        // レジ番号など
    priceInName: ExtractedItem[]       // 商品名に価格が含まれる
    noPrice: ExtractedItem[]           // 価格がない
    suspiciousNames: ExtractedItem[]   // 怪しい商品名
    tooLong: ExtractedItem[]          // 長すぎる商品名
    tooShort: ExtractedItem[]         // 短すぎる商品名
  }
  textProblems: {
    originalLines: string[]
    suspiciousLines: string[]
    priceLines: string[]
    metadataLines: string[]           // 日付、店舗情報など
    unrecognizedLines: string[]
  }
  suggestions: {
    category: 'critical' | 'important' | 'minor'
    problem: string
    solution: string
    code?: string
  }[]
}

export class OCRProblemAnalyzer {
  
  /**
   * OCR結果の問題を詳細分析
   */
  static analyzeProblem(
    extractedText: string,
    items: ExtractedItem[]
  ): ProblemAnalysis {
    
    const lines = extractedText.split('\n').filter(line => line.trim())
    
    return {
      duplicates: this.findDuplicates(items),
      invalidItems: this.findInvalidItems(items),
      textProblems: this.analyzeTextProblems(lines),
      suggestions: this.generateSuggestions(items, lines)
    }
  }

  /**
   * 重複商品の検出
   */
  private static findDuplicates(items: ExtractedItem[]) {
    const duplicateGroups: Array<{
      pattern: string
      items: ExtractedItem[]
      confidence: number
    }> = []
    
    const processed = new Set<number>()
    
    items.forEach((item, index) => {
      if (processed.has(index)) return
      
      const similars = items.filter((other, otherIndex) => {
        if (index === otherIndex || processed.has(otherIndex)) return false
        return this.calculateSimilarity(item, other) > 0.7
      })
      
      if (similars.length > 0) {
        const group = [item, ...similars]
        duplicateGroups.push({
          pattern: this.extractDuplicatePattern(group),
          items: group,
          confidence: this.calculateGroupConfidence(group)
        })
        
        // 処理済みマーク
        group.forEach(groupItem => {
          const idx = items.indexOf(groupItem)
          if (idx !== -1) processed.add(idx)
        })
      }
    })
    
    return {
      items: duplicateGroups.flatMap(group => group.items),
      groups: duplicateGroups
    }
  }

  /**
   * 無効なアイテムの検出
   */
  private static findInvalidItems(items: ExtractedItem[]) {
    const regNumbers: ExtractedItem[] = []
    const priceInName: ExtractedItem[] = []
    const noPrice: ExtractedItem[] = []
    const suspiciousNames: ExtractedItem[] = []
    const tooLong: ExtractedItem[] = []
    const tooShort: ExtractedItem[] = []
    
    items.forEach(item => {
      // レジ番号の検出
      if (this.isRegisterNumber(item.name)) {
        regNumbers.push(item)
      }
      
      // 商品名に価格が含まれる
      if (this.hasPriceInName(item.name)) {
        priceInName.push(item)
      }
      
      // 価格がない
      if (!item.price || item.price <= 0) {
        noPrice.push(item)
      }
      
      // 怪しい商品名
      if (this.isSuspiciousName(item.name)) {
        suspiciousNames.push(item)
      }
      
      // 長さの問題
      if (item.name.length > 30) {
        tooLong.push(item)
      } else if (item.name.length < 2) {
        tooShort.push(item)
      }
    })
    
    return {
      regNumbers,
      priceInName,
      noPrice,
      suspiciousNames,
      tooLong,
      tooShort
    }
  }

  /**
   * テキストの問題分析
   */
  private static analyzeTextProblems(lines: string[]) {
    const suspiciousLines: string[] = []
    const priceLines: string[] = []
    const metadataLines: string[] = []
    const unrecognizedLines: string[] = []
    
    lines.forEach(line => {
      const trimmed = line.trim()
      
      // 価格行の検出
      if (this.isPriceLine(trimmed)) {
        priceLines.push(trimmed)
      }
      // メタデータ行の検出
      else if (this.isMetadataLine(trimmed)) {
        metadataLines.push(trimmed)
      }
      // 怪しい行の検出
      else if (this.isSuspiciousLine(trimmed)) {
        suspiciousLines.push(trimmed)
      }
      // 認識できない行
      else if (!this.isRecognizableLine(trimmed)) {
        unrecognizedLines.push(trimmed)
      }
    })
    
    return {
      originalLines: lines,
      suspiciousLines,
      priceLines,
      metadataLines,
      unrecognizedLines
    }
  }

  /**
   * 改善提案の生成
   */
  private static generateSuggestions(items: ExtractedItem[], lines: string[]) {
    const suggestions: ProblemAnalysis['suggestions'] = []
    
    // 重複問題
    const duplicates = this.findDuplicates(items)
    if (duplicates.groups.length > 0) {
      suggestions.push({
        category: 'critical',
        problem: `${duplicates.groups.length}組の重複商品が検出されました`,
        solution: '重複除去フィルターの強化が必要です',
        code: 'DUPLICATE_ITEMS'
      })
    }
    
    // レジ番号問題
    const invalid = this.findInvalidItems(items)
    if (invalid.regNumbers.length > 0) {
      suggestions.push({
        category: 'critical',
        problem: 'レジ番号が商品として認識されています',
        solution: 'レジ番号の除外パターンを追加してください',
        code: 'REGISTER_NUMBER_DETECTED'
      })
    }
    
    // 商品名に価格
    if (invalid.priceInName.length > 0) {
      suggestions.push({
        category: 'important',
        problem: '商品名に価格が含まれています',
        solution: '商品名と価格の分離ロジックを改善してください',
        code: 'PRICE_IN_NAME'
      })
    }
    
    // 価格なし
    if (invalid.noPrice.length > 0) {
      suggestions.push({
        category: 'important',
        problem: `${invalid.noPrice.length}件の商品で価格が検出されていません`,
        solution: '価格抽出パターンの見直しが必要です',
        code: 'MISSING_PRICES'
      })
    }
    
    // 認識率の問題
    const recognitionRate = (items.length / lines.length) * 100
    if (recognitionRate < 30) {
      suggestions.push({
        category: 'critical',
        problem: `商品認識率が低すぎます (${recognitionRate.toFixed(1)}%)`,
        solution: 'パターンマッチングの根本的な見直しが必要です',
        code: 'LOW_RECOGNITION_RATE'
      })
    }
    
    return suggestions
  }

  // ヘルパーメソッド
  private static calculateSimilarity(item1: ExtractedItem, item2: ExtractedItem): number {
    const nameScore = this.stringSimilarity(item1.name, item2.name)
    const priceScore = item1.price && item2.price ? 
      (Math.abs(item1.price - item2.price) < 10 ? 1 : 0) : 0
    return nameScore * 0.7 + priceScore * 0.3
  }

  private static stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    if (longer.length === 0) return 1
    return (longer.length - this.editDistance(longer, shorter)) / longer.length
  }

  private static editDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  private static extractDuplicatePattern(items: ExtractedItem[]): string {
    const names = items.map(item => item.name)
    const commonParts = this.findCommonSubstring(names)
    return commonParts || names[0]
  }

  private static findCommonSubstring(strings: string[]): string {
    if (strings.length === 0) return ''
    if (strings.length === 1) return strings[0]
    
    let commonStart = ''
    const minLength = Math.min(...strings.map(s => s.length))
    
    for (let i = 0; i < minLength; i++) {
      const char = strings[0][i]
      if (strings.every(s => s[i] === char)) {
        commonStart += char
      } else {
        break
      }
    }
    
    return commonStart.trim()
  }

  private static calculateGroupConfidence(items: ExtractedItem[]): number {
    return items.reduce((sum, item) => sum + item.confidence, 0) / items.length
  }

  // 検出ロジック
  private static isRegisterNumber(name: string): boolean {
    return /^(レジ|REG|REGISTER)\d+$/i.test(name) ||
           /^\d{2,4}$/.test(name) ||
           /^[A-Z]{2,3}\d{1,3}$/i.test(name)
  }

  private static hasPriceInName(name: string): boolean {
    return /\d+[円¥]/.test(name) ||
           /¥\d+/.test(name) ||
           /\d+\s*(円|yen)/i.test(name)
  }

  private static isSuspiciousName(name: string): boolean {
    return /^[0-9\-*\/\\]+$/.test(name) ||
           /^[A-Z0-9]{5,}$/.test(name) ||
           name.includes('***') ||
           name.includes('---')
  }

  private static isPriceLine(line: string): boolean {
    return /^\d{2,5}\s*[円¥]?\s*$/.test(line) ||
           /^¥\s*\d{2,5}\s*$/.test(line) ||
           /^\d+\*\s*$/.test(line)
  }

  private static isMetadataLine(line: string): boolean {
    return /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(line) ||
           /^\d{1,2}:\d{2}/.test(line) ||
           /店舗|TEL|住所|営業時間|ありがとう/.test(line) ||
           /領収書|レシート|お預り|おつり/.test(line)
  }

  private static isSuspiciousLine(line: string): boolean {
    return line.length > 50 ||
           /^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(line) ||
           (line.match(/\d/g) || []).length > line.length * 0.8
  }

  private static isRecognizableLine(line: string): boolean {
    return line.length >= 2 &&
           !/^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(line)
  }

  /**
   * 問題レポートの生成
   */
  static generateProblemReport(analysis: ProblemAnalysis): string {
    const report = []
    
    report.push('=== OCR 問題分析レポート ===\n')
    
    // 重複問題
    if (analysis.duplicates.groups.length > 0) {
      report.push('🔄 重複商品の問題:')
      analysis.duplicates.groups.forEach((group, index) => {
        report.push(`  ${index + 1}. パターン: "${group.pattern}"`)
        report.push(`     重複数: ${group.items.length}件`)
        group.items.forEach(item => {
          report.push(`     - ${item.name} (¥${item.price})`)
        })
      })
      report.push('')
    }
    
    // 無効アイテム
    const invalid = analysis.invalidItems
    if (invalid.regNumbers.length > 0) {
      report.push('🏷️ レジ番号が商品として認識:')
      invalid.regNumbers.forEach(item => {
        report.push(`  - ${item.name} (¥${item.price})`)
      })
      report.push('')
    }
    
    if (invalid.priceInName.length > 0) {
      report.push('💰 商品名に価格が含まれる:')
      invalid.priceInName.forEach(item => {
        report.push(`  - ${item.name} (¥${item.price})`)
      })
      report.push('')
    }
    
    if (invalid.noPrice.length > 0) {
      report.push('❌ 価格が検出されない商品:')
      invalid.noPrice.forEach(item => {
        report.push(`  - ${item.name}`)
      })
      report.push('')
    }
    
    // テキスト問題
    if (analysis.textProblems.suspiciousLines.length > 0) {
      report.push('⚠️ 怪しいテキスト行:')
      analysis.textProblems.suspiciousLines.forEach(line => {
        report.push(`  - "${line}"`)
      })
      report.push('')
    }
    
    // 改善提案
    report.push('💡 改善提案:')
    analysis.suggestions.forEach((suggestion, index) => {
      const priority = suggestion.category === 'critical' ? '🚨' : 
                      suggestion.category === 'important' ? '⚠️' : 'ℹ️'
      report.push(`  ${index + 1}. ${priority} ${suggestion.problem}`)
      report.push(`     解決策: ${suggestion.solution}`)
      if (suggestion.code) {
        report.push(`     コード: ${suggestion.code}`)
      }
    })
    
    return report.join('\n')
  }
}