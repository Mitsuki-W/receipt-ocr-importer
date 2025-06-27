import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, X } from 'lucide-react'
import NextImage from 'next/image'
import { OCRResult } from '@/types/upload'

interface ImagePreviewProps {
  preview: string | null
  file: File | null
  loading: boolean
  progress: number
  ocrResult: OCRResult | null
  onProcessOCR: () => void
  onReset: () => void
}

export default function ImagePreview({
  preview,
  file,
  loading,
  progress,
  ocrResult,
  onProcessOCR,
  onReset
}: ImagePreviewProps) {
  if (!file && !preview) return null

  return (
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
                  onClick={onProcessOCR} 
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
              onClick={onReset}
            >
              <X className="mr-2 h-4 w-4" />
              画像を削除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}