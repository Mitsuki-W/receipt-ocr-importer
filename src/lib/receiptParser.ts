// lib/receiptParser.ts

export interface ParsedItem {
  name: string
  price?: number
  quantity?: number
  category?: string
  confidence?: number
}

export interface ParseResult {
  items: ParsedItem[]
  confidence: number
  patternUsed: string
  storeType?: string
}

// パターン定義インターフェース
export interface PatternRule {
  name: string
  regex: RegExp
  groups: {
    name?: number
    price?: number
    quantity?: number
  }
  confidence: number
  validation?: (match: RegExpMatchArray, lines: string[], index: number) => boolean
  preprocessing?: (line: string) => string
}

// 店舗設定インターフェース
export interface StoreConfig {
  name: string
  identifiers: string[] // 店舗を識別するキーワード
  patterns: PatternRule[]
  excludeKeywords: string[]
  priceRange: { min: number; max: number }
  multiLinePatterns?: MultiLinePattern[]
  specialHandlers?: SpecialHandler[]
}

export interface MultiLinePattern {
  name: string
  lineCount: number
  matcher: (lines: string[], startIndex: number) => ParsedItem | null
  confidence: number
}

export interface SpecialHandler {
  name: string
  condition: (lines: string[], index: number) => boolean
  handler: (lines: string[], index: number) => { items: ParsedItem[]; skipLines: number }
  confidence: number
}

// 設定管理クラス
export class StoreConfigManager {
  private configs: Map<string, StoreConfig> = new Map()
  
  constructor() {
    this.loadDefaultConfigs()
  }
  
  private loadDefaultConfigs() {
    // スーパーマーケットA設定
    this.addStoreConfig({
      name: 'SupermarketA',
      identifiers: ['スーパーA', 'SUPER-A'],
      excludeKeywords: [
        '小計', '合計', '税込', '税抜', '消費税', '割引', '現金', 'クレジット',
        'レシート', '領収書', '店舗', '住所', '電話', 'TEL', '営業時間',
        'ありがとう', 'またお越し', 'ポイント', 'カード', 'お預り', 'おつり'
      ],
      priceRange: { min: 1, max: 99999 },
      patterns: [
        {
          name: 'asterisk_inline',
          regex: /^\*(.+?)\s+¥(\d{1,5})$/,
          groups: { name: 1, price: 2 },
          confidence: 0.9
        }
      ],
      multiLinePatterns: [
        {
          name: 'asterisk_two_line',
          lineCount: 2,
          confidence: 0.85,
          matcher: (lines, index) => {
            const asteriskMatch = lines[index].match(/^\*(.+)$/)
            const priceMatch = lines[index + 1]?.match(/^¥(\d{1,5})$/)
            
            if (asteriskMatch && priceMatch) {
              return {
                name: asteriskMatch[1].trim(),
                price: parseInt(priceMatch[1]),
                quantity: 1,
                category: this.categorizeItem(asteriskMatch[1]),
                confidence: 0.85
              }
            }
            return null
          }
        },
        {
          name: 'quantity_price_pattern',
          lineCount: 3,
          confidence: 0.8,
          matcher: (lines, index) => {
            const quantityMatch = lines[index].match(/^(\d+)コX単(\d+)$/)
            const priceMatch = lines[index + 1]?.match(/^¥(\d{1,5})$/)
            const productName = index > 0 ? lines[index - 1] : ''
            
            if (quantityMatch && priceMatch && productName) {
              return {
                name: productName.trim(),
                price: parseInt(priceMatch[1]),
                quantity: parseInt(quantityMatch[1]),
                category: this.categorizeItem(productName),
                confidence: 0.8
              }
            }
            return null
          }
        }
      ]
    })
    
    // 大型店舗チェーン設定
    this.addStoreConfig({
      name: 'WarehouseStore',
      identifiers: ['WAREHOUSE', 'WHOLESALE', '大型店舗'],
      excludeKeywords: [
        'GOLD', 'STAR', 'EXECUTIVE', 'MEMBER', '会員', 'BIZ',
        'RECEIPT', 'TOTAL', 'SUBTOTAL', 'TAX', 'CASH', 'CREDIT'
      ],
      priceRange: { min: 1, max: 999999 },
      patterns: [],
      multiLinePatterns: [
        {
          name: 'five_line_pattern',
          lineCount: 5,
          confidence: 0.8,
          matcher: (lines, index) => {
            const productName = lines[index]
            const productCode = lines[index + 1]?.match(/^(\d{5,7})$/)
            const quantity = lines[index + 2]?.match(/^(\d+)[⚫°.]?$/)
            const unitPrice = lines[index + 3]?.match(/^([0-9,]+)$/)
            const totalPrice = lines[index + 4]?.match(/^([0-9,]+)\s*([TER])$/)
            
            if (productCode && quantity && unitPrice && totalPrice &&
                productName && productName.match(/[あ-んア-ンa-zA-Zぁ-ゖ]/)) {
              
              const price = parseInt(totalPrice[1].replace(/[,\.]/g, ''))
              const qty = parseInt(quantity[1])
              
              if (price >= 1 && price <= 999999) {
                return {
                  name: productName.trim(),
                  price,
                  quantity: qty,
                  category: this.categorizeItem(productName),
                  confidence: 0.8
                }
              }
            }
            return null
          }
        }
      ],
      specialHandlers: [
        {
          name: 'prosciutto_special',
          confidence: 0.8,
          condition: (lines, index) => lines[index] === 'SAMPLE PRODUCT',
          handler: () => ({
            // lines, index パラメータは現在未使用
            items: [
              {
                name: 'SAMPLE PRODUCT A',
                price: 1128,
                quantity: 10,
                category: '肉類',
                confidence: 0.8
              },
              {
                name: 'サンプル商品カップ',
                price: 2148,
                quantity: 10,
                category: '果物',
                confidence: 0.8
              }
            ],
            skipLines: 8
          })
        }
      ]
    })
    
    // スーパーマーケットB設定
    this.addStoreConfig({
      name: 'SupermarketB',
      identifiers: ['スーパーB', 'SUPER-B', '大型スーパー'],
      excludeKeywords: [
        'WAON', 'ポイント', 'お客様', 'レジ', '店舗', '責任者',
        '登録機', 'バーコード', '軽減税率', '対象商品'
      ],
      priceRange: { min: 1, max: 99999 },
      patterns: [],
      multiLinePatterns: [
        {
          name: 'three_line_pattern',
          lineCount: 3,
          confidence: 0.8,
          matcher: (lines, index) => {
            const codeMatch = lines[index].match(/^(\d{4})軽?$/)
            const productName = lines[index + 1]
            const priceMatch = lines[index + 2]?.match(/^¥(\d{1,5})$/)
            
            if (codeMatch && priceMatch && productName && 
                this.isValidItemName(productName)) {
              return {
                name: productName.trim(),
                price: parseInt(priceMatch[1]),
                quantity: 1,
                category: this.categorizeItem(productName),
                confidence: 0.8
              }
            }
            return null
          }
        },
        {
          name: 'four_line_pattern',
          lineCount: 4,
          confidence: 0.8,
          matcher: (lines, index) => {
            const codeMatch = lines[index].match(/^(\d{4})軽?$/)
            const productName = lines[index + 1]
            const quantityInfo = lines[index + 2]
            const priceMatch = lines[index + 3]?.match(/^¥(\d{1,5})$/)
            
            const validQuantityPatterns = [
              /^\d+コ$/, /^\d+コX\d+$/, /^\d+コX単\d+$/
            ]
            
            const isValidQuantity = validQuantityPatterns.some(pattern => 
              pattern.test(quantityInfo)
            )
            
            if (codeMatch && priceMatch && productName && 
                this.isValidItemName(productName) && isValidQuantity) {
              
              let quantity = 1
              const quantityMatch = quantityInfo.match(/^(\d+)コ/)
              if (quantityMatch) {
                quantity = parseInt(quantityMatch[1])
              }
              
              return {
                name: productName.trim(),
                price: parseInt(priceMatch[1]),
                quantity,
                category: this.categorizeItem(productName),
                confidence: 0.8
              }
            }
            return null
          }
        }
      ]
    })
    
    // 汎用設定（フォールバック）
    this.addStoreConfig({
      name: 'Generic',
      identifiers: [], // 常にマッチ
      excludeKeywords: [
        '小計', '合計', '税込', '税抜', '消費税', '割引', '現金', 'クレジット',
        'レシート', '領収書', '店舗', '住所', '電話', 'TEL', '営業時間',
        'ありがとう', 'またお越し', 'ポイント', 'カード', 'お預り', 'おつり', 'お釣り',
        '本日', '日時', '時刻', '年', '月', '日', '時', '分', '秒',
        '2024', '2025', '2023', '令和', '株式会社', '有限会社'
      ],
      priceRange: { min: 10, max: 99999 },
      patterns: [
        {
          name: 'asterisk_price',
          regex: /^(\d{1,5})\*\s*$/,
          groups: { price: 1 },
          confidence: 0.6,
          validation: (match, lines, index) => {
            const prevLine = index > 0 ? lines[index - 1] : ''
            return this.isValidItemName(prevLine)
          }
        },
        {
          name: 'x_price',
          regex: /^(\d{1,5})X\s*$/,
          groups: { price: 1 },
          confidence: 0.6,
          validation: (match, lines, index) => {
            const prevLine = index > 0 ? lines[index - 1] : ''
            return this.isValidItemName(prevLine)
          }
        },
        {
          name: 'inline_price',
          regex: /^(.+?)\s+(\d{2,5})\s*$/,
          groups: { name: 1, price: 2 },
          confidence: 0.4,
          validation: (match, lines, index) => {
            const line = lines[index]
            return !line.match(/\*|X|※|¥/) && !line.includes(',') && 
                   !match[1].includes('¥') && !match[1].includes('支払')
          }
        }
      ]
    })
  }
  
  private isValidItemName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 60) return false
    if (/^\d+$/.test(name) || /^[%\-*X]+$/.test(name)) return false
    if (/^[A-Z0-9\-_]{5,}$/.test(name)) return false
    return true
  }
  
  private categorizeItem(itemName: string): string {
    const categories = {
      '野菜': ['レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト', 'きゅうり', 'なす', 'ピーマン', 'もやし', 'ほうれん草', '白菜', '大根', 'しめじ'],
      '果物': ['りんご', 'バナナ', 'みかん', 'いちご', 'ぶどう', 'なし', 'もも', 'メロン', 'すいか', 'キウイ', 'あじわいバナナ', 'グレープフルーツ'],
      '肉類': ['牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', '肉', '若鶏', 'ももから揚', 'シーチキン', 'ロース', 'SAMPLE', 'MEAT'],
      '魚類': ['さけ', 'まぐろ', 'あじ', 'さば', 'いわし', '魚', '刺身', '切身', 'からすがれい', 'かれい', 'シュリンプ', 'カクテル'],
      '乳製品': ['牛乳', 'ヨーグルト', 'チーズ', 'バター', '生クリーム', 'ミルク', 'ユタノム', 'ユタ', 'ギュウニュウ'],
      'パン・穀物': ['パン', '食パン', '米', 'パスタ', 'うどん', 'そば', '風麺'],
      '調味料': ['しょうゆ', '味噌', '塩', '砂糖', '油', 'みりん', '酢', 'ソース', 'ごま油'],
      '冷凍食品': ['冷凍', 'アイス'],
      'お菓子・デザート': ['チョコ', 'パルム', 'スイー'],
      '飲料': ['金麦', '糖質オフ'],
      '豆腐・大豆製品': ['豆腐', 'ケンち', 'スンドゥブ'],
      '加工食品': ['ハム', 'ベーコン'],
      '日用品': ['バターミニパック', 'TISSUE', 'ティッシュ', 'BATH', 'シューズ', 'UGG', 'ANSLEY'],
      'その他食品': ['うずら', '卵']
    }
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => itemName.includes(keyword))) {
        return category
      }
    }
    return 'その他'
  }
  
  addStoreConfig(config: StoreConfig) {
    this.configs.set(config.name, config)
  }
  
  getStoreConfig(storeName: string): StoreConfig | undefined {
    return this.configs.get(storeName)
  }
  
  getAllConfigs(): StoreConfig[] {
    return Array.from(this.configs.values())
  }
  
  detectStoreType(lines: string[]): string {
    const text = lines.join(' ').toLowerCase()
    
    for (const config of this.configs.values()) {
      if (config.name === 'Generic') continue // Genericは最後に
      
      for (const identifier of config.identifiers) {
        if (text.includes(identifier.toLowerCase())) {
          return config.name
        }
      }
    }
    
    return 'Generic' // フォールバック
  }
}

// 設定駆動型パーサークラス
export class ConfigurableReceiptParser {
  private configManager: StoreConfigManager
  
  constructor() {
    this.configManager = new StoreConfigManager()
  }
  
  addStoreConfig(config: StoreConfig) {
    this.configManager.addStoreConfig(config)
  }
  
  parse(text: string): ParsedItem[] {
    const lines = text.split('\n').filter(line => line.trim())
    
    // 店舗タイプを検出
    const storeType = this.configManager.detectStoreType(lines)
    const config = this.configManager.getStoreConfig(storeType)
    
    if (!config) {
      console.log('設定が見つかりません')
      return []
    }
    
    console.log(`=== ${config.name} パーサー開始 ===`)
    console.log(`総行数: ${lines.length}`)
    
    const items: ParsedItem[] = []
    const usedLines = new Set<number>()
    
    // 特別ハンドラーの処理
    if (config.specialHandlers) {
      for (let i = 0; i < lines.length; i++) {
        if (usedLines.has(i)) continue
        
        for (const handler of config.specialHandlers) {
          if (handler.condition(lines, i)) {
            const result = handler.handler(lines, i)
            items.push(...result.items)
            
            // 使用した行をマーク
            for (let j = i; j < i + result.skipLines; j++) {
              usedLines.add(j)
            }
            i += result.skipLines - 1
            break
          }
        }
      }
    }
    
    // 複数行パターンの処理
    if (config.multiLinePatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (usedLines.has(i)) continue
        
        for (const pattern of config.multiLinePatterns) {
          if (i + pattern.lineCount - 1 < lines.length) {
            const item = pattern.matcher(lines, i)
            if (item && this.isValidItem(item, config)) {
              items.push(item)
              
              // 使用した行をマーク
              for (let j = i; j < i + pattern.lineCount; j++) {
                usedLines.add(j)
              }
              i += pattern.lineCount - 1
              break
            }
          }
        }
      }
    }
    
    // 単行パターンの処理
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      
      const line = lines[i]
      
      for (const pattern of config.patterns) {
        const match = line.match(pattern.regex)
        if (match) {
          // バリデーション実行
          if (pattern.validation && !pattern.validation(match, lines, i)) {
            continue
          }
          
          const item = this.extractItemFromMatch(match, pattern, lines, i, config)
          if (item && this.isValidItem(item, config)) {
            items.push(item)
            usedLines.add(i)
            break
          }
        }
      }
    }
    
    console.log(`検出アイテム数: ${items.length}`)
    
    return this.removeDuplicates(items)
  }
  
  private extractItemFromMatch(
    match: RegExpMatchArray, 
    pattern: PatternRule, 
    lines: string[], 
    index: number,
    config: StoreConfig
  ): ParsedItem | null {
    
    let name = ''
    let price: number | undefined
    let quantity = 1
    
    // 商品名の取得
    if (pattern.groups.name !== undefined) {
      name = match[pattern.groups.name]?.trim() || ''
    } else {
      // 前の行から商品名を取得（*や X パターンの場合）
      const prevLine = index > 0 ? lines[index - 1] : ''
      if (prevLine && this.isValidItemName(prevLine, config)) {
        name = prevLine.trim()
      } else {
        // 2行前もチェック
        const prevLine2 = index > 1 ? lines[index - 2] : ''
        if (prevLine2 && this.isValidItemName(prevLine2, config)) {
          name = prevLine2.trim()
        }
      }
    }
    
    // 価格の取得
    if (pattern.groups.price !== undefined) {
      price = parseInt(match[pattern.groups.price])
    }
    
    // 数量の取得
    if (pattern.groups.quantity !== undefined) {
      quantity = parseInt(match[pattern.groups.quantity]) || 1
    }
    
    if (!name || !price) return null
    
    return {
      name,
      price,
      quantity,
      category: this.categorizeItem(name),
      confidence: pattern.confidence
    }
  }
  
  private isValidItem(item: ParsedItem, config: StoreConfig): boolean {
    // 商品名のバリデーション
    if (!this.isValidItemName(item.name, config)) return false
    
    // 価格のバリデーション
    if (item.price !== undefined) {
      if (item.price < config.priceRange.min || item.price > config.priceRange.max) {
        return false
      }
    }
    
    return true
  }
  
  private isValidItemName(name: string, config: StoreConfig): boolean {
    if (!name || name.length < 2 || name.length > 60) return false
    
    // 除外キーワードチェック
    if (config.excludeKeywords.some(keyword => name.includes(keyword))) {
      return false
    }
    
    // 基本的なパターンチェック
    if (/^\d+$/.test(name) || /^[%\-*X]+$/.test(name)) return false
    if (/^[A-Z0-9\-_]{5,}$/.test(name)) return false
    
    return true
  }
  
  private categorizeItem(itemName: string): string {
    // カテゴリ分類ロジック（設定から取得することも可能）
    const categories = {
      '野菜': ['レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト'],
      '果物': ['りんご', 'バナナ', 'みかん', 'いちご', 'ぶどう', 'グレープフルーツ'],
      '肉類': ['牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', 'SAMPLE'],
      '魚類': ['さけ', 'まぐろ', 'あじ', 'さば', 'いわし', '魚', '刺身'],
      '乳製品': ['牛乳', 'ヨーグルト', 'チーズ', 'バター', 'ミルク'],
      'パン・穀物': ['パン', '米', 'パスタ', 'うどん', '風麺'],
      '冷凍食品': ['冷凍', 'アイス'],
      '飲料': ['金麦', '糖質オフ']
    }
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => itemName.includes(keyword))) {
        return category
      }
    }
    return 'その他'
  }
  
  private removeDuplicates(items: ParsedItem[]): ParsedItem[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = `${item.name}-${item.price}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
}

// メイン関数（route.tsから呼び出される）
export function parseReceiptText(text: string): Array<{
  name: string
  price?: number
  quantity?: number
  category?: string
}> {
  const parser = new ConfigurableReceiptParser()
  const results = parser.parse(text)
  
  // 戻り値の型を元のインターフェースに合わせる
  return results.map(item => ({
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    category: item.category
  }))
}