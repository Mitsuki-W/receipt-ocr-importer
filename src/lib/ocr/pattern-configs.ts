import { OCRPatternConfig, StorePattern } from '@/types/ocr-patterns'

export const DEFAULT_PATTERNS: OCRPatternConfig[] = [
  {
    id: 'warehouse-standard',
    name: '大型店標準パターン',
    description: '大型店レシートの標準的な5行パターン',
    priority: 100,
    enabled: true,
    storeIdentifiers: ['warehouse'],
    confidence: 0.9,
    patterns: [
      {
        id: 'warehouse-5line',
        name: '大型店 5行パターン',
        type: 'multi-line',
        lineCount: 5,
        extractionRules: [
          { field: 'name', source: 'line-content', lineOffset: 0 },
          { field: 'quantity', source: 'regex-group', groupIndex: 1, lineOffset: 2 },
          { field: 'price', source: 'regex-group', groupIndex: 1, lineOffset: 4 }
        ],
        validationRules: [
          { field: 'name', type: 'length', min: 2, max: 50 },
          { field: 'price', type: 'range', min: 1, max: 999999 }
        ],
        confidence: 0.9
      }
    ]
  },
  {
    id: 'supermarket-asterisk',
    name: 'スーパー*印パターン',
    description: 'スーパーマーケットの*印付き商品パターン',
    priority: 90,
    enabled: true,
    storeIdentifiers: ['supermarket-a'],
    confidence: 0.85,
    patterns: [
      {
        id: 'supermarket-inline-asterisk',
        name: 'スーパー行内*パターン',
        type: 'single-line',
        regex: '^\\*(.+?)\\s+¥(\\d{1,5})$',
        extractionRules: [
          { field: 'name', source: 'regex-group', groupIndex: 1 },
          { field: 'price', source: 'regex-group', groupIndex: 2 }
        ],
        confidence: 0.9
      },
      {
        id: 'supermarket-multiline-asterisk',
        name: 'スーパー複数行*パターン',
        type: 'multi-line',
        lineCount: 2,
        extractionRules: [
          { field: 'name', source: 'regex-group', groupIndex: 1, lineOffset: 0 },
          { field: 'price', source: 'regex-group', groupIndex: 1, lineOffset: 1 }
        ],
        confidence: 0.85
      }
    ]
  },
  {
    id: 'convenience-standard',
    name: 'コンビニ標準パターン',
    description: '一般的なコンビニレシートパターン',
    priority: 70,
    enabled: true,
    storeIdentifiers: ['convenience-a', 'convenience-b', 'convenience-c'],
    confidence: 0.75,
    patterns: [
      {
        id: 'convenience-basic',
        name: 'コンビニ基本パターン',
        type: 'single-line',
        regex: '^(.+?)\\s+(\\d{2,4})$',
        extractionRules: [
          { field: 'name', source: 'regex-group', groupIndex: 1 },
          { field: 'price', source: 'regex-group', groupIndex: 2 }
        ],
        validationRules: [
          { field: 'name', type: 'length', min: 2, max: 30 },
          { field: 'price', type: 'range', min: 10, max: 9999 }
        ],
        confidence: 0.75
      }
    ]
  },
  {
    id: 'supermarket-general',
    name: 'スーパー一般パターン',
    description: '一般的なスーパーマーケットのレシートパターン',
    priority: 60,
    enabled: true,
    storeIdentifiers: ['supermarket-b', 'supermarket-c', 'supermarket-d'],
    confidence: 0.7,
    patterns: [
      {
        id: 'supermarket-price-separate',
        name: 'スーパー価格分離パターン',
        type: 'context-aware',
        contextRules: [
          { type: 'next-line', pattern: '^\\s*(\\d{1,5})\\*?\\s*$', required: true }
        ],
        extractionRules: [
          { field: 'name', source: 'line-content' },
          { field: 'price', source: 'regex-group', groupIndex: 1, lineOffset: 1 }
        ],
        confidence: 0.7
      }
    ]
  },
  {
    id: 'generic-fallback',
    name: '汎用フォールバック',
    description: '他のパターンでマッチしない場合の汎用パターン',
    priority: 10,
    enabled: true,
    storeIdentifiers: [],
    confidence: 0.4,
    patterns: [
      {
        id: 'generic-price-pattern',
        name: '汎用価格パターン',
        type: 'single-line',
        regex: '^(.+?)\\s+(\\d{2,5})\\s*$',
        extractionRules: [
          { field: 'name', source: 'regex-group', groupIndex: 1 },
          { field: 'price', source: 'regex-group', groupIndex: 2 }
        ],
        validationRules: [
          { field: 'name', type: 'pattern', pattern: '[ぁ-んァ-ヶa-zA-Z]' },
          { field: 'price', type: 'range', min: 1, max: 99999 }
        ],
        confidence: 0.4
      }
    ]
  }
]

export const STORE_PATTERNS: StorePattern[] = [
  {
    storeId: 'warehouse',
    storeName: '大型店舗チェーン',
    identifiers: ['warehouse', '大型店', 'wholesale'],
    description: '大型店舗・ホールセール店舗',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('warehouse'))
  },
  {
    storeId: 'supermarket-a',
    storeName: 'スーパーマーケットA',
    identifiers: ['supermarket-a', 'スーパーA'],
    description: 'スーパーマーケットチェーンA',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('supermarket-a'))
  },
  {
    storeId: 'convenience-a',
    storeName: 'コンビニエンスストアA',
    identifiers: ['convenience-a', 'コンビニA', '111', 'conv-a'],
    description: 'コンビニエンスストアチェーンA',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('convenience-a'))
  },
  {
    storeId: 'supermarket-b',
    storeName: 'スーパーマーケットB',
    identifiers: ['supermarket-b', 'スーパーB', 'チェーンB', 'ストアB'],
    description: 'スーパーマーケットチェーンB',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('supermarket-b'))
  }
]

// パターン追加のためのテンプレート
export const PATTERN_TEMPLATES = {
  singleLine: {
    id: '',
    name: '',
    description: '',
    priority: 50,
    enabled: true,
    storeIdentifiers: [],
    confidence: 0.7,
    patterns: [{
      id: '',
      name: '',
      type: 'single-line' as const,
      regex: '',
      extractionRules: [
        { field: 'name' as const, source: 'regex-group' as const, groupIndex: 1 },
        { field: 'price' as const, source: 'regex-group' as const, groupIndex: 2 }
      ],
      confidence: 0.7
    }]
  },
  multiLine: {
    id: '',
    name: '',
    description: '',
    priority: 50,
    enabled: true,
    storeIdentifiers: [],
    confidence: 0.7,
    patterns: [{
      id: '',
      name: '',
      type: 'multi-line' as const,
      lineCount: 2,
      extractionRules: [
        { field: 'name' as const, source: 'line-content' as const, lineOffset: 0 },
        { field: 'price' as const, source: 'regex-group' as const, groupIndex: 1, lineOffset: 1 }
      ],
      confidence: 0.7
    }]
  }
}