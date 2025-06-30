# OCR 性能向上ガイド

## 概要

レシートOCRシステムの性能を向上させるため、以下の新機能を追加しました：

1. **段階的パターンマッチング**
2. **詳細デバッグ分析**
3. **自動検証・修正機能**
4. **パフォーマンス分析**

## 🔧 新機能の詳細

### 1. 段階的パターンマッチング

#### 従来の問題
- パターンマッチングの精度が低い
- 店舗認識が不正確
- フォールバック処理が簡素

#### 改善内容
```typescript
// 4段階の処理ステップ
1. 厳密パターンマッチング (信頼度 >= 0.8)
2. 柔軟パターンマッチング (信頼度 >= 0.5) 
3. ヒューリスティック解析
4. AI支援解析 (将来拡張用)
```

#### 使用方法
```typescript
const options = {
  useImprovedProcessor: true,  // 改良プロセッサーを使用
  debugMode: true             // デバッグ情報を出力
}
```

### 2. 詳細デバッグ分析

#### 機能
- **テキスト分析**: 行数、文字種、怪しい行の検出
- **パターン分析**: 店舗検出、パターンマッチング状況
- **結果分析**: 品質スコア、異常データの検出
- **改善提案**: 具体的な修正案の自動生成

#### デバッグレポートの例
```
=== OCR デバッグレポート ===

📄 テキスト分析:
  - 総行数: 45
  - 有効行数: 38
  - 平均行長: 12.3文字
  - 日本語: あり
  - 価格行数: 8
  - 商品行数: 12

🏪 店舗検出:
  - 検出結果: supermarket-a
  - 信頼度: 85.0%
  - マッチキーワード: スーパーA, SUPER-A

📊 結果分析:
  - 検出商品数: 8
  - 価格あり: 8/8
  - 平均信頼度: 72.5%
  - 品質スコア: 81.2%

💡 改善提案:
  - 全体的な品質は良好です
```

### 3. 自動検証・修正機能

#### 検証項目
1. **価格検証**: 妥当な価格範囲、異常値検出
2. **商品名検証**: 長さ、文字種、パターンチェック
3. **数量検証**: 正の整数、妥当な範囲
4. **重複検証**: 同一商品の重複検出
5. **整合性検証**: 商品名と価格の関連性

#### 自動修正機能
```typescript
// 修正例
{
  field: 'name',
  originalValue: '  *リンゴ  ',
  correctedValue: 'リンゴ',
  confidence: 0.8,
  reason: '商品名のクリーンアップ'
}
```

### 4. パフォーマンス分析

#### 比較メトリクス
- **処理時間**: 平均・最小・最大時間
- **成功率**: 正常処理の割合
- **検出精度**: 商品数・信頼度
- **推奨プロセッサー**: 自動選択

## 🚀 使用方法

### 基本的な使用方法

```typescript
const enhancedOCR = new EnhancedOCRService()

// 最適化されたOCR処理
const result = await enhancedOCR.processImage(imageFile, {
  useImprovedProcessor: true,
  enableValidation: true,
  enableAutoCorrection: true,
  debugMode: true
})
```

### デバッグ分析の実行

```typescript
// 完全なデバッグ分析
const debugResult = await enhancedOCR.getFullDebugAnalysis(imageFile)

console.log(debugResult.report)     // 詳細レポート
console.log(debugResult.suggestions) // 改善提案
```

### パフォーマンステスト

```typescript
// 両プロセッサーの比較テスト
const performanceTest = await enhancedOCR.runPerformanceTest(imageFile, {
  iterations: 5,
  testBothProcessors: true
})

console.log(performanceTest.recommendation) // 推奨プロセッサー
```

## 🛠️ デバッグAPI

### エンドポイント: `/api/ocr/debug`

#### 1. 完全分析
```bash
curl -X POST /api/ocr/debug \
  -F "image=@receipt.jpg" \
  -F "action=analysis"
```

#### 2. パフォーマンステスト
```bash
curl -X POST /api/ocr/debug \
  -F "image=@receipt.jpg" \
  -F "action=performance"
```

#### 3. プロセッサー比較
```bash
curl -X POST /api/ocr/debug \
  -F "image=@receipt.jpg" \
  -F "action=comparison"
```

#### 4. 検証詳細
```bash
curl -X POST /api/ocr/debug \
  -F "image=@receipt.jpg" \
  -F "action=validation"
```

## 📊 パフォーマンス指標

### 品質スコアの計算

```typescript
品質スコア = (価格有効率 × 0.4) + (商品名有効率 × 0.4) + (信頼度 × 0.2)
```

### 推奨基準
- **品質スコア >= 0.8**: 優秀
- **品質スコア >= 0.6**: 良好
- **品質スコア >= 0.4**: 普通
- **品質スコア < 0.4**: 要改善

## 🔍 トラブルシューティング

### よくある問題と解決策

#### 1. 商品が検出されない
**原因**: 画像品質が低い、店舗パターンが未対応
**解決策**: 
- より鮮明な画像を使用
- デバッグ分析で店舗検出状況を確認
- 新しいパターンの追加を検討

#### 2. 価格が正しく抽出されない
**原因**: 価格パターンが不適切、レイアウトが特殊
**解決策**:
- デバッグ分析で価格行の検出状況を確認
- 柔軟パターンマッチングを有効化
- 手動修正機能を活用

#### 3. 処理時間が長い
**原因**: 複雑なパターン処理、大きな画像サイズ
**解決策**:
- 画像サイズを最適化
- maxProcessingTimeを調整
- 標準プロセッサーの使用を検討

#### 4. 重複商品が検出される
**原因**: パターンマッチングの重複、OCRの誤認識
**解決策**:
- 自動検証機能を有効化
- 重複除去の閾値を調整

## 📈 パフォーマンス最適化のヒント

### 1. 画像前処理
```typescript
// 推奨設定
const optimizedBuffer = await sharp(buffer)
  .resize(1200, 1200, { 
    fit: 'inside',
    withoutEnlargement: true 
  })
  .jpeg({ quality: 85 })
  .sharpen()
  .toBuffer()
```

### 2. オプション設定
```typescript
const optimizedOptions = {
  maxProcessingTime: 15000,        // 十分な処理時間
  confidenceThreshold: 0.3,        // 適度な閾値
  enableValidation: true,          // 検証を有効化
  enableAutoCorrection: true,      // 自動修正を有効化
  useImprovedProcessor: true       // 改良プロセッサーを使用
}
```

### 3. エラーハンドリング
```typescript
try {
  const result = await enhancedOCR.processImage(file, options)
  
  if (result.metadata?.fallbackUsed) {
    console.warn('フォールバック処理が使用されました')
    // 追加の検証や手動確認を推奨
  }
  
} catch (error) {
  console.error('OCR処理エラー:', error)
  // エラー時の代替処理
}
```

## 🎯 今後の改善予定

1. **機械学習による精度向上**
   - パターン学習の自動化
   - 異常検知の高度化

2. **ユーザーフィードバック機能**
   - 手動修正結果の学習
   - パターンの動的調整

3. **リアルタイム処理**
   - ストリーミングOCR
   - プレビュー機能

4. **多言語対応**
   - 英語レシートの対応
   - 多国籍店舗への対応

## 📞 サポート

技術的な問題や改善提案がある場合は、以下の手順で報告してください：

1. デバッグ分析の実行
2. エラーログの収集
3. 使用した画像とオプションの記録
4. 期待する結果と実際の結果の比較

デバッグAPI (`/api/ocr/debug`) を活用して、詳細な分析情報を取得してください。