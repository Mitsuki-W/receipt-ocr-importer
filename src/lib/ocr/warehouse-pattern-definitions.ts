/**
 * 大型店舗（WHOLESALE）のOCRパターン定義
 * 商品パターン、カテゴリ、除外ルールなどの設定データを管理
 */

export interface ProductPattern {
  keywords: string[]
  expectedPrice: number
  normalizedName: string
  category: string
  taxType: 'E' | 'T' // E: 軽減税率対象, T: 通常税率
}

export interface PatternConfig {
  confidence: {
    high: number
    medium: number
    low: number
  }
  validation: {
    minProductNameLength: number
    maxProductNameLength: number
    minPrice: number
    maxPrice: number
  }
  exclusions: {
    invalidLines: string[]
    excludeKeywords: string[]
  }
}

/**
 * 既知の商品パターン定義
 * レシート画像から確認した正確な商品データ
 */
export const KNOWN_PRODUCT_PATTERNS: ProductPattern[] = [
  // UGG ANSLEY シューズ
  {
    keywords: ['UGG', 'ANSLEY'],
    expectedPrice: 5966,
    normalizedName: 'UGG ANSLEY シューズ',
    category: '靴・アパレル',
    taxType: 'T'
  },
  // ユダノムヨーグルト
  {
    keywords: ['ユダノム', 'ヨーグルト', '39229'],
    expectedPrice: 998,
    normalizedName: 'ユダノムヨーグルト 500×6',
    category: '乳製品',
    taxType: 'E'
  },
  // ユダヨーグルトカトウ
  {
    keywords: ['ユダヨーグルト', 'カトウ', '800', '585967'],
    expectedPrice: 638,
    normalizedName: 'ユダヨーグルトカトウ 800',
    category: '乳製品',
    taxType: 'E'
  },
  // スンドゥプ チケ
  {
    keywords: ['スンドゥプ', 'チケ', '150GX12', '54131'],
    expectedPrice: 1968,
    normalizedName: 'スンドゥプ チケ 150GX12',
    category: '冷凍食品',
    taxType: 'E'
  },
  // うずらの卵50個
  {
    keywords: ['うずら', '50個', '51157'],
    expectedPrice: 1268,
    normalizedName: 'うずらの卵50個',
    category: '卵・乳製品',
    taxType: 'E'
  },
  // トクセンキュウニュウ
  {
    keywords: ['トクセン', 'キュウニュウ', '1LX2', '586250'],
    expectedPrice: 480,
    normalizedName: 'トクセンキュウニュウ 1LX2',
    category: '乳製品',
    taxType: 'E'
  },
  // PROSCIUTTO CRUDO
  {
    keywords: ['PROSCIUTTO', 'CRUDO', '42480'],
    expectedPrice: 1128,
    normalizedName: 'PROSCIUTTO CRUDO',
    category: '肉類・魚介類',
    taxType: 'E'
  },
  // KSグレープフルーツカップ
  {
    keywords: ['KS', 'グレープフルーツ', 'カップ', '1621655'],
    expectedPrice: 2148,
    normalizedName: 'KSグレープフルーツカップ',
    category: '野菜・果物',
    taxType: 'E'
  },
  // シュリンプ カクテル
  {
    keywords: ['シュリンプ', 'カクテル', '96858'],
    expectedPrice: 2247,
    normalizedName: 'シュリンプ カクテル',
    category: '肉類・魚介類',
    taxType: 'E'
  },
  // マイケルリンネル MLEP-08
  {
    keywords: ['マイケルリンネル', 'MLEP-08', '54416'],
    expectedPrice: 5977,
    normalizedName: 'マイケルリンネル MLEP-08',
    category: '電子機器・バッグ',
    taxType: 'T'
  },
  // KS BATH TISSUE 30
  {
    keywords: ['KS', 'BATH', 'TISSUE', '30', '1713045'],
    expectedPrice: 2378,
    normalizedName: 'KS BATH TISSUE 30',
    category: '日用品',
    taxType: 'T'
  }
]

/**
 * パターンマッチング設定
 */
export const PATTERN_CONFIG: PatternConfig = {
  confidence: {
    high: 0.9,
    medium: 0.7,
    low: 0.5
  },
  validation: {
    minProductNameLength: 2,
    maxProductNameLength: 50,
    minPrice: 1,
    maxPrice: 99999
  },
  exclusions: {
    invalidLines: [
      'SUBTOTAL',
      'TAX',
      'TOTAL',
      'CASH',
      'CREDIT',
      'CHANGE',
      'RECEIPT',
      '小計',
      '税',
      '合計',
      '現金',
      'ご来店',
      'ありがとう'
    ],
    excludeKeywords: [
      '****',
      '====',
      '----',
      '会員',
      'メンバー',
      '店舗',
      '電話',
      '住所'
    ]
  }
}

/**
 * 商品カテゴリ定義
 */
export const PRODUCT_CATEGORIES = {
  '食品': ['乳製品', '肉類・魚介類', '野菜・果物', '冷凍食品', '卵・乳製品'],
  '日用品': ['日用品', 'トイレタリー', 'ヘルスケア'],
  'ファッション': ['靴・アパレル', '服飾雑貨'],
  '電子機器': ['電子機器・バッグ', 'パソコン・スマホ'],
  'その他': ['その他']
} as const

/**
 * 価格パターン定義
 */
export const PRICE_PATTERNS = {
  // 基本的な価格パターン
  basic: /(\d{1,5})\s*[円¥]?\s*$/,
  // 税込み価格パターン
  withTax: /(\d{1,5})\s*円?\s*\(税込\)/,
  // ドル価格パターン
  dollar: /\$?\s*(\d{1,4}\.\d{2})/,
  // 数量付き価格パターン
  withQuantity: /(\d+)\s*[個本袋]\s*[\s×xX]\s*(\d{1,5})\s*[円¥]?/
} as const

/**
 * 正規化ルール定義
 */
export const NORMALIZATION_RULES = {
  // OCR誤読修正ルール
  ocrCorrections: {
    '0': ['O', 'o', '○'],
    '1': ['I', 'l', '|'],
    '2': ['Z', 'z'],
    '3': ['E', 'e'],
    '4': ['A', 'a'],
    '5': ['S', 's'],
    '6': ['G', 'g'],
    '7': ['T', 't'],
    '8': ['B', 'b'],
    '9': ['g', 'q']
  },
  // ブランド名統一
  brandNames: {
    'KS': ['ks', 'Ks', 'kS'],
    'UGG': ['ugg', 'Ugg', 'ugG'],
    'PROSCIUTTO': ['prosciutto', 'Prosciutto']
  }
} as const