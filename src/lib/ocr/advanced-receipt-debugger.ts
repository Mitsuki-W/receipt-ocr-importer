/**
 * 高度なレシートデバッガー - 実際のOCRデータから問題を特定
 */
export class AdvancedReceiptDebugger {

  /**
   * 包括的レシート分析
   */
  static analyzeReceiptComprehensively(ocrText: string): {
    rawAnalysis: {
      totalLines: number
      emptyLines: number
      shortLines: number
      longLines: number
      numberOnlyLines: number
      mixedLines: number
      specialCharLines: number
    }
    structureAnalysis: {
      detectedPatterns: Array<{
        pattern: string
        confidence: number
        lineRange: [number, number]
        evidence: string[]
      }>
      likelyReceiptType: string
      complexity: 'simple' | 'medium' | 'complex'
    }
    problemDiagnosis: {
      ocrIssues: string[]
      structuralIssues: string[]
      contentIssues: string[]
      recommendations: string[]
    }
    lineByLineAnalysis: Array<{
      index: number
      content: string
      classification: string
      confidence: number
      issues: string[]
      possibleMeaning: string
    }>
    detailedReport: string
  } {
    console.log('🔬 包括的レシート分析開始')
    console.log('=' + '='.repeat(70))
    
    const lines = ocrText.split('\n')
    const nonEmptyLines = lines.filter(line => line.trim())
    
    // 1. 基本統計分析
    const rawAnalysis = this.analyzeRawStructure(lines)
    console.log('\n📊 基本統計:')
    console.log(`  総行数: ${rawAnalysis.totalLines}`)
    console.log(`  空行: ${rawAnalysis.emptyLines} (${(rawAnalysis.emptyLines/rawAnalysis.totalLines*100).toFixed(1)}%)`)
    console.log(`  短い行(<3文字): ${rawAnalysis.shortLines}`)
    console.log(`  長い行(>30文字): ${rawAnalysis.longLines}`)
    console.log(`  数字のみ: ${rawAnalysis.numberOnlyLines}`)
    console.log(`  混在行: ${rawAnalysis.mixedLines}`)
    
    // 2. 構造パターン分析
    const structureAnalysis = this.analyzeReceiptStructure(nonEmptyLines)
    console.log('\n🏗️ 構造分析:')
    console.log(`  推定レシートタイプ: ${structureAnalysis.likelyReceiptType}`)
    console.log(`  複雑度: ${structureAnalysis.complexity}`)
    console.log(`  検出パターン数: ${structureAnalysis.detectedPatterns.length}`)
    
    structureAnalysis.detectedPatterns.forEach((pattern, i) => {
      console.log(`    ${i+1}. ${pattern.pattern} [信頼度: ${pattern.confidence.toFixed(2)}] (行${pattern.lineRange[0]}-${pattern.lineRange[1]})`)
    })
    
    // 3. 行ごと詳細分析
    const lineByLineAnalysis = this.analyzeEachLine(nonEmptyLines)
    console.log('\n🔍 行別分析 (問題行のみ):')
    
    const problematicLines = lineByLineAnalysis.filter(line => 
      line.issues.length > 0 || line.confidence < 0.7
    )
    
    problematicLines.slice(0, 10).forEach(line => {
      console.log(`  行${line.index}: "${line.content}"`)
      console.log(`    分類: ${line.classification} [信頼度: ${line.confidence.toFixed(2)}]`)
      if (line.issues.length > 0) {
        console.log(`    問題: ${line.issues.join(', ')}`)
      }
      console.log(`    推定: ${line.possibleMeaning}`)
    })
    
    // 4. 問題診断
    const problemDiagnosis = this.diagnoseProblemsSoft(rawAnalysis, structureAnalysis, lineByLineAnalysis)
    console.log('\n🩺 問題診断:')
    
    if (problemDiagnosis.ocrIssues.length > 0) {
      console.log('  OCR品質問題:')
      problemDiagnosis.ocrIssues.forEach(issue => console.log(`    • ${issue}`))
    }
    
    if (problemDiagnosis.structuralIssues.length > 0) {
      console.log('  構造問題:')
      problemDiagnosis.structuralIssues.forEach(issue => console.log(`    • ${issue}`))
    }
    
    if (problemDiagnosis.contentIssues.length > 0) {
      console.log('  内容問題:')
      problemDiagnosis.contentIssues.forEach(issue => console.log(`    • ${issue}`))
    }
    
    console.log('\n💡 推奨改善策:')
    problemDiagnosis.recommendations.forEach(rec => console.log(`  • ${rec}`))
    
    const detailedReport = this.generateComprehensiveReport(
      rawAnalysis, structureAnalysis, lineByLineAnalysis, problemDiagnosis
    )
    
    return {
      rawAnalysis,
      structureAnalysis, 
      problemDiagnosis,
      lineByLineAnalysis,
      detailedReport
    }
  }

  /**
   * 基本構造分析
   */
  private static analyzeRawStructure(lines: string[]) {
    const totalLines = lines.length
    const emptyLines = lines.filter(line => !line.trim()).length
    const nonEmptyLines = lines.filter(line => line.trim())
    
    const shortLines = nonEmptyLines.filter(line => line.trim().length < 3).length
    const longLines = nonEmptyLines.filter(line => line.trim().length > 30).length
    const numberOnlyLines = nonEmptyLines.filter(line => /^\d+$/.test(line.trim())).length
    const mixedLines = nonEmptyLines.filter(line => 
      /[a-zA-Zあ-んア-ン]/.test(line) && /\d/.test(line)
    ).length
    const specialCharLines = nonEmptyLines.filter(line => 
      /[※●○◯⚫°•]/.test(line)
    ).length
    
    return {
      totalLines,
      emptyLines,
      shortLines,
      longLines,
      numberOnlyLines,
      mixedLines,
      specialCharLines
    }
  }

  /**
   * レシート構造パターン分析
   */
  private static analyzeReceiptStructure(lines: string[]) {
    const patterns: Array<{
      pattern: string
      confidence: number
      lineRange: [number, number]
      evidence: string[]
    }> = []
    
    // パターン1: 5行標準パターン検出
    for (let i = 0; i < lines.length - 4; i++) {
      const sequence = lines.slice(i, i + 5)
      const analysis = this.analyze5LinePattern(sequence, i)
      if (analysis) {
        patterns.push(analysis)
      }
    }
    
    // パターン2: 価格+税区分パターン
    const priceLines = lines.map((line, index) => ({
      index,
      line: line.trim(),
      isPriceTax: /^[\d,]+\s+[TE]$/.test(line.trim())
    })).filter(item => item.isPriceTax)
    
    if (priceLines.length > 2) {
      patterns.push({
        pattern: '価格+税区分パターン',
        confidence: 0.8,
        lineRange: [priceLines[0].index, priceLines[priceLines.length - 1].index],
        evidence: [`${priceLines.length}個の価格+税区分行を検出`]
      })
    }
    
    // パターン3: 商品コードパターン
    const codeLines = lines.map((line, index) => ({
      index,
      line: line.trim(),
      isCode: /^\d{5,7}$/.test(line.trim())
    })).filter(item => item.isCode)
    
    if (codeLines.length > 2) {
      patterns.push({
        pattern: '商品コードパターン',
        confidence: 0.7,
        lineRange: [codeLines[0].index, codeLines[codeLines.length - 1].index],
        evidence: [`${codeLines.length}個の商品コード行を検出`]
      })
    }
    
    // レシートタイプ推定
    let likelyReceiptType = 'unknown'
    let complexity: 'simple' | 'medium' | 'complex' = 'medium'
    
    if (patterns.some(p => p.pattern === '5行標準パターン')) {
      likelyReceiptType = 'structured-warehouse'
      complexity = 'medium'
    } else if (priceLines.length > 5 && codeLines.length > 5) {
      likelyReceiptType = 'warehouse-standard'
      complexity = 'medium'
    } else if (priceLines.length > 2) {
      likelyReceiptType = 'basic-retail'
      complexity = 'simple'
    } else {
      likelyReceiptType = 'unstructured'
      complexity = 'complex'
    }
    
    return {
      detectedPatterns: patterns,
      likelyReceiptType,
      complexity
    }
  }

  /**
   * 5行パターン分析
   */
  private static analyze5LinePattern(sequence: string[], startIndex: number) {
    const [line1, line2, line3, line4, line5] = sequence.map(line => line.trim())
    
    const evidence: string[] = []
    let confidence = 0.1
    
    // 商品名らしい1行目
    if (this.looksLikeProductName(line1)) {
      evidence.push('商品名候補')
      confidence += 0.2
    }
    
    // 商品コードらしい2行目
    if (/^\d{5,7}$/.test(line2)) {
      evidence.push('商品コード')
      confidence += 0.2
    }
    
    // 数量らしい3行目
    if (/^\d+[個⚫°.]?$/.test(line3)) {
      evidence.push('数量')
      confidence += 0.15
    }
    
    // 単価らしい4行目
    if (/^[\d,]+$/.test(line4)) {
      evidence.push('単価')
      confidence += 0.15
    }
    
    // 価格+税区分らしい5行目
    if (/^[\d,]+\s+[TE]$/.test(line5)) {
      evidence.push('価格+税区分')
      confidence += 0.2
    }
    
    if (confidence > 0.5) {
      return {
        pattern: '5行標準パターン',
        confidence,
        lineRange: [startIndex, startIndex + 4] as [number, number],
        evidence
      }
    }
    
    return null
  }

  /**
   * 行ごと詳細分析
   */
  private static analyzeEachLine(lines: string[]) {
    return lines.map((line, index) => {
      const trimmed = line.trim()
      const analysis = this.classifyLine(trimmed)
      
      return {
        index,
        content: trimmed,
        classification: analysis.type,
        confidence: analysis.confidence,
        issues: analysis.issues,
        possibleMeaning: analysis.meaning
      }
    })
  }

  /**
   * 行の分類
   */
  private static classifyLine(text: string) {
    const issues: string[] = []
    let confidence = 0.5
    let type = 'unknown'
    let meaning = '分類不明'
    
    if (!text) {
      return { type: 'empty', confidence: 1.0, issues: [], meaning: '空行' }
    }
    
    // 商品名候補
    if (this.looksLikeProductName(text)) {
      type = 'product_name'
      meaning = '商品名候補'
      confidence = 0.8
      
      if (text.length < 4) issues.push('短すぎる商品名')
      if (!/[あ-んア-ンa-zA-Z]/.test(text)) issues.push('文字が含まれていない')
    }
    // 価格+税区分
    else if (/^[\d,]+\s+[TE]$/.test(text)) {
      type = 'price_tax'
      meaning = '価格+税区分'
      confidence = 0.95
    }
    // 商品コード
    else if (/^\d{5,7}$/.test(text)) {
      type = 'product_code'
      meaning = '商品コード'
      confidence = 0.9
    }
    // 数量
    else if (/^\d+[個⚫°.]?$/.test(text)) {
      type = 'quantity'
      meaning = '数量'
      confidence = 0.85
    }
    // X数字パターン
    else if (/^X\d+$/i.test(text)) {
      type = 'multiplier'
      meaning = '数量倍数'
      confidence = 0.9
    }
    // 1*パターン
    else if (/^1\*?$/.test(text)) {
      type = 'one_star'
      meaning = '1*パターン'
      confidence = 0.9
    }
    // 価格のみ
    else if (/^[\d,]+$/.test(text)) {
      const num = parseInt(text.replace(/,/g, ''))
      if (num >= 50 && num <= 50000) {
        type = 'price'
        meaning = '価格候補'
        confidence = 0.7
      } else {
        type = 'number'
        meaning = '数値（価格範囲外）'
        confidence = 0.6
        issues.push('価格範囲外')
      }
    }
    // 日付
    else if (/^\d{4}年\d{1,2}月/.test(text)) {
      type = 'date'
      meaning = '日付'
      confidence = 0.95
    }
    // 店舗情報
    else if (/TEL|FAX|住所/.test(text)) {
      type = 'store_info'
      meaning = '店舗情報'
      confidence = 0.9
    }
    // 集計行
    else if (/合計|小計|税|売上/.test(text)) {
      type = 'summary'
      meaning = '集計行'
      confidence = 0.95
    }
    // 特殊文字
    else if (/[※●○◯⚫°•]/.test(text)) {
      type = 'special_char'
      meaning = '特殊文字含む'
      confidence = 0.6
      issues.push('OCR誤読の可能性')
    }
    // 短すぎる
    else if (text.length === 1) {
      type = 'single_char'
      meaning = '1文字のみ'
      confidence = 0.3
      issues.push('文字分離の可能性')
    }
    
    return { type, confidence, issues, meaning }
  }

  /**
   * 問題診断（ソフト版）
   */
  private static diagnoseProblemsSoft(rawAnalysis: any, structureAnalysis: any, lineAnalysis: any[]) {
    const ocrIssues: string[] = []
    const structuralIssues: string[] = []
    const contentIssues: string[] = []
    const recommendations: string[] = []
    
    // OCR品質問題
    if (rawAnalysis.emptyLines / rawAnalysis.totalLines > 0.3) {
      ocrIssues.push('空行が多すぎる（OCR品質問題の可能性）')
    }
    
    if (rawAnalysis.shortLines > rawAnalysis.totalLines * 0.2) {
      ocrIssues.push('短い行が多い（文字分離問題の可能性）')
    }
    
    const specialCharLines = lineAnalysis.filter(line => line.classification === 'special_char').length
    if (specialCharLines > 3) {
      ocrIssues.push('特殊文字が多い（OCR誤読の可能性）')
    }
    
    // 構造問題
    if (structureAnalysis.detectedPatterns.length === 0) {
      structuralIssues.push('認識可能なパターンが見つからない')
    }
    
    if (structureAnalysis.complexity === 'complex') {
      structuralIssues.push('レシート構造が複雑すぎる')
    }
    
    // 内容問題
    const productNameCandidates = lineAnalysis.filter(line => line.classification === 'product_name').length
    if (productNameCandidates < 3) {
      contentIssues.push('商品名候補が少ない')
    }
    
    const lowConfidenceLines = lineAnalysis.filter(line => line.confidence < 0.5).length
    if (lowConfidenceLines > lineAnalysis.length * 0.3) {
      contentIssues.push('信頼度の低い行が多い')
    }
    
    // 推奨事項
    if (ocrIssues.length > 0) {
      recommendations.push('画像前処理の改善（コントラスト調整、ノイズ除去）')
      recommendations.push('OCR設定の見直し（解像度、文字認識精度）')
    }
    
    if (structuralIssues.length > 0) {
      recommendations.push('柔軟パターンマッチングの使用')
      recommendations.push('複数解析手法の併用')
    }
    
    if (contentIssues.length > 0) {
      recommendations.push('商品名判定条件の緩和')
      recommendations.push('フォールバック解析の強化')
    }
    
    return { ocrIssues, structuralIssues, contentIssues, recommendations }
  }

  /**
   * 商品名らしさの判定
   */
  private static looksLikeProductName(text: string): boolean {
    if (!text || text.length < 2) return false
    
    // 基本的な文字が含まれている
    if (!/[あ-んア-ンa-zA-Z0-9]/.test(text)) return false
    
    // 明らかに商品名ではない
    const excludePatterns = [
      /^[\d\s,]+$/,
      /^X\d+$/i,
      /^\d{5,7}$/,
      /^1\*?$/,
      /^¥[\d,]+$/,
      /^[\d,]+円?$/,
      /^[\d,]+\s+[TE]$/,
      /合計|小計|税|売上/,
      /^\d{4}年/,
      /TEL|FAX|住所/
    ]
    
    return !excludePatterns.some(pattern => pattern.test(text))
  }

  /**
   * 包括的レポート生成
   */
  private static generateComprehensiveReport(
    rawAnalysis: any,
    structureAnalysis: any,
    lineAnalysis: any[],
    problemDiagnosis: any
  ): string {
    const detectionRate = lineAnalysis.filter(line => 
      line.classification === 'product_name'
    ).length / lineAnalysis.length * 100
    
    const avgConfidence = lineAnalysis.length > 0 
      ? lineAnalysis.reduce((sum, line) => sum + line.confidence, 0) / lineAnalysis.length
      : 0
    
    return `
📋 包括的レシート分析レポート
============================

🏗️ 基本構造:
- 総行数: ${rawAnalysis.totalLines}
- 有効行数: ${lineAnalysis.length}
- 空行率: ${(rawAnalysis.emptyLines / rawAnalysis.totalLines * 100).toFixed(1)}%

📊 内容分析:
- 商品名候補: ${lineAnalysis.filter(l => l.classification === 'product_name').length}行
- 価格情報: ${lineAnalysis.filter(l => l.classification.includes('price')).length}行
- 商品コード: ${lineAnalysis.filter(l => l.classification === 'product_code').length}行
- 平均信頼度: ${avgConfidence.toFixed(3)}

🎯 検出パターン:
${structureAnalysis.detectedPatterns.map(p => 
  `- ${p.pattern}: 信頼度 ${p.confidence.toFixed(2)}`
).join('\n')}

⚠️ 主要問題:
${[...problemDiagnosis.ocrIssues, ...problemDiagnosis.structuralIssues, ...problemDiagnosis.contentIssues]
  .map(issue => `- ${issue}`).join('\n')}

💡 推奨改善策:
${problemDiagnosis.recommendations.map(rec => `- ${rec}`).join('\n')}

📈 改善見込み:
- 現在の商品名検出率: ${detectionRate.toFixed(1)}%
- 改善後見込み: ${Math.min(detectionRate * 1.5, 90).toFixed(1)}%
    `.trim()
  }

  /**
   * パフォーマンス診断
   */
  static diagnosePerformance(ocrText: string, extractedItems: any[]): {
    efficiency: number
    accuracy: number
    issues: string[]
    improvements: string[]
  } {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const efficiency = lines.length > 0 ? extractedItems.length / lines.length : 0
    
    // 簡易精度計算
    const highConfidenceItems = extractedItems.filter(item => item.confidence > 0.8).length
    const accuracy = extractedItems.length > 0 ? highConfidenceItems / extractedItems.length : 0
    
    const issues: string[] = []
    const improvements: string[] = []
    
    if (efficiency < 0.1) {
      issues.push('抽出効率が低い（10%未満）')
      improvements.push('パターンマッチング条件の見直し')
    }
    
    if (accuracy < 0.7) {
      issues.push('抽出精度が低い（70%未満）')
      improvements.push('信頼度計算アルゴリズムの改善')
    }
    
    if (extractedItems.length === 0) {
      issues.push('商品が一つも抽出されていない')
      improvements.push('フォールバック機能の強化')
    }
    
    return { efficiency, accuracy, issues, improvements }
  }
}