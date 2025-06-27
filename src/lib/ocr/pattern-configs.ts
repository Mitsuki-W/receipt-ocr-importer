import { OCRPatternConfig, StorePattern } from '@/types/ocr-patterns'

export const DEFAULT_PATTERNS: OCRPatternConfig[] = [
  {
    id: 'costco-standard',
    name: 'Costco標準パターン',
    description: 'Costcoレシートの標準的な5行パターン',
    priority: 100,
    enabled: true,
    storeIdentifiers: ['costco'],
    confidence: 0.9,
    patterns: [
      {
        id: 'costco-5line',
        name: 'Costco 5行パターン',
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
    id: 'life-asterisk',
    name: 'ライフ*印パターン',
    description: 'ライフスーパーの*印付き商品パターン',
    priority: 90,
    enabled: true,
    storeIdentifiers: ['life'],
    confidence: 0.85,
    patterns: [
      {
        id: 'life-inline-asterisk',
        name: 'ライフ行内*パターン',
        type: 'single-line',
        regex: '^\\*(.+?)\\s+¥(\\d{1,5})$',
        extractionRules: [
          { field: 'name', source: 'regex-group', groupIndex: 1 },
          { field: 'price', source: 'regex-group', groupIndex: 2 }
        ],
        confidence: 0.9
      },
      {
        id: 'life-multiline-asterisk',
        name: 'ライフ複数行*パターン',
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
    storeIdentifiers: ['seven-eleven', 'lawson', 'familymart'],
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
    storeIdentifiers: ['aeon', 'ito-yokado', 'maruetsu'],
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
    storeId: 'costco',
    storeName: 'Costco Wholesale',
    identifiers: ['costco', 'コストコ', 'wholesale'],
    description: 'コストコホールセール店舗',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('costco'))
  },
  {
    storeId: 'life',
    storeName: 'ライフコーポレーション',
    identifiers: ['life', 'ライフ'],
    description: 'ライフスーパーマーケット',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('life'))
  },
  {
    storeId: 'seven-eleven',
    storeName: 'セブン-イレブン',
    identifiers: ['seven', 'セブン', '711', '7-11'],
    description: 'セブン-イレブンコンビニエンスストア',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('seven-eleven'))
  },
  {
    storeId: 'aeon',
    storeName: 'イオングループ',
    identifiers: ['aeon', 'イオン', 'ジャスコ', 'マックスバリュ'],
    description: 'イオングループ店舗',
    patterns: DEFAULT_PATTERNS.filter(p => p.storeIdentifiers.includes('aeon'))
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