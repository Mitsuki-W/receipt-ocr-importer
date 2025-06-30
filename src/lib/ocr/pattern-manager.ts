import { PatternManager, OCRPatternConfig, OCRParseResult } from '@/types/ocr-patterns'
import { DEFAULT_PATTERNS } from './pattern-configs'
import { AdvancedPatternProcessor } from './pattern-processor'

export class OCRPatternManager implements PatternManager {
  private patterns: Map<string, OCRPatternConfig> = new Map()
  private processor: AdvancedPatternProcessor
  private initialized = false

  constructor() {
    this.processor = new AdvancedPatternProcessor()
  }

  async loadPatterns(): Promise<OCRPatternConfig[]> {
    if (!this.initialized) {
      await this.initialize()
    }
    return Array.from(this.patterns.values())
  }

  async addPattern(pattern: OCRPatternConfig): Promise<void> {
    // パターンの検証
    this.validatePattern(pattern)
    
    // パターンIDの重複チェック
    if (this.patterns.has(pattern.id)) {
      throw new Error(`Pattern with ID '${pattern.id}' already exists`)
    }

    this.patterns.set(pattern.id, { ...pattern })
    await this.saveToStorage()
  }

  async updatePattern(id: string, updates: Partial<OCRPatternConfig>): Promise<void> {
    const existingPattern = this.patterns.get(id)
    if (!existingPattern) {
      throw new Error(`Pattern with ID '${id}' not found`)
    }

    const updatedPattern = { ...existingPattern, ...updates }
    this.validatePattern(updatedPattern)
    
    this.patterns.set(id, updatedPattern)
    await this.saveToStorage()
  }

  async deletePattern(id: string): Promise<void> {
    if (!this.patterns.has(id)) {
      throw new Error(`Pattern with ID '${id}' not found`)
    }

    this.patterns.delete(id)
    await this.saveToStorage()
  }

  async getPatternsByStore(storeId: string): Promise<OCRPatternConfig[]> {
    const allPatterns = await this.loadPatterns()
    return allPatterns.filter(pattern => 
      pattern.storeIdentifiers.includes(storeId) || 
      pattern.storeIdentifiers.length === 0 // 汎用パターン
    )
  }

  async testPattern(pattern: OCRPatternConfig, testText: string): Promise<OCRParseResult> {
    try {
      const result = await this.processor.processText(testText, [pattern])
      return result
    } catch (error) {
      throw new Error(`Pattern test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 店舗タイプからパターンを取得
  async getOptimalPatterns(storeType?: string): Promise<OCRPatternConfig[]> {
    const allPatterns = await this.loadPatterns()
    
    if (!storeType) {
      return allPatterns.filter(p => p.enabled).sort((a, b) => b.priority - a.priority)
    }

    const storePatterns = allPatterns.filter(p => 
      p.enabled && (
        p.storeIdentifiers.includes(storeType) || 
        p.storeIdentifiers.length === 0
      )
    )

    return storePatterns.sort((a, b) => {
      // 店舗固有パターンを優先
      const aStoreSpecific = a.storeIdentifiers.includes(storeType) ? 1 : 0
      const bStoreSpecific = b.storeIdentifiers.includes(storeType) ? 1 : 0
      
      if (aStoreSpecific !== bStoreSpecific) {
        return bStoreSpecific - aStoreSpecific
      }
      
      return b.priority - a.priority
    })
  }

  // パターンの統計情報
  async getPatternStats(): Promise<{
    total: number
    enabled: number
    byStore: Record<string, number>
    byType: Record<string, number>
  }> {
    const patterns = await this.loadPatterns()
    
    const stats = {
      total: patterns.length,
      enabled: patterns.filter(p => p.enabled).length,
      byStore: {} as Record<string, number>,
      byType: {} as Record<string, number>
    }

    patterns.forEach(pattern => {
      // 店舗別統計
      pattern.storeIdentifiers.forEach(store => {
        stats.byStore[store] = (stats.byStore[store] || 0) + 1
      })
      
      // タイプ別統計
      pattern.patterns.forEach(p => {
        stats.byType[p.type] = (stats.byType[p.type] || 0) + 1
      })
    })

    return stats
  }

  // パターンのインポート/エクスポート
  async exportPatterns(): Promise<string> {
    const patterns = await this.loadPatterns()
    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      patterns
    }, null, 2)
  }

  async importPatterns(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData)
      
      if (!data.patterns || !Array.isArray(data.patterns)) {
        throw new Error('Invalid pattern data format')
      }

      // パターンの検証
      data.patterns.forEach((pattern: OCRPatternConfig) => {
        this.validatePattern(pattern)
      })

      // 既存パターンをバックアップ
      const backup = new Map(this.patterns)
      
      try {
        // 新しいパターンを追加
        data.patterns.forEach((pattern: OCRPatternConfig) => {
          this.patterns.set(pattern.id, pattern)
        })
        
        await this.saveToStorage()
      } catch (error) {
        // エラー時はバックアップから復元
        this.patterns = backup
        throw error
      }
    } catch (error) {
      throw new Error(`Pattern import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async initialize(): Promise<void> {
    try {
      // サーバーサイド環境では localStorage を使用しない
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('ocr-patterns')
        if (stored) {
          const patterns = JSON.parse(stored) as OCRPatternConfig[]
          patterns.forEach(pattern => {
            this.patterns.set(pattern.id, pattern)
          })
          console.log(`Loaded ${patterns.length} patterns from storage`)
          this.initialized = true
          return
        }
      }
      
      // デフォルトパターンを設定
      DEFAULT_PATTERNS.forEach(pattern => {
        this.patterns.set(pattern.id, pattern)
      })
      console.log(`Loaded ${DEFAULT_PATTERNS.length} default patterns`)
      
      // サーバーサイドでは保存をスキップ
      if (typeof window !== 'undefined' && window.localStorage) {
        await this.saveToStorage()
      }
    } catch (error) {
      console.warn('Failed to load patterns from storage, using defaults:', error)
      // デフォルトパターンでフォールバック
      DEFAULT_PATTERNS.forEach(pattern => {
        this.patterns.set(pattern.id, pattern)
      })
    }
    
    this.initialized = true
  }

  private validatePattern(pattern: OCRPatternConfig): void {
    if (!pattern.id || typeof pattern.id !== 'string') {
      throw new Error('Pattern must have a valid ID')
    }
    
    if (!pattern.name || typeof pattern.name !== 'string') {
      throw new Error('Pattern must have a valid name')
    }
    
    if (!Array.isArray(pattern.patterns) || pattern.patterns.length === 0) {
      throw new Error('Pattern must have at least one sub-pattern')
    }
    
    if (typeof pattern.priority !== 'number') {
      throw new Error('Pattern must have a numeric priority')
    }
    
    if (typeof pattern.confidence !== 'number' || pattern.confidence < 0 || pattern.confidence > 1) {
      throw new Error('Pattern confidence must be a number between 0 and 1')
    }

    // サブパターンの検証
    pattern.patterns.forEach((subPattern, index) => {
      if (!subPattern.id || !subPattern.name) {
        throw new Error(`Sub-pattern ${index} must have ID and name`)
      }
      
      if (!['single-line', 'multi-line', 'context-aware', 'template-based'].includes(subPattern.type)) {
        throw new Error(`Sub-pattern ${index} has invalid type: ${subPattern.type}`)
      }
      
      if (!Array.isArray(subPattern.extractionRules) || subPattern.extractionRules.length === 0) {
        throw new Error(`Sub-pattern ${index} must have extraction rules`)
      }
    })
  }

  private async saveToStorage(): Promise<void> {
    try {
      // サーバーサイド環境では localStorage を使用しない
      if (typeof window !== 'undefined' && window.localStorage) {
        const patterns = Array.from(this.patterns.values())
        localStorage.setItem('ocr-patterns', JSON.stringify(patterns))
      }
    } catch (error) {
      console.error('Failed to save patterns to storage:', error)
      // サーバーサイドでは無視
    }
  }

  // パターンの複製
  async duplicatePattern(id: string, newId: string, newName: string): Promise<void> {
    const original = this.patterns.get(id)
    if (!original) {
      throw new Error(`Pattern with ID '${id}' not found`)
    }

    if (this.patterns.has(newId)) {
      throw new Error(`Pattern with ID '${newId}' already exists`)
    }

    const duplicated: OCRPatternConfig = {
      ...original,
      id: newId,
      name: newName,
      patterns: original.patterns.map(p => ({
        ...p,
        id: `${newId}-${p.id.split('-').pop()}`
      }))
    }

    await this.addPattern(duplicated)
  }

  // パターンの有効/無効切り替え
  async togglePattern(id: string): Promise<void> {
    const pattern = this.patterns.get(id)
    if (!pattern) {
      throw new Error(`Pattern with ID '${id}' not found`)
    }

    await this.updatePattern(id, { enabled: !pattern.enabled })
  }
}