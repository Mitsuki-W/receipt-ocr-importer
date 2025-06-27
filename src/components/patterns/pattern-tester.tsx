'use client'

import { useState } from 'react'
import { OCRPatternConfig, OCRParseResult } from '@/types/ocr-patterns'
import { EnhancedOCRService } from '@/lib/ocr/enhanced-ocr-service'

interface PatternTesterProps {
  pattern?: OCRPatternConfig
}

export default function PatternTester({ pattern }: PatternTesterProps) {
  const [testText, setTestText] = useState('')
  const [result, setResult] = useState<OCRParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const runTest = async () => {
    if (!pattern || !testText.trim()) return

    try {
      setLoading(true)
      const ocrService = new EnhancedOCRService()
      const patternManager = await ocrService.getPatternManager()
      
      // パターンテスト実行
      const testResult = await patternManager.testPattern(pattern, testText)
      setResult(testResult)

      // デバッグ情報取得
      const debug = await ocrService.getDebugInfo(testText)
      setDebugInfo(debug)
    } catch (error) {
      console.error('パターンテストに失敗しました:', error)
      setResult({
        patternId: pattern.id,
        confidence: 0,
        items: [],
        metadata: {
          processingTime: 0,
          patternsAttempted: [pattern.id],
          fallbackUsed: false
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const sampleTexts = [
    {
      name: 'Costco サンプル',
      text: `コストコ ホールセール ジャパン
ゴールデンパイナップル
1個
298
小計 298円`
    },
    {
      name: 'ライフ サンプル',
      text: `LIFE ライフ
*たまねぎ 200g ¥150
*牛乳 1L ¥180
*食パン 6枚 ¥128`
    },
    {
      name: 'コンビニ サンプル',
      text: `セブン-イレブン
おにぎり梅 120
お茶 500ml 100
合計 220円`
    }
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">パターンテスト</h3>
        
        {pattern ? (
          <div className="space-y-4">
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
              <div className="font-medium text-teal-800">{pattern.name}</div>
              <div className="text-sm text-teal-600">{pattern.description}</div>
            </div>

            {/* サンプルテキスト選択 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                サンプルテキストを選択
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {sampleTexts.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => setTestText(sample.text)}
                    className="p-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-left transition-colors"
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>

            {/* テストテキスト入力 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                テストテキスト
              </label>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={8}
                className="w-full p-3 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="テスト用のレシートテキストを入力してください..."
              />
            </div>

            {/* テスト実行ボタン */}
            <button
              onClick={runTest}
              disabled={!testText.trim() || loading}
              className="w-full py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'テスト中...' : 'パターンテスト実行'}
            </button>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-8">
            テストするパターンを選択してください
          </div>
        )}
      </div>

      {/* テスト結果 */}
      {result && (
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h4 className="text-lg font-semibold text-slate-800 mb-4">テスト結果</h4>
          
          <div className="space-y-4">
            {/* 基本情報 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-lg font-bold text-slate-800">
                  {(result.confidence * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-slate-600">信頼度</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-lg font-bold text-slate-800">{result.items.length}</div>
                <div className="text-sm text-slate-600">抽出アイテム</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-lg font-bold text-slate-800">
                  {result.metadata.processingTime}ms
                </div>
                <div className="text-sm text-slate-600">処理時間</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-lg font-bold text-slate-800">
                  {result.metadata.fallbackUsed ? 'Yes' : 'No'}
                </div>
                <div className="text-sm text-slate-600">フォールバック</div>
              </div>
            </div>

            {/* 抽出されたアイテム */}
            {result.items.length > 0 ? (
              <div>
                <h5 className="font-medium text-slate-800 mb-2">抽出されたアイテム</h5>
                <div className="space-y-2">
                  {result.items.map((item, index) => (
                    <div 
                      key={index}
                      className="p-3 bg-teal-50 rounded-lg border border-teal-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-teal-800">{item.name}</div>
                          <div className="text-sm text-teal-600">
                            価格: {item.price ? `¥${item.price}` : '不明'}
                            {item.quantity && ` × ${item.quantity}`}
                            {item.category && ` (${item.category})`}
                          </div>
                        </div>
                        <div className="text-xs text-teal-600">
                          信頼度: {(item.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        行番号: {item.lineNumbers.join(', ')} | 
                        パターン: {item.sourcePattern}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-4">
                アイテムが抽出されませんでした
              </div>
            )}

            {/* デバッグ情報 */}
            {debugInfo && (
              <div>
                <h5 className="font-medium text-slate-800 mb-2">デバッグ情報</h5>
                <div className="p-3 bg-slate-50 rounded-lg font-mono text-xs">
                  <div>検出店舗: {debugInfo.detectedStore || '不明'}</div>
                  <div>利用可能パターン: {debugInfo.availablePatterns}</div>
                  <div>試行パターン: {result.metadata.patternsAttempted.join(', ')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}