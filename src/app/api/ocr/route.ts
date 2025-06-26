// app/api/ocr/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import sharp from 'sharp'
import { parseReceiptTextUniversal } from '@/lib/improvedIntelligentParser'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Google Cloud Vision クライアントの初期化
const visionClient = new ImageAnnotatorClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
})

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    // ファイルをBufferに変換
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 画像を最適化（サイズ縮小・品質向上）
    const optimizedBuffer = await sharp(buffer)
      .resize(1200, 1200, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .sharpen()
      .toBuffer()

    // Google Cloud Vision APIでOCR実行
    const [result] = await visionClient.textDetection({
      image: { content: optimizedBuffer }
    })

    const detections = result.textAnnotations
    const extractedText = detections?.[0]?.description || ''

    if (!extractedText) {
      return NextResponse.json({ 
        error: 'テキストを検出できませんでした' 
      }, { status: 400 })
    }

    // 汎用レシートパーサーを使用してアイテムを抽出
    const items = parseReceiptTextUniversal(extractedText)

    // デバッグ用ログ
    console.log('=== OCR デバッグ情報 ===')
    console.log('抽出されたテキスト:')
    console.log(extractedText)
    console.log('\n解析された商品:')
    console.log(JSON.stringify(items, null, 2))
    console.log('===================')

    return NextResponse.json({
      success: true,
      extractedText,
      items,
      debug: {
        textLines: extractedText.split('\n').length,
        itemsFound: items.length
      }
    })

  } catch (error: any) {
    console.error('OCR エラー:', error)
    return NextResponse.json({ 
      error: 'OCR処理中にエラーが発生しました: ' + error.message 
    }, { status: 500 })
  }
}