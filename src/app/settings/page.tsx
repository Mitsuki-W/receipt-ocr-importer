'use client'

import { useState } from 'react'
import { OCRPatternConfig } from '@/types/ocr-patterns'
import PatternManager from '@/components/patterns/pattern-manager'
import PatternTester from '@/components/patterns/pattern-tester'
import PatternCreator from '@/components/patterns/pattern-creator'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'patterns' | 'test' | 'create'>('patterns')
  const [selectedPattern, setSelectedPattern] = useState<OCRPatternConfig | undefined>()

  const tabs = [
    { id: 'patterns' as const, name: 'パターン管理', icon: '⚙️' },
    { id: 'test' as const, name: 'パターンテスト', icon: '🧪' },
    { id: 'create' as const, name: 'パターン作成', icon: '➕' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">設定</h1>
            <p className="text-slate-600">OCRパターンの管理とテストを行います</p>
          </div>

          {/* タブナビゲーション */}
          <div className="bg-white rounded-xl border border-slate-200 mb-6">
            <div className="flex border-b border-slate-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 px-6 py-4 font-medium transition-colors
                    ${activeTab === tab.id
                      ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'patterns' && (
                <PatternManager 
                  onPatternSelect={(pattern) => {
                    setSelectedPattern(pattern)
                    setActiveTab('test')
                  }}
                />
              )}
              
              {activeTab === 'test' && (
                <div className="space-y-6">
                  {selectedPattern ? (
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800">
                          {selectedPattern.name} のテスト
                        </h3>
                        <p className="text-sm text-slate-600">{selectedPattern.description}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('patterns')}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        パターン一覧に戻る
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-slate-500 mb-4">
                        テストするパターンが選択されていません
                      </div>
                      <button
                        onClick={() => setActiveTab('patterns')}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                      >
                        パターンを選択
                      </button>
                    </div>
                  )}
                  
                  <PatternTester pattern={selectedPattern} />
                </div>
              )}
              
              {activeTab === 'create' && (
                <PatternCreator 
                  onPatternCreated={(pattern) => {
                    setSelectedPattern(pattern)
                    setActiveTab('patterns')
                  }}
                />
              )}
            </div>
          </div>

          {/* フッター情報 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">パターンシステムについて</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600">
              <div>
                <h4 className="font-medium text-slate-800 mb-2">パターンの種類</h4>
                <ul className="space-y-1">
                  <li><strong>single-line:</strong> 1行パターンマッチング</li>
                  <li><strong>multi-line:</strong> 複数行パターンマッチング</li>
                  <li><strong>context-aware:</strong> コンテキスト情報を使用</li>
                  <li><strong>template-based:</strong> テンプレートベース</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-slate-800 mb-2">対応店舗</h4>
                <ul className="space-y-1">
                  <li><strong>Costco:</strong> 5行形式レシート</li>
                  <li><strong>ライフ:</strong> *印付き商品</li>
                  <li><strong>コンビニ:</strong> 基本的な商品名+価格</li>
                  <li><strong>汎用:</strong> その他の店舗</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}