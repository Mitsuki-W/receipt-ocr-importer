import { NextRequest, NextResponse } from 'next/server'

/**
 * OCR API テスト用エンドポイント
 * シンプルなモックレスポンスを返してフロントエンドの動作確認を行う
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🧪 OCR テストAPI 開始:', new Date().toISOString())
  
  try {
    console.log('📝 FormData解析開始')
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      console.log('❌ ファイルが見つかりません')
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    console.log('📁 テスト用ファイル情報:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // テスト用の遅延（実際のOCR処理をシミュレート）
    console.log('⏳ テスト用処理開始（3秒待機）')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // モックデータ
    const mockResult = {
      success: true,
      extractedText: "テスト商品1\n123456\n1\n500\n500 T\nテスト商品2\n789012\n2\n300\n600 E",
      items: [
        {
          name: "テスト商品1",
          price: 500,
          quantity: 1,
          confidence: 0.9,
          sourcePattern: "test-pattern",
          lineNumbers: [0, 1, 2, 3, 4],
          rawText: "テスト商品1 | 123456 | 1 | 500 | 500 T",
          category: "テスト"
        },
        {
          name: "テスト商品2", 
          price: 600,
          quantity: 2,
          confidence: 0.85,
          sourcePattern: "test-pattern",
          lineNumbers: [5, 6, 7, 8, 9],
          rawText: "テスト商品2 | 789012 | 2 | 300 | 600 E",
          category: "テスト"
        }
      ],
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.875,
        storeType: "test-store",
        patternUsed: "test-pattern",
        fallbackUsed: false
      }
    }

    const processingTime = Date.now() - startTime
    console.log('✅ テストOCR処理完了:', {
      processingTime: processingTime + 'ms',
      success: mockResult.success,
      itemsFound: mockResult.items.length
    })

    return NextResponse.json({
      success: true,
      extractedText: mockResult.extractedText,
      items: mockResult.items,
      metadata: mockResult.metadata,
      debug: {
        testMode: true,
        textLines: mockResult.extractedText.split('\n').length,
        itemsFound: mockResult.items.length,
        storeDetected: mockResult.metadata.storeType,
        patternUsed: mockResult.metadata.patternUsed,
        confidence: mockResult.metadata.confidence,
        processingTime: processingTime
      }
    })

  } catch (error: unknown) {
    const processingTime = Date.now() - startTime
    console.error('❌ テストOCR API エラー:', {
      error: error instanceof Error ? error.message : error,
      processingTime: processingTime + 'ms'
    })
    
    return NextResponse.json({ 
      error: 'テストOCR処理中にエラーが発生しました: ' + (error instanceof Error ? error.message : '不明なエラー'),
      debug: {
        testMode: true,
        processingTime: processingTime + 'ms',
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'OCR テストAPI',
    usage: 'POST /api/ocr/test',
    description: 'フロントエンドの動作確認用モックエンドポイント'
  })
}