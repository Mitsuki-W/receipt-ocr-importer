import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { UploadHookReturn, OCRResult, ExtractedItem } from '@/types/upload'

export function useUpload(): UploadHookReturn {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [showCamera, setShowCamera] = useState(false)

  const processFile = useCallback((selectedFile: File) => {
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
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }, [processFile])

  // クライアントサイド画像圧縮
  const compressImage = useCallback(async (file: File): Promise<File> => {
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
  }, [])

  const processOCR = useCallback(async () => {
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
  }, [file, compressImage])

  const toggleItemSelection = useCallback((index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }, [selectedItems])

  const saveSelectedItems = useCallback(async () => {
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
      resetUpload()
      
      alert(`${itemsToSave.length}個の食材を保存しました！`)
      
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [ocrResult, user, selectedItems, resetUpload])

  const resetUpload = useCallback(() => {
    setFile(null)
    setPreview(null)
    setOcrResult(null)
    setSelectedItems(new Set())
    setError('')
    setProgress(0)
  }, [])

  return {
    file,
    preview,
    loading,
    ocrResult,
    error,
    progress,
    selectedItems,
    showCamera,
    handleFileChange,
    processFile,
    processOCR,
    saveSelectedItems,
    toggleItemSelection,
    setShowCamera,
    setError,
    resetUpload,
  }
}