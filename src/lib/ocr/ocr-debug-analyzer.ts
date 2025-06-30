import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * OCRテキスト解析とデバッグのためのクラス
 */
export class OCRDebugAnalyzer {
  
  /**
   * OCRテキストの詳細分析
   */
  static analyzeOCRText(ocrText: string): {
    lines: string[]
    lineAnalysis: Array<{
      index: number
      content: string
      length: number
      hasJapanese: boolean
      hasEnglish: boolean
      hasNumbers: boolean
      hasSymbols: boolean
      possibleProductName: boolean
      possiblePrice: boolean
      possibleQuantity: boolean
      possibleCode: boolean
    }>
    suspiciousPatterns: string[]
    recommendations: string[]
  } {
    const lines = ocrText.split('\n').filter(line => line.trim())
    
    console.log(`🔍 OCRテキスト詳細分析開始: ${lines.length}行`)
    
    const lineAnalysis = lines.map((line, index) => {
      const trimmed = line.trim()
      
      return {
        index,
        content: trimmed,
        length: trimmed.length,
        hasJapanese: /[あ-んア-ンぁ-ゖ]/.test(trimmed),
        hasEnglish: /[a-zA-Z]/.test(trimmed),
        hasNumbers: /\d/.test(trimmed),
        hasSymbols: /[※*¥,.]/.test(trimmed),
        possibleProductName: this.isPossibleProductName(trimmed),
        possiblePrice: this.isPossiblePrice(trimmed),
        possibleQuantity: this.isPossibleQuantity(trimmed),
        possibleCode: this.isPossibleCode(trimmed)
      }
    })
    
    // 怪しいパターンを検出
    const suspiciousPatterns = this.detectSuspiciousPatterns(lines)
    
    // 改善提案を生成
    const recommendations = this.generateRecommendations(lineAnalysis, suspiciousPatterns)
    
    // デバッグ出力
    this.printDebugInfo(lineAnalysis, suspiciousPatterns)
    
    return {
      lines,
      lineAnalysis,
      suspiciousPatterns,
      recommendations
    }
  }
  
  /**
   * 商品名の可能性をチェック
   */
  private static isPossibleProductName(text: string): boolean {
    if (!text || text.length < 2) return false
    
    // 日本語や英語を含む
    const hasValidChars = /[あ-んア-ンぁ-ゖa-zA-Z]/.test(text)
    
    // 除外パターン
    const excludePatterns = [
      /^\d+$/,           // 数字のみ
      /^[\d,]+\s+[TE]$/, // 価格パターン
      /^\d{5,7}$/,       // 商品コード
      /^\d+[個⚫°.]$/,   // 数量パターン
      /^[*※]+$/,        // 記号のみ
      /合計|小計|税/     // 集計系
    ]
    
    const isExcluded = excludePatterns.some(pattern => pattern.test(text))
    
    return hasValidChars && !isExcluded
  }
  
  /**
   * 価格の可能性をチェック
   */
  private static isPossiblePrice(text: string): boolean {
    const pricePatterns = [
      /^[\d,]+\s+[TE]$/,    // "5,966 T"
      /^¥[\d,]+$/,          // "¥5,966"
      /^[\d,]+円$/,         // "5,966円"
      /^\d{2,6}$/           // "5966"
    ]
    
    return pricePatterns.some(pattern => pattern.test(text))
  }
  
  /**
   * 数量の可能性をチェック
   */
  private static isPossibleQuantity(text: string): boolean {
    const quantityPatterns = [
      /^\d+[個⚫°.]$/,      // "1個"
      /^\d+コ$/,           // "1コ"
      /^\d+本$/,           // "2本"
      /^\d+袋$/            // "3袋"
    ]
    
    return quantityPatterns.some(pattern => pattern.test(text))
  }
  
  /**
   * 商品コードの可能性をチェック
   */
  private static isPossibleCode(text: string): boolean {
    return /^\d{5,7}$/.test(text)
  }
  
  /**
   * 怪しいパターンを検出
   */
  private static detectSuspiciousPatterns(lines: string[]): string[] {
    const suspicious: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // 文字化けパターン
      if (/[⚫°]/.test(line)) {
        suspicious.push(`行${i}: 文字化け記号検出 "${line}"`)
      }
      
      // 短すぎる商品名
      if (this.isPossibleProductName(line) && line.length === 1) {
        suspicious.push(`行${i}: 短すぎる商品名 "${line}"`)
      }
      
      // 価格と税区分が分離
      if (/^\d+$/.test(line) && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim()
        if (/^[TE]$/.test(nextLine)) {
          suspicious.push(`行${i}-${i+1}: 価格と税区分が分離 "${line}" + "${nextLine}"`)
        }
      }
      
      // 商品名が分離している可能性
      if (this.isPossibleProductName(line) && line.length < 10 && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim()
        if (this.isPossibleProductName(nextLine) && nextLine.length < 15) {
          suspicious.push(`行${i}-${i+1}: 商品名分離の可能性 "${line}" + "${nextLine}"`)
        }
      }
    }
    
    return suspicious
  }
  
  /**
   * 改善提案を生成
   */
  private static generateRecommendations(
    lineAnalysis: any[], 
    suspiciousPatterns: string[]
  ): string[] {
    const recommendations: string[] = []
    
    // 文字化け対策
    if (suspiciousPatterns.some(p => p.includes('文字化け'))) {
      recommendations.push('OCR精度向上のため画像の前処理（コントラスト調整、ノイズ除去）を検討')
    }
    
    // 分離対策
    if (suspiciousPatterns.some(p => p.includes('分離'))) {
      recommendations.push('複数行にまたがる商品情報の結合処理を強化')
    }
    
    // 商品名検出率
    const productNameCount = lineAnalysis.filter(l => l.possibleProductName).length
    if (productNameCount < 5) {
      recommendations.push('商品名検出パターンをより柔軟に調整')
    }
    
    // 価格検出率
    const priceCount = lineAnalysis.filter(l => l.possiblePrice).length
    if (priceCount < 5) {
      recommendations.push('価格検出パターンの追加を検討')
    }
    
    return recommendations
  }
  
  /**
   * デバッグ情報を出力
   */
  private static printDebugInfo(lineAnalysis: any[], suspiciousPatterns: string[]) {
    console.log('\n📊 OCR行分析:')
    lineAnalysis.forEach(analysis => {
      const flags = []
      if (analysis.possibleProductName) flags.push('商品名')
      if (analysis.possiblePrice) flags.push('価格')
      if (analysis.possibleQuantity) flags.push('数量')
      if (analysis.possibleCode) flags.push('コード')
      
      console.log(`${analysis.index.toString().padStart(2)}: ${analysis.content} ${flags.length > 0 ? '[' + flags.join(',') + ']' : ''}`)
    })
    
    if (suspiciousPatterns.length > 0) {
      console.log('\n⚠️ 検出された問題:')
      suspiciousPatterns.forEach(pattern => console.log(`  ${pattern}`))
    }
    
    console.log(`\n📈 統計:`)
    console.log(`  商品名候補: ${lineAnalysis.filter(l => l.possibleProductName).length}行`)
    console.log(`  価格候補: ${lineAnalysis.filter(l => l.possiblePrice).length}行`)
    console.log(`  数量候補: ${lineAnalysis.filter(l => l.possibleQuantity).length}行`)
    console.log(`  コード候補: ${lineAnalysis.filter(l => l.possibleCode).length}行`)
  }
  
  /**
   * 抽出された商品の品質分析
   */
  static analyzeExtractedItems(items: ExtractedItem[], ocrText: string): {
    qualityScore: number
    issues: string[]
    suggestions: string[]
  } {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const issues: string[] = []
    const suggestions: string[] = []
    
    // 抽出率のチェック
    const extractionRate = items.length / Math.max(lines.length * 0.1, 1) // 期待値は全行数の約10%
    
    if (extractionRate < 0.5) {
      issues.push(`抽出率が低い: ${items.length}件/${lines.length}行 (${(extractionRate * 100).toFixed(1)}%)`)
      suggestions.push('パターンマッチングの条件を緩和することを検討')
    }
    
    // 価格の妥当性
    const invalidPrices = items.filter(item => !item.price || item.price < 50 || item.price > 50000)
    if (invalidPrices.length > 0) {
      issues.push(`無効な価格: ${invalidPrices.length}件`)
      suggestions.push('価格検出パターンの見直しが必要')
    }
    
    // 商品名の品質
    const shortNames = items.filter(item => item.name.length < 3)
    if (shortNames.length > 0) {
      issues.push(`短すぎる商品名: ${shortNames.length}件`)
      suggestions.push('商品名の結合処理を強化')
    }
    
    // 信頼度の分布
    const lowConfidence = items.filter(item => item.confidence < 0.5)
    if (lowConfidence.length > items.length * 0.5) {
      issues.push(`低信頼度アイテムが多い: ${lowConfidence.length}/${items.length}件`)
      suggestions.push('検出アルゴリズムの精度向上が必要')
    }
    
    // 品質スコア計算
    let qualityScore = 1.0
    qualityScore -= Math.max(0, 0.5 - extractionRate) // 抽出率
    qualityScore -= (invalidPrices.length / Math.max(items.length, 1)) * 0.3 // 価格品質
    qualityScore -= (shortNames.length / Math.max(items.length, 1)) * 0.2 // 名前品質
    qualityScore = Math.max(0, Math.min(1, qualityScore))
    
    return {
      qualityScore,
      issues,
      suggestions
    }
  }
}