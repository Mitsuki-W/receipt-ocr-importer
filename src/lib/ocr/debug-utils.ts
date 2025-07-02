import { ExtractedItem, OCRParseResult } from '@/types/ocr-patterns'

/**
 * OCRデバッグ・ログ処理専用ユーティリティ
 * 重複していたデバッグ処理を統合
 */
export class DebugUtils {

  // ログレベル定義
  static readonly LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  } as const

  // 現在のログレベル
  private static currentLogLevel = this.LOG_LEVELS.INFO

  // ログ履歴
  private static logHistory: Array<{
    timestamp: Date
    level: keyof typeof DebugUtils.LOG_LEVELS
    message: string
    data?: any
  }> = []

  // パフォーマンス測定用
  private static performanceMarks = new Map<string, number>()

  /**
   * ログレベルの設定
   */
  static setLogLevel(level: keyof typeof DebugUtils.LOG_LEVELS): void {
    this.currentLogLevel = this.LOG_LEVELS[level]
  }

  /**
   * エラーログ
   */
  static error(message: string, data?: any): void {
    this.log('ERROR', message, data)
  }

  /**
   * 警告ログ
   */
  static warn(message: string, data?: any): void {
    this.log('WARN', message, data)
  }

  /**
   * 情報ログ
   */
  static info(message: string, data?: any): void {
    this.log('INFO', message, data)
  }

  /**
   * デバッグログ
   */
  static debug(message: string, data?: any): void {
    this.log('DEBUG', message, data)
  }

  /**
   * 統一されたログ出力
   */
  private static log(level: keyof typeof DebugUtils.LOG_LEVELS, message: string, data?: any): void {
    const levelValue = this.LOG_LEVELS[level]
    
    if (levelValue <= this.currentLogLevel) {
      const timestamp = new Date()
      const emoji = this.getLogEmoji(level)
      
      if (data) {
        console.log(`${emoji} ${message}`, data)
      } else {
        console.log(`${emoji} ${message}`)
      }
      
      // 履歴に保存
      this.logHistory.push({
        timestamp,
        level,
        message,
        data
      })
      
      // 履歴サイズ制限
      if (this.logHistory.length > 1000) {
        this.logHistory = this.logHistory.slice(-500)
      }
    }
  }

  /**
   * ログレベル用絵文字
   */
  private static getLogEmoji(level: keyof typeof DebugUtils.LOG_LEVELS): string {
    const emojis = {
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🔍'
    }
    return emojis[level]
  }

  /**
   * OCR処理開始ログ
   */
  static logOCRStart(options: any): void {
    this.info('🤖 OCR処理開始', {
      options: this.sanitizeOptions(options),
      timestamp: new Date().toISOString()
    })
  }

  /**
   * OCR処理完了ログ
   */
  static logOCRComplete(result: any, processingTime: number): void {
    this.info('✅ OCR処理完了', {
      itemsDetected: result.items?.length || 0,
      success: result.success,
      processingTime: `${processingTime}ms`,
      confidence: result.metadata?.confidence ? `${(result.metadata.confidence * 100).toFixed(1)}%` : 'N/A'
    })
  }

  /**
   * パターンマッチング結果ログ
   */
  static logPatternMatching(patternId: string, itemsFound: number, confidence: number): void {
    this.debug(`🎯 パターンマッチング: ${patternId}`, {
      itemsFound,
      confidence: `${(confidence * 100).toFixed(1)}%`
    })
  }

  /**
   * エラー詳細ログ
   */
  static logError(context: string, error: unknown, additionalData?: any): void {
    const errorInfo = {
      context,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      additionalData
    }
    
    this.error(`❌ エラー発生 (${context})`, errorInfo)
  }

  /**
   * 店舗検出ログ
   */
  static logStoreDetection(detectedStore: string | null, confidence?: number): void {
    if (detectedStore) {
      this.info(`🏪 店舗検出: ${detectedStore}`, {
        confidence: confidence ? `${(confidence * 100).toFixed(1)}%` : 'N/A'
      })
    } else {
      this.warn('🏪 店舗を特定できませんでした')
    }
  }

  /**
   * フォールバック処理ログ
   */
  static logFallback(reason: string, fallbackType: string): void {
    this.warn(`🔄 フォールバック処理: ${fallbackType}`, { reason })
  }

  /**
   * 統計情報ログ
   */
  static logStatistics(stats: {
    totalLines?: number
    itemsDetected?: number
    processingTime?: number
    confidence?: number
    [key: string]: any
  }): void {
    this.info('📊 処理統計', stats)
  }

  /**
   * パフォーマンス測定開始
   */
  static startPerformanceMark(name: string): void {
    this.performanceMarks.set(name, Date.now())
    this.debug(`⏱️ パフォーマンス測定開始: ${name}`)
  }

  /**
   * パフォーマンス測定終了
   */
  static endPerformanceMark(name: string): number {
    const startTime = this.performanceMarks.get(name)
    if (!startTime) {
      this.warn(`⏱️ パフォーマンスマーク "${name}" が見つかりません`)
      return 0
    }
    
    const duration = Date.now() - startTime
    this.performanceMarks.delete(name)
    this.debug(`⏱️ パフォーマンス測定完了: ${name}`, { duration: `${duration}ms` })
    
    return duration
  }

  /**
   * アイテム詳細ログ
   */
  static logExtractedItems(items: ExtractedItem[], maxItems: number = 10): void {
    if (items.length === 0) {
      this.warn('📝 抽出されたアイテムがありません')
      return
    }

    this.info(`📝 抽出アイテム詳細 (${items.length}件)`)
    
    const displayItems = items.slice(0, maxItems)
    displayItems.forEach((item, index) => {
      this.debug(`  ${index + 1}. ${item.name}`, {
        price: item.price,
        quantity: item.quantity,
        confidence: `${(item.confidence * 100).toFixed(1)}%`,
        pattern: item.sourcePattern,
        lines: item.lineNumbers
      })
    })
    
    if (items.length > maxItems) {
      this.debug(`  ... 他 ${items.length - maxItems} 件`)
    }
  }

  /**
   * テキスト分析ログ
   */
  static logTextAnalysis(text: string, maxLines: number = 20): void {
    const lines = text.split('\n').filter(line => line.trim())
    
    this.info(`📄 OCRテキスト分析`, {
      totalLines: lines.length,
      totalChars: text.length,
      avgLineLength: lines.length > 0 ? Math.round(text.length / lines.length) : 0
    })
    
    this.debug('📄 OCRテキスト内容（先頭部分）:')
    const displayLines = lines.slice(0, maxLines)
    displayLines.forEach((line, index) => {
      this.debug(`  ${(index + 1).toString().padStart(2)}: ${line}`)
    })
    
    if (lines.length > maxLines) {
      this.debug(`  ... 他 ${lines.length - maxLines} 行`)
    }
  }

  /**
   * バリデーション結果ログ
   */
  static logValidationResults(
    originalCount: number, 
    validatedCount: number, 
    issues: string[]
  ): void {
    const reductionRate = originalCount > 0 
      ? ((originalCount - validatedCount) / originalCount * 100).toFixed(1)
      : '0'
    
    this.info(`✅ バリデーション完了`, {
      original: originalCount,
      validated: validatedCount,
      removed: originalCount - validatedCount,
      reductionRate: `${reductionRate}%`
    })
    
    if (issues.length > 0) {
      this.warn(`⚠️ バリデーション警告 (${issues.length}件)`)
      issues.slice(0, 5).forEach(issue => {
        this.debug(`  • ${issue}`)
      })
      if (issues.length > 5) {
        this.debug(`  ... 他 ${issues.length - 5} 件`)
      }
    }
  }

  /**
   * 修正統計ログ
   */
  static logCorrections(corrections: Array<{
    field: string
    originalValue: any
    correctedValue: any
    reason: string
  }>): void {
    if (corrections.length === 0) {
      this.debug('🔧 自動修正なし')
      return
    }
    
    this.info(`🔧 自動修正実行 (${corrections.length}件)`)
    
    const groupedCorrections = corrections.reduce((acc, correction) => {
      if (!acc[correction.field]) {
        acc[correction.field] = 0
      }
      acc[correction.field]++
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(groupedCorrections).forEach(([field, count]) => {
      this.debug(`  ${field}: ${count}件`)
    })
  }

  /**
   * デバッグレポート生成
   */
  static generateDebugReport(): {
    summary: {
      totalLogs: number
      errorCount: number
      warnCount: number
      sessionDuration: string
    }
    recentLogs: typeof DebugUtils.logHistory
    performance: {
      activeMarks: string[]
      completedOperations: number
    }
  } {
    const errorCount = this.logHistory.filter(log => log.level === 'ERROR').length
    const warnCount = this.logHistory.filter(log => log.level === 'WARN').length
    
    const firstLog = this.logHistory[0]
    const lastLog = this.logHistory[this.logHistory.length - 1]
    const sessionDuration = firstLog && lastLog 
      ? `${Math.round((lastLog.timestamp.getTime() - firstLog.timestamp.getTime()) / 1000)}秒`
      : '不明'
    
    return {
      summary: {
        totalLogs: this.logHistory.length,
        errorCount,
        warnCount,
        sessionDuration
      },
      recentLogs: this.logHistory.slice(-20), // 最新20件
      performance: {
        activeMarks: Array.from(this.performanceMarks.keys()),
        completedOperations: this.logHistory.filter(log => 
          log.message.includes('完了') || log.message.includes('complete')
        ).length
      }
    }
  }

  /**
   * ログ履歴のクリア
   */
  static clearLogs(): void {
    this.logHistory = []
    this.performanceMarks.clear()
    this.info('🧹 ログ履歴をクリアしました')
  }

  /**
   * ログ履歴のエクスポート
   */
  static exportLogs(): string {
    const report = this.generateDebugReport()
    return JSON.stringify(report, null, 2)
  }

  /**
   * オプションの機密情報除去
   */
  private static sanitizeOptions(options: any): any {
    if (!options || typeof options !== 'object') return options
    
    const sanitized = { ...options }
    
    // 機密情報フィールドをマスク
    const sensitiveFields = ['apiKey', 'secret', 'password', 'token', 'credentials']
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***masked***'
      }
    })
    
    return sanitized
  }

  /**
   * 条件付きログ（本番環境では無効化）
   */
  static conditionalLog(condition: boolean, level: keyof typeof DebugUtils.LOG_LEVELS, message: string, data?: any): void {
    if (condition) {
      this.log(level, message, data)
    }
  }

  /**
   * 処理時間付きログ
   */
  static timedLog<T>(operation: () => T, operationName: string): T {
    this.startPerformanceMark(operationName)
    try {
      const result = operation()
      const duration = this.endPerformanceMark(operationName)
      this.info(`⏱️ ${operationName} 完了 (${duration}ms)`)
      return result
    } catch (error) {
      this.endPerformanceMark(operationName)
      this.logError(operationName, error)
      throw error
    }
  }

  /**
   * 非同期処理時間付きログ
   */
  static async timedLogAsync<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    this.startPerformanceMark(operationName)
    try {
      const result = await operation()
      const duration = this.endPerformanceMark(operationName)
      this.info(`⏱️ ${operationName} 完了 (${duration}ms)`)
      return result
    } catch (error) {
      this.endPerformanceMark(operationName)
      this.logError(operationName, error)
      throw error
    }
  }

  /**
   * メモリ使用量ログ
   */
  static logMemoryUsage(context: string = ''): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      const memory = (window.performance as any).memory
      this.debug(`💾 メモリ使用量${context ? ` (${context})` : ''}`, {
        used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
      })
    }
  }

  /**
   * テーブル形式でのアイテム表示
   */
  static logItemsTable(items: ExtractedItem[]): void {
    if (items.length === 0) {
      this.info('📋 表示するアイテムがありません')
      return
    }

    this.info(`📋 抽出アイテム一覧 (${items.length}件)`)
    
    // テーブルヘッダー
    const tableData = items.map((item, index) => ({
      '#': index + 1,
      '商品名': item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
      '価格': item.price || '-',
      '数量': item.quantity || 1,
      '信頼度': `${Math.round(item.confidence * 100)}%`,
      'パターン': item.sourcePattern || '-'
    }))
    
    console.table(tableData)
  }
}