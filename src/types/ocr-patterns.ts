// OCRパターン認識システムの型定義

export interface OCRPatternConfig {
  id: string
  name: string
  description: string
  priority: number
  enabled: boolean
  storeIdentifiers: string[]
  confidence: number
  patterns: OCRPattern[]
  postProcessors?: string[]
}

export interface OCRPattern {
  id: string
  name: string
  type: 'single-line' | 'multi-line' | 'context-aware' | 'template-based'
  regex?: string
  lineCount?: number
  contextRules?: ContextRule[]
  extractionRules: ExtractionRule[]
  validationRules?: ValidationRule[]
  confidence: number
}

export interface ContextRule {
  type: 'previous-line' | 'next-line' | 'surrounding-lines' | 'section'
  pattern: string
  required: boolean
}

export interface ExtractionRule {
  field: 'name' | 'price' | 'quantity' | 'category' | 'unit'
  source: 'regex-group' | 'line-content' | 'context' | 'calculation'
  groupIndex?: number
  lineOffset?: number
  transformation?: string
  defaultValue?: string | number
}

export interface ValidationRule {
  field: string
  type: 'range' | 'pattern' | 'length' | 'custom'
  min?: number
  max?: number
  pattern?: string
  customValidator?: string
}

export interface OCRParseResult {
  patternId: string
  confidence: number
  items: ExtractedItem[]
  metadata: {
    storeType?: string
    processingTime: number
    patternsAttempted: string[]
    fallbackUsed?: boolean
  }
}

export interface ExtractedItem {
  name: string
  price?: number
  quantity?: number
  category?: string
  unit?: string
  confidence: number
  sourcePattern: string
  lineNumbers: number[]
  rawText: string
}

export interface StorePattern {
  storeId: string
  storeName: string
  identifiers: string[]
  description: string
  patterns: OCRPatternConfig[]
}

// パターン処理エンジン
export interface PatternProcessor {
  processText(text: string, patterns: OCRPatternConfig[]): Promise<OCRParseResult>
  detectStoreType(text: string): Promise<string | null>
  validateResults(results: OCRParseResult): boolean
  optimizeResults(results: OCRParseResult): OCRParseResult
}

// パターン管理
export interface PatternManager {
  loadPatterns(): Promise<OCRPatternConfig[]>
  addPattern(pattern: OCRPatternConfig): Promise<void>
  updatePattern(id: string, pattern: Partial<OCRPatternConfig>): Promise<void>
  deletePattern(id: string): Promise<void>
  getPatternsByStore(storeId: string): Promise<OCRPatternConfig[]>
  testPattern(pattern: OCRPatternConfig, testText: string): Promise<OCRParseResult>
}

// レシート分析コンテキスト
export interface ReceiptAnalysisContext {
  originalText: string
  lines: string[]
  detectedStoreType?: string
  imageMetadata?: {
    width: number
    height: number
    quality: number
  }
  processingOptions: {
    enableFallback: boolean
    maxProcessingTime: number
    confidenceThreshold: number
  }
}