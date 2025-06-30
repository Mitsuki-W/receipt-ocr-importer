import { CATEGORIES } from '@/constants/itemConstants'

/**
 * 商品名から適切なカテゴリを自動分類するシステム
 * 既存の食材管理システムのカテゴリに準拠
 */
export class ProductCategorizer {
  
  // カテゴリ定義（既存システムに合わせて）
  private static readonly CATEGORY_KEYWORDS = {
    '野菜': {
      keywords: [
        '野菜', 'キャベツ', 'にんじん', 'じゃがいも', 'たまねぎ', 'トマト', 'きゅうり', 'なす', 'ピーマン', 
        'レタス', 'ほうれん草', 'もやし', 'ねぎ', 'だいこん', 'ブロッコリー', 'アスパラ', 'かぼちゃ',
        'しめじ', 'えのき', 'しいたけ', 'エリンギ', 'ごぼう', 'れんこん', 'いんげん', 'パセリ',
        'セロリ', '白菜', 'チンゲン菜', 'ズッキーニ', 'オクラ', 'とうもろこし', 'スプラウト',
        // English keywords
        'vegetable', 'vegetables', 'cabbage', 'carrot', 'carrots', 'potato', 'potatoes', 'onion', 'onions',
        'tomato', 'tomatoes', 'cucumber', 'eggplant', 'pepper', 'peppers', 'lettuce', 'spinach',
        'bean sprouts', 'green onion', 'radish', 'broccoli', 'asparagus', 'pumpkin', 'squash',
        'mushroom', 'mushrooms', 'shiitake', 'burdock', 'lotus root', 'green beans', 'parsley',
        'celery', 'bok choy', 'zucchini', 'okra', 'corn', 'sprouts'
      ],
      patterns: [
        /.*野菜$/,
        /.*菜$/
      ]
    },
    '果物': {
      keywords: [
        'りんご', 'みかん', 'バナナ', 'いちご', 'ぶどう', 'なし', 'もも', 'メロン', 'スイカ', 'キウイ',
        'オレンジ', 'グレープフルーツ', 'レモン', 'ライム', 'パイナップル', 'マンゴー', 'アボカド',
        'さくらんぼ', 'ブルーベリー', 'ラズベリー', 'いちじく', 'あんず', '柿', '栗',
        // English keywords
        'fruit', 'fruits', 'apple', 'apples', 'orange', 'oranges', 'banana', 'bananas', 'strawberry', 'strawberries',
        'grape', 'grapes', 'pear', 'pears', 'peach', 'peaches', 'melon', 'watermelon', 'kiwi',
        'grapefruit', 'lemon', 'lemons', 'lime', 'limes', 'pineapple', 'mango', 'mangoes', 'avocado', 'avocados',
        'cherry', 'cherries', 'blueberry', 'blueberries', 'raspberry', 'raspberries', 'fig', 'figs', 'apricot', 'persimmon'
      ],
      patterns: [
        /.*フルーツ$/,
        /.*果$/
      ]
    },
    '肉類': {
      keywords: [
        '豚', '牛', '鶏', '肉', 'ロース', 'バラ', 'もも', 'ひき肉', 'こま', 'ソーセージ', 'ハム', 'ベーコン',
        '鳥', 'チキン', 'ポーク', 'ビーフ', 'ラム', '羊', '合挽き', 'つくね', 'ウインナー', 'サラミ',
        // English keywords
        'meat', 'pork', 'beef', 'chicken', 'turkey', 'lamb', 'ham', 'bacon', 'sausage', 'sausages',
        'ground beef', 'ground pork', 'ground chicken', 'minced meat', 'loin', 'ribs', 'steak',
        'hot dog', 'hot dogs', 'wiener', 'salami', 'deli meat', 'cold cuts'
      ],
      patterns: [
        /.*肉$/,
        /.*ハム$/,
        /.*ベーコン$/
      ]
    },
    '魚類': {
      keywords: [
        '魚', 'さけ', 'まぐろ', 'かつお', 'いわし', 'さば', 'あじ', 'かれい', 'たら', '刺身', '切身',
        'サーモン', 'ツナ', 'いか', 'たこ', 'えび', 'かに', 'ほたて', 'あさり', 'しじみ', 'うなぎ',
        'さんま', 'ぶり', 'ひらめ', 'すずき', 'のり', 'わかめ', '昆布',
        // English keywords
        'fish', 'salmon', 'tuna', 'mackerel', 'sardine', 'cod', 'flounder', 'sea bass', 'sashimi',
        'squid', 'octopus', 'shrimp', 'prawns', 'crab', 'scallop', 'clam', 'clams', 'eel',
        'seaweed', 'nori', 'wakame', 'kelp', 'seafood'
      ],
      patterns: [
        /.*魚$/,
        /.*刺身$/,
        /.*切身$/
      ]
    },
    '乳製品': {
      keywords: [
        '牛乳', 'ミルク', 'チーズ', 'ヨーグルト', 'バター', 'クリーム', '生クリーム', 'カッテージチーズ',
        'モッツァレラ', 'チェダー', 'ゴーダ', 'カマンベール', 'クリームチーズ', 'マスカルポーネ',
        // English keywords
        'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'heavy cream', 'sour cream',
        'cottage cheese', 'mozzarella', 'cheddar', 'gouda', 'camembert', 'cream cheese', 'mascarpone',
        'dairy', 'whole milk', 'skim milk', '2% milk'
      ],
      patterns: [
        /.*乳$/,
        /.*ミルク$/,
        /.*チーズ$/
      ]
    },
    'パン・穀物': {
      keywords: [
        'パン', '食パン', '米', 'ご飯', 'うどん', 'そば', 'ラーメン', 'パスタ', 'そうめん', '麺',
        'スパゲティ', 'マカロニ', 'ペンネ', '小麦粉', 'パン粉', 'オートミール', 'シリアル',
        'クロワッサン', 'バゲット', 'ベーグル', 'マフィン', 'ロールパン',
        // English keywords
        'bread', 'white bread', 'whole wheat bread', 'rice', 'pasta', 'noodles', 'spaghetti',
        'macaroni', 'penne', 'flour', 'breadcrumbs', 'oatmeal', 'cereal', 'croissant',
        'baguette', 'bagel', 'muffin', 'roll', 'grain', 'grains', 'wheat', 'quinoa'
      ],
      patterns: [
        /.*パン$/,
        /.*米$/,
        /.*麺$/,
        /.*うどん$/,
        /.*そば$/
      ]
    },
    '缶詰・瓶詰': {
      keywords: [
        '缶詰', '瓶詰', 'ツナ缶', 'コーン缶', 'トマト缶', 'ジャム', 'はちみつ', 'シロップ',
        'オリーブ', 'ピクルス', '梅干し', '佃煮', 'のり佃煮', 'なめたけ', 'メンマ',
        // English keywords
        'canned', 'jarred', 'tuna can', 'corn can', 'tomato can', 'jam', 'jelly', 'honey', 'syrup',
        'olives', 'pickles', 'preserve', 'preserves', 'sauce jar', 'canned food', 'bottled'
      ],
      patterns: [
        /.*缶$/,
        /.*瓶$/,
        /.*ジャム$/
      ]
    },
    '調味料': {
      keywords: [
        '醤油', 'みそ', '味噌', '塩', '砂糖', '酢', 'みりん', '料理酒', '油', 'ごま油', 'オリーブ', 
        'マヨネーズ', 'ケチャップ', 'ソース', 'ドレッシング', 'だし', 'こんぶ', 'かつお節',
        'わさび', 'からし', 'にんにく', 'しょうが', '胡椒', 'こしょう', 'スパイス', '香辛料',
        'タバスコ', '七味', '一味', 'ごま', 'のり', 'ふりかけ',
        // English keywords
        'soy sauce', 'miso', 'salt', 'sugar', 'vinegar', 'mirin', 'cooking wine', 'oil', 'olive oil',
        'mayonnaise', 'ketchup', 'sauce', 'dressing', 'spice', 'spices', 'pepper', 'garlic', 'ginger',
        'mustard', 'wasabi', 'hot sauce', 'seasoning', 'condiment', 'condiments'
      ],
      patterns: [
        /.*調味料$/,
        /.*ソース$/,
        /.*油$/
      ]
    },
    '飲料': {
      keywords: [
        '水', 'お茶', '緑茶', '麦茶', 'ウーロン茶', '紅茶', 'コーヒー', 'ジュース', 'コーラ', 
        'サイダー', 'ビール', '酒', '焼酎', 'ワイン', '日本酒', 'チューハイ', 'ハイボール',
        'ミルク', '豆乳', 'ドリンク', 'スポーツドリンク', 'エナジー', '炭酸',
        '金麦', 'アサヒ', 'キリン', 'サントリー', 'サッポロ', 'ペプシ', 'ファンタ', 'カルピス',
        // English keywords
        'water', 'tea', 'green tea', 'black tea', 'coffee', 'juice', 'cola', 'coke', 'pepsi',
        'soda', 'soft drink', 'beer', 'wine', 'alcohol', 'vodka', 'whiskey', 'rum', 'gin',
        'energy drink', 'sports drink', 'milk', 'soy milk', 'almond milk', 'beverage', 'drink'
      ],
      patterns: [
        /.*ml$/,
        /.*リットル$/,
        /.*L$/,
        /.*茶$/,
        /.*酒$/,
        /.*ビール$/,
        /.*ジュース$/
      ]
    },
    'お菓子': {
      keywords: [
        'チョコ', 'クッキー', 'ケーキ', 'せんべい', 'ポテト', 'スナック', 'グミ', 'キャンディ',
        'ガム', 'マシュマロ', 'ビスケット', 'ウエハース', 'プリン', 'ゼリー', 'ようかん',
        'まんじゅう', 'どら焼き', 'カステラ', 'バウムクーヘン', 'チップス', 'ナッツ', 'アーモンド',
        // English keywords
        'chocolate', 'cookie', 'cookies', 'cake', 'candy', 'gum', 'chips', 'snack', 'snacks',
        'biscuit', 'wafer', 'pudding', 'jelly', 'marshmallow', 'nuts', 'almond', 'peanut',
        'ice cream', 'dessert', 'sweet', 'sweets'
      ],
      patterns: [
        /.*チョコ.*$/,
        /.*ケーキ$/,
        /.*クッキー$/
      ]
    },
    '冷凍食品': {
      keywords: [
        '冷凍', 'アイス', 'アイスクリーム', 'ソフトクリーム', 'シャーベット', '氷',
        '冷凍野菜', '冷凍肉', '冷凍魚', '冷凍餃子', '冷凍うどん', '冷凍ピザ', '冷凍フライ',
        // English keywords
        'frozen', 'ice cream', 'ice', 'frozen food', 'frozen vegetables', 'frozen meat',
        'frozen fish', 'frozen pizza', 'frozen dinner', 'popsicle', 'sherbet', 'sorbet'
      ],
      patterns: [
        /^冷凍.*/,
        /.*アイス.*$/
      ]
    }
  }

  /**
   * 商品名から最適なカテゴリを判定
   */
  static categorize(productName: string): string {
    if (!productName || productName.trim().length === 0) {
      return 'その他'
    }

    const cleanName = productName.trim().toLowerCase()
    
    // 各カテゴリをチェック
    for (const [category, config] of Object.entries(this.CATEGORY_KEYWORDS)) {
      // キーワードマッチング
      if (config.keywords.some(keyword => cleanName.includes(keyword.toLowerCase()))) {
        return category
      }
      
      // パターンマッチング
      if (config.patterns && config.patterns.some(pattern => pattern.test(cleanName))) {
        return category
      }
    }

    // 特別なパターンチェック
    const specialCategory = this.checkSpecialPatterns(cleanName)
    if (specialCategory) {
      return specialCategory
    }

    return 'その他'
  }

  /**
   * 特別なパターンによる分類
   */
  private static checkSpecialPatterns(name: string): string | null {
    // 容量・単位による判定
    if (/\d+ml|\d+l|\d+リットル/.test(name)) {
      return '飲料'
    }

    // グラム表記での食品判定
    if (/\d+g|\d+kg|\d+グラム/.test(name)) {
      return '食品'
    }

    // パック・個数での食品判定
    if (/\d+パック|\d+個入り/.test(name)) {
      return '食品'
    }

    return null
  }

  /**
   * カテゴリ一覧を取得
   */
  static getAvailableCategories(): string[] {
    return Object.keys(this.CATEGORY_KEYWORDS).concat(['その他'])
  }

  /**
   * デバッグ用：マッチした理由を返す
   */
  static categorizeWithReason(productName: string): { category: string, reason: string } {
    if (!productName || productName.trim().length === 0) {
      return { category: 'その他', reason: '商品名が空' }
    }

    const cleanName = productName.trim().toLowerCase()
    
    // 各カテゴリをチェック
    for (const [category, config] of Object.entries(this.CATEGORY_KEYWORDS)) {
      // キーワードマッチング
      const matchedKeyword = config.keywords.find(keyword => 
        cleanName.includes(keyword.toLowerCase())
      )
      if (matchedKeyword) {
        return { 
          category, 
          reason: `キーワード「${matchedKeyword}」にマッチ` 
        }
      }
      
      // パターンマッチング
      if (config.patterns) {
        const matchedPattern = config.patterns.find(pattern => pattern.test(cleanName))
        if (matchedPattern) {
          return { 
            category, 
            reason: `パターン「${matchedPattern}」にマッチ` 
          }
        }
      }
    }

    // 特別なパターンチェック
    const specialCategory = this.checkSpecialPatterns(cleanName)
    if (specialCategory) {
      return { 
        category: specialCategory, 
        reason: '容量・単位パターンにマッチ' 
      }
    }

    return { category: 'その他', reason: 'マッチするパターンなし' }
  }
}