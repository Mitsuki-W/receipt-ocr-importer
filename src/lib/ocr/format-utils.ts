import { ExtractedItem, OCRParseResult } from '@/types/ocr-patterns'
import { ProductCategorizer } from './product-categorizer'

/**
 * OCR結果フォーマッティング専用ユーティリティ
 * 結果の整形・変換・出力に関する処理を集約
 */
export class FormatUtils {

  /**
   * ExtractedItemの標準フォーマットへの変換
   */
  static normalizeExtractedItem(item: ExtractedItem): ExtractedItem {
    return {
      name: this.formatProductName(item.name),
      price: this.formatPrice(item.price),
      quantity: this.formatQuantity(item.quantity),
      confidence: this.formatConfidence(item.confidence),
      sourcePattern: item.sourcePattern || 'unknown',
      lineNumbers: item.lineNumbers || [],
      rawText: item.rawText || '',
      category: this.formatCategory(item.name, item.category),
      currency: item.currency || 'JPY',
      metadata: item.metadata || {}
    }
  }

  /**
   * 商品名のフォーマット
   */
  static formatProductName(name: string): string {
    if (!name) return ''
    
    return name
      .trim()                              // 前後の空白除去
      .replace(/^[※*\s]+/, '')             // 先頭の記号除去
      .replace(/[*\s]+$/, '')              // 末尾の記号除去
      .replace(/\s+/g, ' ')                // 複数空白を単一空白に
      .replace(/[""'']/g, '')              // 引用符除去
      .substring(0, 50)                    // 最大50文字に制限
  }

  /**
   * 価格のフォーマット
   */
  static formatPrice(price?: number): number | undefined {
    if (price === undefined || price === null || isNaN(price)) {
      return undefined
    }
    
    // 負の値は無効
    if (price < 0) return undefined
    
    // 小数点処理（日本円は整数、ドルは小数点2位まで）
    if (price < 1000 && price % 1 !== 0) {
      // ドル形式の可能性
      return Math.round(price * 100) / 100
    } else {
      // 日本円形式
      return Math.round(price)
    }
  }

  /**
   * 数量のフォーマット
   */
  static formatQuantity(quantity?: number): number {
    if (quantity === undefined || quantity === null || isNaN(quantity)) {
      return 1
    }
    
    // 正の整数に丸める
    const formatted = Math.round(Math.abs(quantity))
    return formatted > 0 ? formatted : 1
  }

  /**
   * 信頼度のフォーマット
   */
  static formatConfidence(confidence: number): number {
    if (confidence === undefined || confidence === null || isNaN(confidence)) {
      return 0.5
    }
    
    // 0-1の範囲に制限
    const clamped = Math.max(0, Math.min(1, confidence))
    
    // 小数点3位で丸める
    return Math.round(clamped * 1000) / 1000
  }

  /**
   * カテゴリのフォーマット
   */
  static formatCategory(productName: string, existingCategory?: string): string {
    // 既存のカテゴリが有効な場合はそのまま使用
    if (existingCategory && existingCategory !== 'その他' && existingCategory !== '') {
      return existingCategory
    }
    
    // ProductCategorizerで再分類
    return ProductCategorizer.categorize(productName)
  }

  /**
   * 複数アイテムの一括フォーマット
   */
  static formatItemsArray(items: ExtractedItem[]): ExtractedItem[] {
    return items
      .map(item => this.normalizeExtractedItem(item))
      .filter(item => this.isValidFormattedItem(item))
      .sort((a, b) => {
        // 信頼度順、次に行番号順でソート
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence
        }
        const aMinLine = Math.min(...(a.lineNumbers || [999]))
        const bMinLine = Math.min(...(b.lineNumbers || [999]))
        return aMinLine - bMinLine
      })
  }

  /**
   * フォーマット済みアイテムの妥当性チェック
   */
  static isValidFormattedItem(item: ExtractedItem): boolean {
    // 必須フィールドチェック
    if (!item.name || item.name.length < 1) return false
    if (item.price === undefined || item.price <= 0) return false
    if (item.confidence < 0.1) return false
    
    // 商品名の基本的なバリデーション
    if (/^\d+$/.test(item.name)) return false // 数字のみは無効
    if (/^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(item.name)) return false // 記号のみは無効
    
    return true
  }

  /**
   * JSON出力フォーマット
   */
  static toJSON(items: ExtractedItem[], metadata?: any): string {
    const formatted = {
      items: this.formatItemsArray(items),
      metadata: {
        count: items.length,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }
    
    return JSON.stringify(formatted, null, 2)
  }

  /**
   * CSV出力フォーマット
   */
  static toCSV(items: ExtractedItem[]): string {
    if (items.length === 0) {
      return 'name,price,quantity,category,confidence,currency\n'
    }
    
    const formatted = this.formatItemsArray(items)
    const headers = ['name', 'price', 'quantity', 'category', 'confidence', 'currency']
    const csvRows = [headers.join(',')]
    
    formatted.forEach(item => {
      const row = [
        `"${item.name.replace(/"/g, '""')}"`, // 商品名はクォートでエスケープ
        item.price || 0,
        item.quantity || 1,
        `"${item.category || 'その他'}"`,
        item.confidence.toFixed(3),
        item.currency || 'JPY'
      ]
      csvRows.push(row.join(','))
    })
    
    return csvRows.join('\n')
  }

  /**
   * Markdown表形式出力
   */
  static toMarkdownTable(items: ExtractedItem[]): string {
    if (items.length === 0) {
      return '| 商品名 | 価格 | 数量 | カテゴリ | 信頼度 |\n|--------|------|------|----------|--------|\n'
    }
    
    const formatted = this.formatItemsArray(items)
    const lines = [
      '| 商品名 | 価格 | 数量 | カテゴリ | 信頼度 |',
      '|--------|------|------|----------|--------|'
    ]
    
    formatted.forEach(item => {
      const priceFormatted = item.currency === 'USD' 
        ? `$${item.price?.toFixed(2) || '0.00'}`
        : `¥${item.price?.toLocaleString() || '0'}`
      
      const confidencePercentage = `${Math.round((item.confidence || 0) * 100)}%`
      
      lines.push([
        `| ${item.name}`,
        priceFormatted,
        item.quantity || 1,
        item.category || 'その他',
        `${confidencePercentage} |`
      ].join(' | '))
    })
    
    return lines.join('\n')
  }

  /**
   * HTML表形式出力
   */
  static toHTMLTable(items: ExtractedItem[], options?: {
    includeMetadata?: boolean
    className?: string
  }): string {
    const opts = {
      includeMetadata: false,
      className: 'ocr-results-table',
      ...options
    }
    
    const formatted = this.formatItemsArray(items)
    
    let html = `<table class="${opts.className}">\n`
    html += '  <thead>\n'
    html += '    <tr>\n'
    html += '      <th>商品名</th>\n'
    html += '      <th>価格</th>\n'
    html += '      <th>数量</th>\n'
    html += '      <th>カテゴリ</th>\n'
    html += '      <th>信頼度</th>\n'
    if (opts.includeMetadata) {
      html += '      <th>パターン</th>\n'
      html += '      <th>行番号</th>\n'
    }
    html += '    </tr>\n'
    html += '  </thead>\n'
    html += '  <tbody>\n'
    
    formatted.forEach(item => {
      const priceFormatted = item.currency === 'USD' 
        ? `$${item.price?.toFixed(2) || '0.00'}`
        : `¥${item.price?.toLocaleString() || '0'}`
      
      const confidencePercentage = Math.round((item.confidence || 0) * 100)
      const confidenceClass = confidencePercentage >= 80 ? 'high' : confidencePercentage >= 60 ? 'medium' : 'low'
      
      html += '    <tr>\n'
      html += `      <td>${this.escapeHtml(item.name)}</td>\n`
      html += `      <td class="price">${priceFormatted}</td>\n`
      html += `      <td class="quantity">${item.quantity || 1}</td>\n`
      html += `      <td class="category">${this.escapeHtml(item.category || 'その他')}</td>\n`
      html += `      <td class="confidence ${confidenceClass}">${confidencePercentage}%</td>\n`
      
      if (opts.includeMetadata) {
        html += `      <td class="pattern">${this.escapeHtml(item.sourcePattern || '')}</td>\n`
        html += `      <td class="lines">${(item.lineNumbers || []).join(', ')}</td>\n`
      }
      
      html += '    </tr>\n'
    })
    
    html += '  </tbody>\n'
    html += '</table>'
    
    return html
  }

  /**
   * サマリー情報の生成
   */
  static generateSummary(items: ExtractedItem[]): {
    totalItems: number
    totalValue: number
    averageConfidence: number
    categoryBreakdown: Record<string, number>
    currencyBreakdown: Record<string, { count: number; total: number }>
    qualityMetrics: {
      highConfidence: number    // >80%
      mediumConfidence: number  // 60-80%
      lowConfidence: number     // <60%
    }
  } {
    const formatted = this.formatItemsArray(items)
    
    // 基本統計
    const totalItems = formatted.length
    const totalValue = formatted.reduce((sum, item) => sum + (item.price || 0), 0)
    const averageConfidence = totalItems > 0 
      ? formatted.reduce((sum, item) => sum + item.confidence, 0) / totalItems 
      : 0
    
    // カテゴリ別集計
    const categoryBreakdown = formatted.reduce((acc, item) => {
      const category = item.category || 'その他'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // 通貨別集計
    const currencyBreakdown = formatted.reduce((acc, item) => {
      const currency = item.currency || 'JPY'
      if (!acc[currency]) {
        acc[currency] = { count: 0, total: 0 }
      }
      acc[currency].count++
      acc[currency].total += item.price || 0
      return acc
    }, {} as Record<string, { count: number; total: number }>)
    
    // 品質メトリクス
    const qualityMetrics = {
      highConfidence: formatted.filter(item => item.confidence >= 0.8).length,
      mediumConfidence: formatted.filter(item => item.confidence >= 0.6 && item.confidence < 0.8).length,
      lowConfidence: formatted.filter(item => item.confidence < 0.6).length
    }
    
    return {
      totalItems,
      totalValue: Math.round(totalValue * 100) / 100,
      averageConfidence: Math.round(averageConfidence * 1000) / 1000,
      categoryBreakdown,
      currencyBreakdown,
      qualityMetrics
    }
  }

  /**
   * 結果の詳細レポート生成
   */
  static generateDetailedReport(
    items: ExtractedItem[], 
    metadata?: any,
    format: 'markdown' | 'html' | 'text' = 'markdown'
  ): string {
    const summary = this.generateSummary(items)
    const timestamp = new Date().toLocaleString('ja-JP')
    
    if (format === 'markdown') {
      return this.generateMarkdownReport(items, summary, metadata, timestamp)
    } else if (format === 'html') {
      return this.generateHTMLReport(items, summary, metadata, timestamp)
    } else {
      return this.generateTextReport(items, summary, metadata, timestamp)
    }
  }

  /**
   * Markdownレポート生成
   */
  private static generateMarkdownReport(
    items: ExtractedItem[],
    summary: any,
    metadata: any,
    timestamp: string
  ): string {
    let report = `# OCR解析結果レポート\n\n`
    report += `**生成日時:** ${timestamp}\n\n`
    
    if (metadata) {
      report += `## 処理情報\n\n`
      report += `- **処理時間:** ${metadata.processingTime || 'N/A'}ms\n`
      report += `- **使用パターン:** ${metadata.patternUsed || 'N/A'}\n`
      report += `- **店舗タイプ:** ${metadata.storeType || 'N/A'}\n`
      report += `- **フォールバック使用:** ${metadata.fallbackUsed ? 'はい' : 'いいえ'}\n\n`
    }
    
    report += `## サマリー\n\n`
    report += `- **検出アイテム数:** ${summary.totalItems}件\n`
    report += `- **合計金額:** ${summary.totalValue.toLocaleString()}円\n`
    report += `- **平均信頼度:** ${(summary.averageConfidence * 100).toFixed(1)}%\n\n`
    
    report += `### 品質メトリクス\n\n`
    report += `- **高信頼度 (80%以上):** ${summary.qualityMetrics.highConfidence}件\n`
    report += `- **中信頼度 (60-80%):** ${summary.qualityMetrics.mediumConfidence}件\n`
    report += `- **低信頼度 (60%未満):** ${summary.qualityMetrics.lowConfidence}件\n\n`
    
    report += `## 検出アイテム一覧\n\n`
    report += this.toMarkdownTable(items)
    
    return report
  }

  /**
   * HTMLレポート生成
   */
  private static generateHTMLReport(
    items: ExtractedItem[],
    summary: any,
    metadata: any,
    timestamp: string
  ): string {
    let html = `<!DOCTYPE html>\n<html>\n<head>\n`
    html += `  <title>OCR解析結果レポート</title>\n`
    html += `  <meta charset="UTF-8">\n`
    html += `  <style>\n`
    html += `    body { font-family: Arial, sans-serif; margin: 20px; }\n`
    html += `    table { border-collapse: collapse; width: 100%; }\n`
    html += `    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n`
    html += `    th { background-color: #f2f2f2; }\n`
    html += `    .confidence.high { color: green; font-weight: bold; }\n`
    html += `    .confidence.medium { color: orange; }\n`
    html += `    .confidence.low { color: red; }\n`
    html += `  </style>\n`
    html += `</head>\n<body>\n`
    
    html += `<h1>OCR解析結果レポート</h1>\n`
    html += `<p><strong>生成日時:</strong> ${timestamp}</p>\n`
    
    html += `<h2>サマリー</h2>\n`
    html += `<ul>\n`
    html += `  <li><strong>検出アイテム数:</strong> ${summary.totalItems}件</li>\n`
    html += `  <li><strong>合計金額:</strong> ${summary.totalValue.toLocaleString()}円</li>\n`
    html += `  <li><strong>平均信頼度:</strong> ${(summary.averageConfidence * 100).toFixed(1)}%</li>\n`
    html += `</ul>\n`
    
    html += `<h2>検出アイテム一覧</h2>\n`
    html += this.toHTMLTable(items, { includeMetadata: true })
    
    html += `</body>\n</html>`
    
    return html
  }

  /**
   * テキストレポート生成
   */
  private static generateTextReport(
    items: ExtractedItem[],
    summary: any,
    metadata: any,
    timestamp: string
  ): string {
    let report = `OCR解析結果レポート\n`
    report += `${'='.repeat(30)}\n\n`
    report += `生成日時: ${timestamp}\n\n`
    
    report += `サマリー:\n`
    report += `- 検出アイテム数: ${summary.totalItems}件\n`
    report += `- 合計金額: ${summary.totalValue.toLocaleString()}円\n`
    report += `- 平均信頼度: ${(summary.averageConfidence * 100).toFixed(1)}%\n\n`
    
    report += `検出アイテム一覧:\n`
    report += `${'-'.repeat(50)}\n`
    
    const formatted = this.formatItemsArray(items)
    formatted.forEach((item, index) => {
      const priceFormatted = item.currency === 'USD' 
        ? `$${item.price?.toFixed(2) || '0.00'}`
        : `¥${item.price?.toLocaleString() || '0'}`
      
      report += `${index + 1}. ${item.name}\n`
      report += `   価格: ${priceFormatted}, 数量: ${item.quantity || 1}, `
      report += `信頼度: ${Math.round((item.confidence || 0) * 100)}%\n`
    })
    
    return report
  }

  /**
   * HTMLエスケープ
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }
}