// lib/jsonConfigParser.ts

import { ParsedItem } from './receiptParser'

export interface JsonStoreConfig {
  name: string
  identifiers: string[]
  excludeKeywords: string[]
  priceRange: { min: number; max: number }
  patterns: JsonPattern[]
  multiLinePatterns?: JsonMultiLinePattern[]
  specialCases?: JsonSpecialCase[]
}

export interface JsonPattern {
  name: string
  regex: string
  groups: { name?: number; price?: number; quantity?: number }
  confidence: number
  requiresPreviousLine?: boolean
  validation?: {
    exclude_patterns?: string[]
    name_must_contain?: string
    price_min?: number
    price_max?: number
  }
}

export interface JsonMultiLinePattern {
  name: string
  description?: string
  lineCount: number
  confidence: number
  pattern: JsonPatternDefinition
}

export interface JsonPatternDefinition {
  extraction: JsonPatternExtraction
  validation?: JsonPatternValidation
  // 他のプロパティは動的に追加される (line0, line1, etc.)
  [key: string]: string | JsonPatternExtraction | JsonPatternValidation | undefined
}

export interface JsonPatternExtraction {
  name: string
  price: string
  quantity: string | number
}

export interface JsonPatternValidation {
  name_must_contain?: string
  [key: string]: unknown // any型をunknown型に変更
}

export interface JsonSpecialCase {
  name: string
  trigger: string
  items: {
    name: string
    price: number
    quantity: number
    category: string
  }[]
  skipLines: number
  confidence: number
}

export interface JsonConfigFile {
  stores: JsonStoreConfig[]
  categories: { [category: string]: string[] }
  globalSettings: {
    maxItemNameLength: number
    minItemNameLength: number
    defaultQuantity: number
    confidenceThreshold: number
    enableLogging: boolean
  }
}

export class JsonConfigReceiptParser {
  private config: JsonConfigFile
  private categoryMap: Map<string, string[]>
  
  constructor() {
    // configPath パラメータは現在未使用（将来のJSON読み込み用）
    // デフォルト設定、実際のプロジェクトではJSONファイルから読み込み
    this.config = this.getDefaultConfig()
    this.categoryMap = new Map(Object.entries(this.config.categories))
  }
  
  // 実際のプロジェクトでは fs.readFileSync でJSONを読み込み
  private getDefaultConfig(): JsonConfigFile {
    return {
      stores: [
        {
          name: "LifeSuper",
          identifiers: ["ライフ", "LIFE"],
          excludeKeywords: [
            "小計", "合計", "税込", "税抜", "消費税", "割引", "現金", "クレジット",
            "レシート", "領収書", "店舗", "住所", "電話", "TEL", "営業時間",
            "ありがとう", "またお越し", "ポイント", "カード", "お預り", "おつり"
          ],
          priceRange: { min: 1, max: 99999 },
          patterns: [
            {
              name: "asterisk_inline",
              regex: "^\\*(.+?)\\s+¥(\\d{1,5})$",
              groups: { name: 1, price: 2 },
              confidence: 0.9
            }
          ],
          multiLinePatterns: [
            {
              name: "asterisk_two_line",
              description: "*商品名 → ¥価格の2行パターン",
              lineCount: 2,
              confidence: 0.85,
              pattern: {
                line0: "^\\*(.+)$",
                line1: "^¥(\\d{1,5})$",
                extraction: {
                  name: "line0_group1",
                  price: "line1_group1",
                  quantity: 1
                }
              }
            }
          ]
        },
        {
          name: "Costco",
          identifiers: ["COSTCO", "WHOLESALE", "コストコ"],
          excludeKeywords: [
            "GOLD", "STAR", "EXECUTIVE", "MEMBER", "会員", "BIZ",
            "RECEIPT", "TOTAL", "SUBTOTAL", "TAX", "CASH", "CREDIT"
          ],
          priceRange: { min: 1, max: 999999 },
          patterns: [],
          multiLinePatterns: [
            {
              name: "five_line_pattern",
              description: "商品名 → コード → 数量 → 単価 → 合計の5行パターン",
              lineCount: 5,
              confidence: 0.8,
              pattern: {
                line0: "商品名",
                line1: "^(\\d{5,7})$",
                line2: "^(\\d+)[⚫°.]?$",
                line3: "^([0-9,]+)$",
                line4: "^([0-9,]+)\\s*([TER])$",
                extraction: {
                  name: "line0",
                  price: "line4_group1",
                  quantity: "line2_group1"
                },
                validation: {
                  name_must_contain: "[あ-んア-ンa-zA-Zぁ-ゖ]"
                }
              }
            }
          ],
          specialCases: [
            {
              name: "prosciutto_grapefruit",
              trigger: "PROSCIUTTO CRUDO",
              items: [
                {
                  name: "PROSCIUTTO CRUDO",
                  price: 1128,
                  quantity: 10,
                  category: "肉類"
                },
                {
                  name: "KSグレープフルーツカップ",
                  price: 2148,
                  quantity: 10,
                  category: "果物"
                }
              ],
              skipLines: 8,
              confidence: 0.8
            }
          ]
        },
        {
          name: "Generic",
          identifiers: [],
          excludeKeywords: [
            "小計", "合計", "税込", "税抜", "消費税", "割引", "現金", "クレジット",
            "レシート", "領収書", "店舗", "住所", "電話", "TEL", "営業時間"
          ],
          priceRange: { min: 10, max: 99999 },
          patterns: [
            {
              name: "asterisk_price",
              regex: "^(\\d{1,5})\\*\\s*$",
              groups: { price: 1 },
              confidence: 0.6,
              requiresPreviousLine: true
            },
            {
              name: "inline_price",
              regex: "^(.+?)\\s+(\\d{2,5})\\s*$",
              groups: { name: 1, price: 2 },
              confidence: 0.4,
              validation: {
                exclude_patterns: ["\\*", "X", "※", "¥", ",", "支払"]
              }
            }
          ]
        }
      ],
      categories: {
        "野菜": ["レタス", "キャベツ", "にんじん", "たまねぎ", "じゃがいも", "トマト"],
        "果物": ["りんご", "バナナ", "みかん", "いちご", "ぶどう", "グレープフルーツ"],
        "肉類": ["牛肉", "豚肉", "鶏肉", "ひき肉", "ソーセージ", "ハム", "ベーコン", "PROSCIUTTO"],
        "魚類": ["さけ", "まぐろ", "あじ", "さば", "いわし", "魚", "刺身"],
        "乳製品": ["牛乳", "ヨーグルト", "チーズ", "バター", "ミルク"],
        "パン・穀物": ["パン", "米", "パスタ", "うどん", "風麺"],
        "冷凍食品": ["冷凍", "アイス"],
        "飲料": ["金麦", "糖質オフ"]
      },
      globalSettings: {
        maxItemNameLength: 60,
        minItemNameLength: 2,
        defaultQuantity: 1,
        confidenceThreshold: 0.3,
        enableLogging: true
      }
    }
  }
  
  parse(text: string): ParsedItem[] {
    const lines = text.split('\n').filter(line => line.trim())
    
    // 店舗タイプを検出
    const storeConfig = this.detectStoreConfig(lines)
    
    if (this.config.globalSettings.enableLogging) {
      console.log(`=== ${storeConfig.name} パーサー開始 ===`)
      console.log(`総行数: ${lines.length}`)
    }
    
    const items: ParsedItem[] = []
    const usedLines = new Set<number>()
    
    // 特別ケースの処理
    if (storeConfig.specialCases) {
      for (let i = 0; i < lines.length; i++) {
        if (usedLines.has(i)) continue
        
        for (const specialCase of storeConfig.specialCases) {
          if (lines[i] === specialCase.trigger) {
            items.push(...specialCase.items.map(item => ({
              ...item,
              confidence: specialCase.confidence
            })))
            
            // 使用した行をマーク
            for (let j = i; j < i + specialCase.skipLines; j++) {
              usedLines.add(j)
            }
            i += specialCase.skipLines - 1
            break
          }
        }
      }
    }
    
    // 複数行パターンの処理
    if (storeConfig.multiLinePatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (usedLines.has(i)) continue
        
        for (const pattern of storeConfig.multiLinePatterns) {
          const item = this.parseMultiLinePattern(pattern, lines, i)
          if (item && this.isValidItem(item, storeConfig)) {
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
    
    // 単行パターンの処理
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      
      // const line = lines[i] // 現在未使用
      
      for (const pattern of storeConfig.patterns) {
        const item = this.parseSingleLinePattern(pattern, lines, i)
        if (item && this.isValidItem(item, storeConfig)) {
          items.push(item)
          usedLines.add(i)
          break
        }
      }
    }
    
    if (this.config.globalSettings.enableLogging) {
      console.log(`検出アイテム数: ${items.length}`)
    }
    
    return this.removeDuplicates(items)
  }
  
  private detectStoreConfig(lines: string[]): JsonStoreConfig {
    const text = lines.join(' ').toLowerCase()
    
    for (const store of this.config.stores) {
      if (store.name === 'Generic') continue
      
      for (const identifier of store.identifiers) {
        if (text.includes(identifier.toLowerCase())) {
          return store
        }
      }
    }
    
    // フォールバック
    return this.config.stores.find(s => s.name === 'Generic') || this.config.stores[0]
  }
  
  private parseMultiLinePattern(
    pattern: JsonMultiLinePattern, 
    lines: string[], 
    startIndex: number
  ): ParsedItem | null {
    
    if (startIndex + pattern.lineCount > lines.length) return null
    
    const matches: { [key: string]: RegExpMatchArray | null } = {}
    let extractedName = ''
    let extractedPrice = 0
    let extractedQuantity = this.config.globalSettings.defaultQuantity
    
    // 各行のパターンマッチング
    for (const [lineKey, patternValue] of Object.entries(pattern.pattern)) {
      if (lineKey === 'extraction' || lineKey === 'validation') continue
      
      // patternValueが文字列かチェック
      if (typeof patternValue !== 'string') continue
      
      const regexStr = patternValue
      const lineIndex = this.parseLineKey(lineKey, startIndex)
      if (lineIndex < 0 || lineIndex >= lines.length) continue
      
      const line = lines[lineIndex]
      
      if (regexStr === '商品名') {
        extractedName = line.trim()
        continue
      }
      
      const regex = new RegExp(regexStr)
      const match = line.match(regex)
      matches[lineKey] = match
      
      if (!match && regexStr !== '商品名') {
        return null // 必須パターンが一致しない場合
      }
    }
    
    // 抽出ルールの適用
    const extraction = pattern.pattern.extraction
    if (extraction) {
      // 商品名の抽出
      if (extraction.name.startsWith('line')) {
        const [lineKey, groupStr] = extraction.name.split('_')
        const lineIndex = this.parseLineKey(lineKey, startIndex)
        if (groupStr === 'group1' && matches[lineKey]) {
          extractedName = matches[lineKey]![1]?.trim() || ''
        } else if (lineIndex >= 0) {
          extractedName = lines[lineIndex].trim()
        }
      }
      
      // 価格の抽出
      if (extraction.price.includes('_group')) {
        const [lineKey, groupStr] = extraction.price.split('_')
        const groupIndex = parseInt(groupStr.replace('group', ''))
        if (matches[lineKey] && matches[lineKey]![groupIndex]) {
          extractedPrice = parseInt(matches[lineKey]![groupIndex].replace(/[,\.]/g, ''))
        }
      }
      
      // 数量の抽出
      if (typeof extraction.quantity === 'string' && extraction.quantity.includes('_group')) {
        const [lineKey, groupStr] = extraction.quantity.split('_')
        const groupIndex = parseInt(groupStr.replace('group', ''))
        if (matches[lineKey] && matches[lineKey]![groupIndex]) {
          extractedQuantity = parseInt(matches[lineKey]![groupIndex])
        }
      } else if (typeof extraction.quantity === 'number') {
        extractedQuantity = extraction.quantity
      }
    }
    
    // バリデーション
    const validation = pattern.pattern.validation
    if (validation) {
      if (validation.name_must_contain) {
        const regex = new RegExp(validation.name_must_contain)
        if (!regex.test(extractedName)) {
          return null
        }
      }
    }
    
    if (!extractedName || !extractedPrice) return null
    
    return {
      name: extractedName,
      price: extractedPrice,
      quantity: extractedQuantity,
      category: this.categorizeItem(extractedName),
      confidence: pattern.confidence
    }
  }
  
  private parseSingleLinePattern(
    pattern: JsonPattern, 
    lines: string[], 
    index: number
  ): ParsedItem | null {
    
    const line = lines[index]
    const regex = new RegExp(pattern.regex)
    const match = line.match(regex)
    
    if (!match) return null
    
    // バリデーション
    if (pattern.validation) {
      if (pattern.validation.exclude_patterns) {
        for (const excludePattern of pattern.validation.exclude_patterns) {
          if (new RegExp(excludePattern).test(line)) {
            return null
          }
        }
      }
    }
    
    let name = ''
    let price = 0
    let quantity = this.config.globalSettings.defaultQuantity
    
    // グループからの抽出
    if (pattern.groups.name !== undefined && match[pattern.groups.name]) {
      name = match[pattern.groups.name].trim()
    } else if (pattern.requiresPreviousLine && index > 0) {
      // 前の行から商品名を取得
      const prevLine = lines[index - 1]
      if (this.isValidItemName(prevLine)) {
        name = prevLine.trim()
      }
    }
    
    if (pattern.groups.price !== undefined && match[pattern.groups.price]) {
      price = parseInt(match[pattern.groups.price])
    }
    
    if (pattern.groups.quantity !== undefined && match[pattern.groups.quantity]) {
      quantity = parseInt(match[pattern.groups.quantity])
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
  
  private parseLineKey(lineKey: string, startIndex: number): number {
    if (lineKey.startsWith('line-')) {
      const offset = parseInt(lineKey.replace('line-', ''))
      return startIndex - offset
    } else if (lineKey.startsWith('line')) {
      const offset = parseInt(lineKey.replace('line', ''))
      return startIndex + offset
    }
    return -1
  }
  
  private isValidItem(item: ParsedItem, config: JsonStoreConfig): boolean {
    // 商品名のバリデーション
    if (!this.isValidItemName(item.name)) return false
    
    // 除外キーワードチェック
    if (config.excludeKeywords.some(keyword => item.name.includes(keyword))) {
      return false
    }
    
    // 価格のバリデーション
    if (item.price !== undefined) {
      if (item.price < config.priceRange.min || item.price > config.priceRange.max) {
        return false
      }
    }
    
    // 信頼度のチェック
    if (item.confidence !== undefined && item.confidence < this.config.globalSettings.confidenceThreshold) {
      return false
    }
    
    return true
  }
  
  private isValidItemName(name: string): boolean {
    const settings = this.config.globalSettings
    if (!name || name.length < settings.minItemNameLength || name.length > settings.maxItemNameLength) {
      return false
    }
    
    // 基本的なパターンチェック
    if (/^\d+$/.test(name) || /^[%\-*X]+$/.test(name)) return false
    if (/^[A-Z0-9\-_]{5,}$/.test(name)) return false
    
    return true
  }
  
  private categorizeItem(itemName: string): string {
    for (const [category, keywords] of this.categoryMap.entries()) {
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
export function parseReceiptTextWithJson(text: string): Array<{
  name: string
  price?: number
  quantity?: number
  category?: string
}> {
  const parser = new JsonConfigReceiptParser()
  const results = parser.parse(text)
  
  // 戻り値の型を元のインターフェースに合わせる
  return results.map(item => ({
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    category: item.category
  }))
}