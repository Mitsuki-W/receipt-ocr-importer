'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { Upload, Loader2, Check, X, Camera } from 'lucide-react'
import NextImage from 'next/image'
import CameraCapture from '@/components/camera/camera-capture'

interface ExtractedItem {
  name: string
  price?: number
  quantity?: number
  category?: string
}

interface OCRResult {
  success: boolean
  extractedText: string
  items: ExtractedItem[]
}

export default function UploadPage() {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [showCamera, setShowCamera] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  const processFile = (selectedFile: File) => {
    setFile(selectedFile)
    setError('')
    setOcrResult(null)
    setShowCamera(false)
    
    // プレビュー画像を作成
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleCameraCapture = (capturedFile: File) => {
    processFile(capturedFile)
  }

  const handleOCR = async () => {
    if (!file) return

    setLoading(true)
    setError('')
    setProgress(0)

    try {
      // プログレス表示の更新
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      // 画像圧縮をクライアントサイドで実行
      const compressedFile = await compressImage(file)
      
      const formData = new FormData()
      formData.append('image', compressedFile)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'OCR処理に失敗しました')
      }

      setOcrResult(result)
      // 全ての項目をデフォルトで選択
      setSelectedItems(new Set(result.items.map((_: ExtractedItem, index: number) => index)))

    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  // クライアントサイド画像圧縮
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      
      img.onload = () => {
        // 最大サイズを設定
        const maxSize = 1200
        let { width, height } = img
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
        
        canvas.width = width
        canvas.height = height
        
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          } else {
            resolve(file)
          }
        }, 'image/jpeg', 0.85)
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }

  const handleSaveItems = async () => {
    if (!ocrResult || !user) return

    setLoading(true)
    setError('')

    try {
      const itemsToSave = ocrResult.items
        .filter((_, index) => selectedItems.has(index))
        .map(item => ({
          user_id: user.id,
          name: item.name,
          category: item.category || 'その他',
          quantity: item.quantity || 1,
          unit: '個',
          purchase_date: new Date().toISOString().split('T')[0],
          notes: item.price ? `価格: ¥${item.price}` : null,
        }))

      const { error } = await supabase
        .from('items')
        .insert(itemsToSave)

      if (error) throw error

      // 成功後にリセット
      setFile(null)
      setPreview(null)
      setOcrResult(null)
      setSelectedItems(new Set())
      
      alert(`${itemsToSave.length}個の食材を保存しました！`)
      
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (showCamera) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">レシートアップロード</h2>
          <p className="text-muted-foreground">
            レシートの写真から自動で食材を読み取ります
          </p>
        </div>
        
        <CameraCapture
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">レシートアップロード</h2>
        <p className="text-muted-foreground">
          レシートの写真から自動で食材を読み取ります
        </p>
      </div>

      {/* アップロード方法選択 */}
      <Card>
        <CardHeader>
          <CardTitle>アップロード方法を選択</CardTitle>
          <CardDescription>
            ファイルをアップロードするか、カメラで撮影してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="h-6 w-6" />
              <span>ファイルから選択</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => setShowCamera(true)}
            >
              <Camera className="h-6 w-6" />
              <span>カメラで撮影</span>
            </Button>
          </div>
          
          {/* 隠しファイル入力 */}
          <input
            id="file-input"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* アップロード画像プレビューと処理 */}
      {(file || preview) && (
        <Card>
          <CardHeader>
            <CardTitle>アップロード画像</CardTitle>
            <CardDescription>
              画像を確認してレシートを読み取ってください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {preview && (
                <div className="flex justify-center">
                  <NextImage
                    src={preview}
                    alt="アップロード画像"
                    width={400}
                    height={300}
                    className="rounded-lg border"
                    style={{ objectFit: 'contain', maxHeight: '400px' }}
                  />
                </div>
              )}

              <div className="flex gap-2">
                {file && !ocrResult && (
                  <div className="flex-1">
                    <Button 
                      onClick={handleOCR} 
                      disabled={loading}
                      className="w-full mb-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          画像を解析中...
                        </>
                      ) : (
                        'レシートを読み取る'
                      )}
                    </Button>
                    {loading && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
                    setOcrResult(null)
                    setSelectedItems(new Set())
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  画像を削除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* エラー表示 */}
      {error && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* OCR結果表示 */}
      {ocrResult && (
        <Card>
          <CardHeader>
            <CardTitle>読み取り結果</CardTitle>
            <CardDescription>
              保存したい食材を選択してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ocrResult.items.length === 0 ? (
                <p className="text-muted-foreground">食材が見つかりませんでした</p>
              ) : (
                <>
                  <div className="grid gap-2 max-h-96 overflow-y-auto">
                    {ocrResult.items.map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-100 ${
                          selectedItems.has(index) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'
                        }`}
                        onClick={() => toggleItemSelection(index)}
                      >
                        <div className="flex-shrink-0">
                          {selectedItems.has(index) ? (
                            <Check className="h-5 w-5 text-blue-600" />
                          ) : (
                            <div className="h-5 w-5 border rounded border-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.category} 
                            {item.price && ` • ¥${item.price.toLocaleString()}`}
                            {item.quantity && item.quantity > 1 && ` • 数量: ${item.quantity}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSaveItems}
                      disabled={loading || selectedItems.size === 0}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        `選択した${selectedItems.size}個の食材を保存`
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setFile(null)
                        setPreview(null)
                        setOcrResult(null)
                        setSelectedItems(new Set())
                      }}
                    >
                      リセット
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}