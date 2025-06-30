/**
 * 商品名未検出の詳細デバッグツール
 */
export class DetectionDebugger {

  /**
   * 商品名未検出の原因を詳細分析
   */
  static debugProductDetection(ocrText: string, expectedProducts?: string[]): {
    analysis: {
      totalLines: number
      candidateLines: number
      rejectedLines: Array<{
        line: number
        content: string
        rejectionReason: string[]
      }>
      acceptedLines: Array<{
        line: number
        content: string
        confidence: number
      }>
    }
    recommendations: string[]
    detailedReport: string
  } {
    console.log('🔍 商品名検出デバッグ開始')
    console.log('=' + '='.repeat(60))
    
    const lines = ocrText.split('\n').filter(line => line.trim())
    const candidateLines: Array<{line: number, content: string, confidence: number}> = []
    const rejectedLines: Array<{line: number, content: string, rejectionReason: string[]}> = []
    
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return
      
      const analysis = this.analyzeLineForProductName(trimmed, index)
      
      if (analysis.isCandidate) {
        candidateLines.push({
          line: index,
          content: trimmed,
          confidence: analysis.confidence
        })
        console.log(`✅ 行${index}: "${trimmed}" [信頼度: ${analysis.confidence.toFixed(2)}]`)
      } else {
        rejectedLines.push({
          line: index,
          content: trimmed,
          rejectionReason: analysis.rejectionReasons
        })
        console.log(`❌ 行${index}: "${trimmed}" [除外理由: ${analysis.rejectionReasons.join(', ')}]`)
      }
    })
    
    // 期待商品との照合
    if (expectedProducts) {
      console.log('\n🎯 期待商品との照合:')
      expectedProducts.forEach(expectedProduct => {
        const found = candidateLines.find(candidate => 
          this.fuzzyMatch(candidate.content, expectedProduct)
        )
        
        if (found) {
          console.log(`✅ "${expectedProduct}" → 行${found.line}: "${found.content}"`)
        } else {
          console.log(`❌ "${expectedProduct}" → 未検出`)
          
          // 類似行を探す
          const similarLines = this.findSimilarLines(expectedProduct, lines)
          if (similarLines.length > 0) {
            console.log(`   💡 類似行候補:`)
            similarLines.forEach(similar => {
              console.log(`      行${similar.index}: "${similar.content}" [類似度: ${similar.similarity.toFixed(2)}]`)
            })
          }
        }
      })
    }
    
    const recommendations = this.generateRecommendations(candidateLines, rejectedLines, expectedProducts)
    const detailedReport = this.generateDetailedReport(candidateLines, rejectedLines, lines.length)
    
    return {
      analysis: {
        totalLines: lines.length,
        candidateLines: candidateLines.length,
        rejectedLines,
        acceptedLines: candidateLines
      },
      recommendations,
      detailedReport
    }
  }

  /**
   * 行の商品名候補分析
   */
  private static analyzeLineForProductName(text: string, lineIndex: number): {
    isCandidate: boolean
    confidence: number
    rejectionReasons: string[]
  } {
    const rejectionReasons: string[] = []
    let confidence = 0.5
    
    // 基本的な長さチェック
    if (text.length < 2) {
      rejectionReasons.push('短すぎる(<2文字)')
      return { isCandidate: false, confidence: 0, rejectionReasons }
    }
    
    if (text.length > 60) {
      rejectionReasons.push('長すぎる(>60文字)')
      return { isCandidate: false, confidence: 0, rejectionReasons }
    }
    
    // 文字種チェック
    if (!/[あ-んア-ンa-zA-Z0-9]/.test(text)) {
      rejectionReasons.push('有効な文字が含まれていない')
      return { isCandidate: false, confidence: 0, rejectionReasons }
    }
    
    // 除外パターンの詳細チェック
    const exclusionChecks = [
      { pattern: /^[\d\s,]+$/, reason: '数字・記号のみ' },
      { pattern: /^X\d+$/i, reason: 'X数字パターン' },
      { pattern: /^\d{5,7}$/, reason: '商品コード' },
      { pattern: /^1\*?$/, reason: '1*パターン' },
      { pattern: /^¥[\d,]+$/, reason: '¥価格パターン' },
      { pattern: /^[\d,]+円?$/, reason: '円価格パターン' },
      { pattern: /^[\d,]+\s+[TE]$/, reason: '価格+税区分' },
      { pattern: /合計|小計|税|売上/, reason: '集計系キーワード' },
      { pattern: /^(\d{4}年\d{1,2}月|\d{1,2}\/\d{1,2})/, reason: '日付パターン' },
      { pattern: /TEL|FAX|住所/, reason: '店舗情報' },
      { pattern: /ありがとう|またお越し/, reason: '挨拶文' },
      { pattern: /会員|MEMBER|BIZ|GOLD/i, reason: '会員情報' },
      { pattern: /RECEIPT|TOTAL/i, reason: 'レシート用語' },
      { pattern: /WHOLESALE|STORE/i, reason: 'ヘッダー情報' }
    ]
    
    for (const check of exclusionChecks) {
      if (check.pattern.test(text)) {
        rejectionReasons.push(check.reason)
        return { isCandidate: false, confidence: 0, rejectionReasons }
      }
    }
    
    // 信頼度計算
    if (text.length >= 5) confidence += 0.2
    if (/[あ-んア-ン]/.test(text)) confidence += 0.2  // ひらがな・カタカナ
    if (/[a-zA-Z]/.test(text)) confidence += 0.1      // アルファベット
    if (/[0-9]/.test(text)) confidence += 0.05        // 数字（少し）
    if (/[×・]/.test(text)) confidence += 0.1         // 商品表記によくある記号
    
    // 商品らしいキーワード
    const productKeywords = [
      'ヨーグルト', 'シューズ', '牛乳', 'ミルク', 'チゲ', 'スープ',
      '卵', 'エッグ', 'ハム', 'シュリンプ', 'エビ', 'フルーツ',
      'グレープ', 'ティッシュ', 'バッグ', '野菜', 'サラダ', 'meat',
      'milk', 'egg', 'ham', 'fruit', 'tissue', 'bag'
    ]
    
    if (productKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
      confidence += 0.3
    }
    
    // ブランド名パターン（一般的な表記）
    if (/^[A-Z]+\s+[A-Z]+/.test(text)) {
      confidence += 0.1  // 大文字ブランド名
    }
    
    return {
      isCandidate: confidence > 0.6,
      confidence: Math.min(1.0, confidence),
      rejectionReasons: confidence <= 0.6 ? ['信頼度不足'] : []
    }
  }

  /**
   * あいまいマッチング
   */
  private static fuzzyMatch(text: string, target: string): boolean {
    const textLower = text.toLowerCase().replace(/\s/g, '')
    const targetLower = target.toLowerCase().replace(/\s/g, '')
    
    // 部分一致
    if (textLower.includes(targetLower) || targetLower.includes(textLower)) {
      return true
    }
    
    // 文字の類似度チェック
    const similarity = this.calculateSimilarity(textLower, targetLower)
    return similarity > 0.6
  }

  /**
   * 類似行の検索
   */
  private static findSimilarLines(target: string, lines: string[]): Array<{
    index: number
    content: string
    similarity: number
  }> {
    const similar: Array<{index: number, content: string, similarity: number}> = []
    
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.length < 2) return
      
      const similarity = this.calculateSimilarity(
        target.toLowerCase().replace(/\s/g, ''),
        trimmed.toLowerCase().replace(/\s/g, '')
      )
      
      if (similarity > 0.3) {
        similar.push({
          index,
          content: trimmed,
          similarity
        })
      }
    })
    
    return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 3)
  }

  /**
   * 類似度計算
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * レーベンシュタイン距離
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * 推奨事項の生成
   */
  private static generateRecommendations(
    candidateLines: Array<{line: number, content: string, confidence: number}>,
    rejectedLines: Array<{line: number, content: string, rejectionReason: string[]}>,
    expectedProducts?: string[]
  ): string[] {
    const recommendations: string[] = []
    
    // 検出率の分析
    const totalLines = candidateLines.length + rejectedLines.length
    const detectionRate = candidateLines.length / totalLines
    
    if (detectionRate < 0.1) {
      recommendations.push('❗ 商品名候補が極端に少ない。OCR精度またはフィルタリング条件を見直してください')
    } else if (detectionRate < 0.2) {
      recommendations.push('⚠️ 商品名候補が少ない。除外条件を緩和することを検討してください')
    }
    
    // 主な除外理由の分析
    const rejectionReasons = rejectedLines.flatMap(line => line.rejectionReason)
    const reasonCounts = rejectionReasons.reduce((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topReasons = Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
    
    if (topReasons.length > 0) {
      recommendations.push(`🔍 主な除外理由: ${topReasons.map(([reason, count]) => `${reason}(${count}件)`).join(', ')}`)
    }
    
    // 信頼度の分析
    const avgConfidence = candidateLines.length > 0 
      ? candidateLines.reduce((sum, line) => sum + line.confidence, 0) / candidateLines.length 
      : 0
    
    if (avgConfidence < 0.7) {
      recommendations.push('💡 商品名候補の信頼度が低い。OCR前処理の改善が必要です')
    }
    
    // 期待商品との照合
    if (expectedProducts) {
      const foundCount = expectedProducts.filter(expected =>
        candidateLines.some(candidate => this.fuzzyMatch(candidate.content, expected))
      ).length
      
      const foundRate = foundCount / expectedProducts.length
      if (foundRate < 0.5) {
        recommendations.push('🎯 期待商品の検出率が低い。パターンマッチング条件を調整してください')
      }
    }
    
    // 具体的な改善提案
    if (rejectionReasons.includes('短すぎる(<2文字)')) {
      recommendations.push('💡 多数の短い行がある場合、OCRで文字が分離している可能性があります')
    }
    
    if (rejectionReasons.includes('数字・記号のみ')) {
      recommendations.push('💡 数字のみの行が多い場合、商品名と価格が混在している可能性があります')
    }
    
    return recommendations
  }

  /**
   * 詳細レポートの生成
   */
  private static generateDetailedReport(
    candidateLines: Array<{line: number, content: string, confidence: number}>,
    rejectedLines: Array<{line: number, content: string, rejectionReason: string[]}>,
    totalLines: number
  ): string {
    const detectionRate = (candidateLines.length / totalLines * 100).toFixed(1)
    const avgConfidence = candidateLines.length > 0 
      ? (candidateLines.reduce((sum, line) => sum + line.confidence, 0) / candidateLines.length).toFixed(3)
      : '0.000'
    
    return `
📊 商品名検出詳細レポート
========================
総行数: ${totalLines}
商品名候補: ${candidateLines.length}件 (${detectionRate}%)
除外行数: ${rejectedLines.length}件
平均信頼度: ${avgConfidence}

🏆 検出成功行 TOP5:
${candidateLines
  .sort((a, b) => b.confidence - a.confidence)
  .slice(0, 5)
  .map((line, i) => `${i+1}. 行${line.line}: "${line.content}" [${line.confidence.toFixed(3)}]`)
  .join('\n')}

❌ 除外理由 TOP5:
${Object.entries(
  rejectedLines.flatMap(line => line.rejectionReason).reduce((acc, reason) => {
    acc[reason] = (acc[reason] || 0) + 1
    return acc
  }, {} as Record<string, number>)
)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([reason, count], i) => `${i+1}. ${reason}: ${count}件`)
  .join('\n')}
    `.trim()
  }

  /**
   * リアルタイム検出テスト
   */
  static testProductDetection(text: string): {
    isDetected: boolean
    confidence: number
    reasons: string[]
  } {
    const analysis = this.analyzeLineForProductName(text, 0)
    return {
      isDetected: analysis.isCandidate,
      confidence: analysis.confidence,
      reasons: analysis.rejectionReasons
    }
  }

  /**
   * OCR改善提案
   */
  static suggestOCRImprovements(ocrText: string): string[] {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const suggestions: string[] = []
    
    // 空行率
    const totalLinesIncludingEmpty = ocrText.split('\n').length
    const emptyLineRate = (totalLinesIncludingEmpty - lines.length) / totalLinesIncludingEmpty
    if (emptyLineRate > 0.3) {
      suggestions.push('🔧 空行が多すぎます。OCR前に画像の前処理（ノイズ除去、コントラスト調整）を試してください')
    }
    
    // 短い行の割合
    const shortLines = lines.filter(line => line.trim().length === 1).length
    if (shortLines > lines.length * 0.2) {
      suggestions.push('🔧 1文字の行が多すぎます。文字認識で分離が発生している可能性があります')
    }
    
    // 数字のみの行
    const numberOnlyLines = lines.filter(line => /^\d+$/.test(line.trim())).length
    if (numberOnlyLines > lines.length * 0.3) {
      suggestions.push('🔧 数字のみの行が多すぎます。商品名と価格の関連付けが困難です')
    }
    
    return suggestions
  }
}