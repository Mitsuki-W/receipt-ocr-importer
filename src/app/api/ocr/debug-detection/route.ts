import { NextRequest, NextResponse } from 'next/server'
import { DetectionDebugger } from '@/lib/ocr/detection-debugger'

export async function POST(request: NextRequest) {
  try {
    const { ocrText, expectedProducts } = await request.json()
    
    if (!ocrText) {
      return NextResponse.json({
        error: 'OCRテキストが提供されていません'
      }, { status: 400 })
    }
    
    console.log('🔍 商品名検出デバッグAPI開始')
    
    // 商品名検出の詳細デバッグ
    const debugResult = DetectionDebugger.debugProductDetection(ocrText, expectedProducts)
    
    // OCR改善提案
    const ocrSuggestions = DetectionDebugger.suggestOCRImprovements(ocrText)
    
    // 行ごとのテスト結果
    const lines = ocrText.split('\n').filter(line => line.trim())
    const lineTests = lines.map((line, index) => {
      const test = DetectionDebugger.testProductDetection(line.trim())
      return {
        lineNumber: index,
        content: line.trim(),
        isDetected: test.isDetected,
        confidence: test.confidence,
        rejectionReasons: test.reasons
      }
    })
    
    return NextResponse.json({
      success: true,
      analysis: debugResult.analysis,
      recommendations: debugResult.recommendations,
      detailedReport: debugResult.detailedReport,
      ocrSuggestions,
      lineTests: lineTests.slice(0, 50), // 最初の50行のみ表示
      summary: {
        totalLines: debugResult.analysis.totalLines,
        detectedLines: debugResult.analysis.candidateLines,
        detectionRate: (debugResult.analysis.candidateLines / debugResult.analysis.totalLines * 100).toFixed(1),
        avgConfidence: debugResult.analysis.acceptedLines.length > 0 
          ? (debugResult.analysis.acceptedLines.reduce((sum, line) => sum + line.confidence, 0) / debugResult.analysis.acceptedLines.length).toFixed(3)
          : '0.000'
      }
    })
    
  } catch (error) {
    console.error('商品名検出デバッグエラー:', error)
    return NextResponse.json({
      error: 'デバッグ処理中にエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: '商品名検出デバッグAPI',
    usage: 'POST /api/ocr/debug-detection',
    parameters: {
      ocrText: 'string (required) - OCRで読み取ったテキスト',
      expectedProducts: 'string[] (optional) - 期待される商品名のリスト'
    },
    example: {
      ocrText: 'UGG ANSLEY シューズ\n123456\n1\n5966\n5966 T',
      expectedProducts: ['UGG ANSLEY シューズ']
    }
  })
}