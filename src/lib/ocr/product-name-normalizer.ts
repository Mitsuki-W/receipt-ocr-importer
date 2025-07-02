import { NORMALIZATION_RULES, PRODUCT_CATEGORIES } from './warehouse-pattern-definitions'

/**
 * 商品名正規化とカテゴリ分類を担当するユーティリティクラス
 * OCR誤読修正、ブランド名統一、商品分類を行う
 */
export class ProductNameNormalizer {

  /**
   * 商品名を正規化（OCR誤読修正 + ブランド名統一）
   */
  static normalizeProductName(name: string): string {
    let normalized = name.trim()

    // OCR誤読修正の適用
    const ocrFixes = [
      // 数字の誤読修正
      { from: /O/g, to: '0' },
      { from: /I/g, to: '1' },
      { from: /Z/g, to: '2' },
      { from: /E(?=\d)/g, to: '3' },
      { from: /A(?=\d)/g, to: '4' },
      { from: /S(?=\d)/g, to: '5' },
      { from: /G(?=\d)/g, to: '6' },
      { from: /T(?=\d)/g, to: '7' },
      { from: /B(?=\d)/g, to: '8' },
      { from: /g(?=\d)/g, to: '9' },

      // 記号の修正
      { from: /⚫/g, to: '個' },
      { from: /°/g, to: '個' },
      { from: /\*/g, to: '' },

      // 一般的なOCR誤読パターン
      { from: /スンドーブ/gi, to: 'スンドゥブ' },
      { from: /チゲ.*150G/gi, to: 'チゲ 150g' },
      { from: /X(\d+)/gi, to: '×$1' },
      { from: /G([^a-zA-Z])/gi, to: 'g$1' },
      { from: /L([^a-zA-Z])/gi, to: 'L$1' }
    ]

    // OCR誤読修正を適用
    ocrFixes.forEach(({ from, to }) => {
      normalized = normalized.replace(from, to)
    })

    // ブランド名・固有名詞を一般名詞に置き換え
    const replacements = [
      // 靴・アパレル
      { from: /UGG ANSLEY/gi, to: 'ムートンシューズ' },
      { from: /UGG/gi, to: 'ムートンブーツ' },

      // 食品メーカー・ブランド
      { from: /ユダノム/gi, to: 'ヨーグルト' },
      { from: /ユタ/gi, to: 'ヨーグルト' },
      { from: /KS/gi, to: 'プライベートブランド' },
      { from: /PROSCIUTTO CRUDO/gi, to: '生ハム' },
      { from: /マイケルリンネル/gi, to: 'ショルダーバッグ' },
      { from: /MLEP-08/gi, to: 'バッグ' },

      // 一般化・単位の統一
      { from: /チケ\*/gi, to: 'チゲ' },
      { from: /150g×12個/gi, to: '150g×12個パック' },
      { from: /1L×2本/gi, to: '1L×2本パック' },
      { from: /スンドゥプ/gi, to: 'スンドゥブチゲ' },
      { from: /トクセンキュウニュウ/gi, to: '特選牛乳' },
      { from: /ギュウニュウ/gi, to: '牛乳' },
      { from: /BATH TISSUE/gi, to: 'トイレットペーパー' },
      { from: /シュリンプ.*カクテル/gi, to: 'エビカクテル' },

      // 追加の食材名修正
      { from: /スナップエンドウ 800/gi, to: 'スナップエンドウ 800g' },
      { from: /うずらの50個/gi, to: 'うずらの卵 50個パック' }
    ]

    replacements.forEach(({ from, to }) => {
      normalized = normalized.replace(from, to)
    })

    return normalized.trim()
  }

  /**
   * 商品をカテゴリ分類
   */
  static categorizeProduct(name: string): string {
    const normalizedName = name.toLowerCase()

    // 食品関連のキーワードマッチング
    if (this.matchesCategory(normalizedName, ['ヨーグルト', '牛乳', '乳製品', 'ミルク'])) {
      return '乳製品'
    }
    if (this.matchesCategory(normalizedName, ['肉', 'ハム', '生ハム', 'エビ', 'シュリンプ', '魚'])) {
      return '肉類・魚介類'
    }
    if (this.matchesCategory(normalizedName, ['野菜', '果物', 'グレープフルーツ', 'フルーツ'])) {
      return '野菜・果物'
    }
    if (this.matchesCategory(normalizedName, ['冷凍', 'チゲ', 'スンドゥブ'])) {
      return '冷凍食品'
    }
    if (this.matchesCategory(normalizedName, ['卵', 'うずら'])) {
      return '卵・乳製品'
    }

    // 非食品のカテゴリ
    if (this.matchesCategory(normalizedName, ['シューズ', 'ブーツ', 'ムートン', 'アパレル'])) {
      return '靴・アパレル'
    }
    if (this.matchesCategory(normalizedName, ['バッグ', 'ショルダー', 'リンネル'])) {
      return '電子機器・バッグ'
    }
    if (this.matchesCategory(normalizedName, ['トイレットペーパー', 'ペーパー', 'tissue', 'bath'])) {
      return '日用品'
    }

    return 'その他'
  }

  /**
   * 商品名が特定のカテゴリキーワードと一致するかチェック
   */
  private static matchesCategory(name: string, keywords: string[]): boolean {
    return keywords.some(keyword => name.includes(keyword.toLowerCase()))
  }

  /**
   * 商品名から数量を抽出
   */
  static extractQuantity(name: string): { quantity: number; unit: string } {
    // 数量パターンの検索
    const quantityPatterns = [
      /(\d+)個/,
      /(\d+)本/,
      /(\d+)袋/,
      /(\d+)パック/,
      /×(\d+)/,
      /(\d+)g/,
      /(\d+)ml/,
      /(\d+)L/
    ]

    for (const pattern of quantityPatterns) {
      const match = name.match(pattern)
      if (match) {
        const quantity = parseInt(match[1])
        const unit = name.includes('g') ? 'g' :
                    name.includes('ml') ? 'ml' :
                    name.includes('L') ? 'L' :
                    name.includes('個') ? '個' :
                    name.includes('本') ? '本' :
                    name.includes('袋') ? '袋' :
                    name.includes('パック') ? 'パック' : '個'
        return { quantity, unit }
      }
    }

    return { quantity: 1, unit: '個' }
  }

  /**
   * ブランド名の統一処理
   */
  static normalizeBrandName(name: string): string {
    const brandMappings = NORMALIZATION_RULES.brandNames
    let normalized = name

    Object.entries(brandMappings).forEach(([standard, variations]) => {
      variations.forEach(variation => {
        const regex = new RegExp(variation, 'gi')
        normalized = normalized.replace(regex, standard)
      })
    })

    return normalized
  }

  /**
   * 商品名の基本的なクリーンアップ
   */
  static cleanProductName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')  // 複数の空白を単一の空白に
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '') // 不要な記号を除去
      .trim()
  }

  /**
   * 商品名の妥当性チェック
   */
  static isValidProductName(name: string): boolean {
    const cleaned = this.cleanProductName(name)
    return cleaned.length >= 2 && 
           cleaned.length <= 50 && 
           !/^\d+$/.test(cleaned) && // 数字のみの名前は除外
           !/^[A-Z]+$/.test(cleaned) // 大文字のみの名前は除外（商品コードの可能性）
  }
}