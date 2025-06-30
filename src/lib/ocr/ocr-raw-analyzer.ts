/**
 * OCR生データの詳細分析ツール
 */
export class OCRRawAnalyzer {
  
  /**
   * OCRテキストの完全分析
   */
  static analyzeRawOCR(ocrText: string): {
    rawLines: string[]
    analysis: string
    suspiciousLines: string[]
    expectedPatterns: string[]
    recommendations: string[]
  } {
    console.log('🔬 OCR生データ完全分析開始')
    console.log('=' * 50)
    
    const lines = ocrText.split('\n')
    const rawLines = lines.map((line, index) => `${index.toString().padStart(3)}: "${line}"`)
    
    // 全行を出力
    console.log('📄 OCR完全テキスト:')
    rawLines.forEach(line => console.log(line))
    
    // 画像から正確に確認した商品リスト
    const expectedProducts = [
      'UGG ANSLEY シューズ',
      'ユダノムヨーグルト 500×6', 
      'ユダヨーグルトカトウ 800',
      'スンドゥプ チケ 150GX12',
      'うずらの卵50個',
      'トクセンキュウニュウ 1LX2',
      'PROSCIUTTO CRUDO',
      'KSグレープフルーツカップ',
      'シュリンプ カクテル',
      'マイケルリンネル MLEP-08',
      'KS BATH TISSUE 30'
    ]
    
    const suspiciousLines: string[] = []
    const analysisLines: string[] = []
    
    // 各行の詳細分析
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return
      
      const analysis = this.analyzeLine(trimmed, index)
      analysisLines.push(`行${index}: ${trimmed} → ${analysis}`)
      
      // 怪しい行の検出
      if (this.isSuspiciousLine(trimmed)) {
        suspiciousLines.push(`行${index}: ${trimmed}`)
      }
    })
    
    // 期待される商品との照合
    const expectedPatterns = expectedProducts.map(product => {
      const foundLines = lines.filter(line => 
        line.toLowerCase().includes(product.toLowerCase()) ||
        this.fuzzyMatch(line, product)
      )
      
      return `${product}: ${foundLines.length > 0 ? '見つかった' : '見つからない'} ${foundLines.length > 0 ? `(${foundLines.join(', ')})` : ''}`
    })
    
    const recommendations = this.generateFixRecommendations(lines, expectedProducts)
    
    return {
      rawLines,
      analysis: analysisLines.join('\n'),
      suspiciousLines,
      expectedPatterns,
      recommendations
    }
  }
  
  /**
   * 行の詳細分析
   */
  private static analyzeLine(line: string, index: number): string {
    const categories = []
    
    // 商品名の可能性
    if (/[あ-んア-ンa-zA-Z]/.test(line) && line.length > 2) {
      categories.push('商品名候補')
    }
    
    // 価格の可能性
    if (/[\d,]+\s+[TE]$/.test(line)) {
      categories.push('価格+税区分')
    } else if (/^\d{2,6}$/.test(line)) {
      categories.push('価格候補')
    }
    
    // 商品コード
    if (/^\d{5,7}$/.test(line)) {
      categories.push('商品コード')
    }
    
    // 数量
    if (/^\d+[個⚫°.]$/.test(line)) {
      categories.push('数量')
    }
    
    // その他
    if (line.startsWith('※')) {
      categories.push('軽減税率対象')
    }
    
    if (/合計|小計|税/.test(line)) {
      categories.push('集計行')
    }
    
    return categories.length > 0 ? categories.join(', ') : '不明'
  }
  
  /**
   * 怪しい行の検出
   */
  private static isSuspiciousLine(line: string): boolean {
    return (
      line.includes('⚫') ||  // 文字化け
      line.includes('°') ||   // 文字化け
      line.length === 1 ||    // 短すぎる
      /^[%\-*]+$/.test(line) || // 記号のみ
      /^\s+$/.test(line)      // 空白のみ
    )
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
    
    // 文字の類似度チェック（簡単版）
    const similarity = this.calculateSimilarity(textLower, targetLower)
    return similarity > 0.6
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
   * 修正提案の生成
   */
  private static generateFixRecommendations(lines: string[], expectedProducts: string[]): string[] {
    const recommendations: string[] = []
    
    // 空行が多い場合
    const emptyLines = lines.filter(line => !line.trim()).length
    if (emptyLines > lines.length * 0.3) {
      recommendations.push('空行が多すぎます。OCR精度に問題がある可能性があります。')
    }
    
    // 短い行が多い場合
    const shortLines = lines.filter(line => line.trim().length === 1).length
    if (shortLines > 5) {
      recommendations.push('1文字の行が多すぎます。文字の分離が発生している可能性があります。')
    }
    
    // 数字のみの行が多い場合
    const numberOnlyLines = lines.filter(line => /^\d+$/.test(line.trim())).length
    if (numberOnlyLines > 10) {
      recommendations.push('数字のみの行が多すぎます。価格と商品名の関連付けが困難です。')
    }
    
    // 期待商品の検出率
    const foundProducts = expectedProducts.filter(product =>
      lines.some(line => this.fuzzyMatch(line, product))
    ).length
    
    if (foundProducts < expectedProducts.length * 0.5) {
      recommendations.push(`期待商品の検出率が低いです (${foundProducts}/${expectedProducts.length})。OCRエンジンの設定見直しが必要です。`)
    }
    
    return recommendations
  }
  
  /**
   * OCRテキストから実際のレシート構造を推測
   */
  static inferReceiptStructure(ocrText: string): {
    possibleProducts: Array<{
      startLine: number
      endLine: number
      productName: string
      possiblePrice: string | null
      confidence: number
    }>
    structure: string
  } {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const possibleProducts = []
    
    console.log('🏗️ レシート構造推測開始')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // 商品名らしい行を探す
      if (this.looksLikeProductName(line)) {
        let endLine = i
        let possiblePrice = null
        
        // その後の数行で価格を探す
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const nextLine = lines[j].trim()
          
          if (this.looksLikePrice(nextLine)) {
            possiblePrice = nextLine
            endLine = j
            break
          }
        }
        
        if (possiblePrice) {
          possibleProducts.push({
            startLine: i,
            endLine: endLine,
            productName: line,
            possiblePrice: possiblePrice,
            confidence: this.calculateProductConfidence(line, possiblePrice)
          })
          
          console.log(`🛍️ 商品候補: "${line}" → "${possiblePrice}" (信頼度: ${this.calculateProductConfidence(line, possiblePrice).toFixed(2)})`)
        }
      }
    }
    
    const structure = `
推測されるレシート構造:
- 総行数: ${lines.length}
- 商品候補数: ${possibleProducts.length}
- 平均商品情報行数: ${possibleProducts.length > 0 ? (possibleProducts.reduce((sum, p) => sum + (p.endLine - p.startLine + 1), 0) / possibleProducts.length).toFixed(1) : '不明'}
    `.trim()
    
    return { possibleProducts, structure }
  }
  
  /**
   * 商品名らしいかどうかの判定
   */
  private static looksLikeProductName(line: string): boolean {
    if (!line || line.length < 2) return false
    
    // 基本的な文字が含まれている
    const hasValidChars = /[あ-んア-ンa-zA-Z]/.test(line)
    
    // 明らかに商品名ではない
    const excludePatterns = [
      /^\d+$/,
      /^[\d,]+\s+[TE]$/,
      /^\d{5,7}$/,
      /合計|小計|税|売上/,
      /^\d{4}年/,
      /TEL|FAX/
    ]
    
    return hasValidChars && !excludePatterns.some(pattern => pattern.test(line))
  }
  
  /**
   * 価格らしいかどうかの判定
   */
  private static looksLikePrice(line: string): boolean {
    const pricePatterns = [
      /^[\d,]+\s+[TE]$/,
      /^¥[\d,]+$/,
      /^[\d,]+円$/,
      /^\d{2,6}$/
    ]
    
    return pricePatterns.some(pattern => pattern.test(line))
  }
  
  /**
   * 商品の信頼度計算
   */
  private static calculateProductConfidence(productName: string, price: string): number {
    let confidence = 0.5
    
    // 商品名の品質
    if (productName.length >= 5) confidence += 0.2
    if (/[あ-んア-ン]/.test(productName)) confidence += 0.1
    if (/[a-zA-Z]/.test(productName)) confidence += 0.1
    
    // 価格の品質
    if (/[\d,]+\s+[TE]$/.test(price)) confidence += 0.2
    
    return Math.min(1.0, confidence)
  }
}