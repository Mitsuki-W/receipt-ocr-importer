// app/api/ocr/problem-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { EnhancedOCRService } from '@/lib/ocr/enhanced-ocr-service'
import { OCRProblemAnalyzer } from '@/lib/ocr/problem-analyzer'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック（開発環境ではスキップ可能）
    if (process.env.NODE_ENV === 'production') {
      const supabase = createRouteHandlerClient({ cookies })
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
      }
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    console.log('🔍 OCR問題分析を開始します...')

    // 標準OCR処理を実行
    const enhancedOCR = new EnhancedOCRService()
    const result = await enhancedOCR.processImage(file, {
      debugMode: true,
      useImprovedProcessor: false, // まず標準で問題を確認
      enableValidation: false,     // 生の結果を取得
      enableAutoCorrection: false
    })

    if (!result.success) {
      return NextResponse.json({ 
        error: 'OCR処理に失敗しました',
        details: 'ファイルを確認してください'
      }, { status: 400 })
    }

    // 問題分析を実行
    const problemAnalysis = OCRProblemAnalyzer.analyzeProblem(
      result.extractedText,
      result.items
    )

    // 改良版でも処理して比較
    const improvedResult = await enhancedOCR.processImage(file, {
      debugMode: true,
      useImprovedProcessor: true,
      enableValidation: true,
      enableAutoCorrection: true
    })

    const improvedAnalysis = improvedResult.success ? 
      OCRProblemAnalyzer.analyzeProblem(
        improvedResult.extractedText,
        improvedResult.items
      ) : null

    // 詳細レポート生成
    const report = OCRProblemAnalyzer.generateProblemReport(problemAnalysis)
    const improvedReport = improvedAnalysis ? 
      OCRProblemAnalyzer.generateProblemReport(improvedAnalysis) : 
      null

    console.log('📊 OCR問題分析レポート:')
    console.log(report)

    if (improvedReport) {
      console.log('\n📈 改良版での結果:')
      console.log(improvedReport)
    }

    // 具体的な修正案を生成
    const fixingSuggestions = generateFixingSuggestions(problemAnalysis, result.extractedText)

    return NextResponse.json({
      success: true,
      originalResult: {
        itemCount: result.items.length,
        items: result.items,
        metadata: result.metadata
      },
      improvedResult: improvedResult.success ? {
        itemCount: improvedResult.items.length,
        items: improvedResult.items,
        metadata: improvedResult.metadata
      } : null,
      problemAnalysis: {
        analysis: problemAnalysis,
        report,
        fixingSuggestions
      },
      improvedAnalysis: improvedAnalysis ? {
        analysis: improvedAnalysis,
        report: improvedReport
      } : null,
      rawText: result.extractedText,
      recommendations: generateRecommendations(problemAnalysis, improvedAnalysis)
    })

  } catch (error) {
    console.error('問題分析API エラー:', error)
    return NextResponse.json({ 
      error: '問題分析でエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

function generateFixingSuggestions(analysis: any, rawText: string) {
  const suggestions = []

  // レジ番号問題の修正案
  if (analysis.invalidItems.regNumbers.length > 0) {
    suggestions.push({
      problem: 'レジ番号が商品として認識される',
      patternExamples: analysis.invalidItems.regNumbers.map((item: any) => item.name),
      suggestedExcludePattern: '^(レジ|REG)\\d+$|^\\d{2,4}$',
      code: `
// excludeKeywords に追加
excludeKeywords: [
  ...existing,
  'レジ', 'REG', 'REGISTER',
  // 数字のみの短い文字列を除外
],
// パターンに追加
validation: {
  exclude_patterns: ['^\\\\d{2,4}$', '^(レジ|REG)\\\\d+$']
}
      `
    })
  }

  // 価格が商品名に含まれる問題
  if (analysis.invalidItems.priceInName.length > 0) {
    suggestions.push({
      problem: '商品名に価格が含まれる',
      patternExamples: analysis.invalidItems.priceInName.map((item: any) => item.name),
      suggestedSeparationLogic: '正規表現で商品名と価格を分離',
      code: `
// 商品名から価格を除去
function cleanProductName(name) {
  return name
    .replace(/\\d+[円¥]/g, '')    // 180円 を除去
    .replace(/¥\\d+/g, '')        // ¥180 を除去
    .replace(/\\s+\\d+$/g, '')    // 末尾の数字を除去
    .trim()
}
      `
    })
  }

  // 重複商品の修正案
  if (analysis.duplicates.groups.length > 0) {
    suggestions.push({
      problem: '同じ商品が重複して検出される',
      patternExamples: analysis.duplicates.groups.map((group: any) => ({
        pattern: group.pattern,
        count: group.items.length
      })),
      suggestedDeduplication: '類似度ベースの重複除去',
      code: `
// 重複除去の強化
function removeDuplicates(items) {
  const unique = []
  const similarity_threshold = 0.8
  
  for (const item of items) {
    const isDuplicate = unique.some(existing => 
      calculateSimilarity(item.name, existing.name) > similarity_threshold &&
      Math.abs((item.price || 0) - (existing.price || 0)) < 20
    )
    
    if (!isDuplicate) {
      unique.push(item)
    }
  }
  
  return unique
}
      `
    })
  }

  return suggestions
}

function generateRecommendations(originalAnalysis: any, improvedAnalysis: any) {
  const recommendations = []

  // 改良版での改善効果
  if (improvedAnalysis) {
    const originalIssues = originalAnalysis.suggestions.length
    const improvedIssues = improvedAnalysis.suggestions.length
    
    if (improvedIssues < originalIssues) {
      recommendations.push({
        type: 'improvement',
        message: `改良プロセッサーで${originalIssues - improvedIssues}件の問題が解決されました`,
        action: 'useImprovedProcessor: true を推奨'
      })
    }
  }

  // 重要度別の推奨事項
  const criticalIssues = originalAnalysis.suggestions.filter((s: any) => s.category === 'critical')
  if (criticalIssues.length > 0) {
    recommendations.push({
      type: 'critical',
      message: `${criticalIssues.length}件の重要な問題があります`,
      action: '緊急対応が必要です',
      issues: criticalIssues.map((issue: any) => issue.problem)
    })
  }

  // パターン調整の必要性
  const recognitionRate = (originalAnalysis.textProblems.originalLines.length > 0) ?
    ((originalAnalysis.textProblems.originalLines.length - originalAnalysis.textProblems.unrecognizedLines.length) / 
     originalAnalysis.textProblems.originalLines.length * 100) : 0

  if (recognitionRate < 50) {
    recommendations.push({
      type: 'pattern',
      message: `テキスト認識率が${recognitionRate.toFixed(1)}%と低すぎます`,
      action: 'パターンマッチングの根本的な見直しが必要',
      suggestedActions: [
        '実際のレシート画像でパターンを確認',
        '店舗固有のレイアウトパターンを追加',
        '前処理（画像の回転・ノイズ除去）の改善'
      ]
    })
  }

  return recommendations
}

export async function GET() {
  return NextResponse.json({
    message: 'OCR 問題分析API',
    description: '現在のOCR性能の問題を詳細分析し、具体的な修正案を提供します',
    usage: {
      endpoint: '/api/ocr/problem-analysis',
      method: 'POST',
      parameters: ['image (File)'],
      response: {
        originalResult: 'OCR結果（標準プロセッサー）',
        improvedResult: 'OCR結果（改良プロセッサー）',
        problemAnalysis: '問題の詳細分析',
        fixingSuggestions: '具体的な修正コード案',
        recommendations: '推奨事項'
      }
    },
    examples: [
      'curl -X POST /api/ocr/problem-analysis -F "image=@receipt.jpg"'
    ]
  })
}