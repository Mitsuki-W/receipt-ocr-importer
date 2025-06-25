'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { Upload, Loader2, Check, X } from 'lucide-react'
import Image from 'next/image'

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
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError('')
      setOcrResult(null)
      
      // プレビュー画像を作成
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleOCR = async () => {
    if (!file) return

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'OCR処理に失敗しました')
      }

      setOcrResult(result)
      // 全ての項目をデフォルトで選択
      setSelectedItems(new Set(result.items.map((_: any, index: number) => index)))

    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
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
      
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">レシートアップロード</h2>
        <p className="text-muted-foreground">
          レシートの写真から自動で食材を読み取ります
        </p>
      </div>

      {/* ファイルアップロード */}
      <Card>
        <CardHeader>
          <CardTitle>レシート画像をアップロード</CardTitle>
          <CardDescription>
            JPEGまたはPNG形式の画像をアップロードしてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">クリックしてアップロード</span>
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG (最大 10MB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {preview && (
              <div className="mt-4">
                <Image
                  src={preview}
                  alt="アップロード画像"
                  width={300}
                  height={400}
                  className="rounded-lg border"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            )}

            {file && !ocrResult && (
              <Button 
                onClick={handleOCR} 
                disabled={loading}
                className="w-full"
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
            )}
          </div>
        </CardContent>
      </Card>

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
                  <div className="grid gap-2">
                    {ocrResult.items.map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer ${
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
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.category} 
                            {item.price && ` • ¥${item.price}`}
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