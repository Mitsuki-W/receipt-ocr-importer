import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { UploadHookReturn, OCRResult, ExtractedItem } from '@/types/upload'
import { ProductCategorizer } from '@/lib/ocr/product-categorizer'

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
    console.log('📁 ファイル処理開始:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      lastModified: new Date(selectedFile.lastModified).toISOString()
    })
    
    setFile(selectedFile)
    setError('')
    setOcrResult(null)
    setShowCamera(false)
    
    // プレビュー画像を作成
    const reader = new FileReader()
    reader.onload = (e) => {
      console.log('🖼️ プレビュー画像作成完了')
      setPreview(e.target?.result as string)
    }
    reader.onerror = (e) => {
      console.error('❌ プレビュー画像作成エラー:', e)
      setError('画像の読み込みに失敗しました')
    }
    reader.readAsDataURL(selectedFile)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📂 ファイル選択イベント発生:', {
      filesLength: e.target.files?.length || 0,
      inputValue: e.target.value
    })
    
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      console.log('✅ ファイル選択成功 - 処理開始')
      // 前の状態をクリア
      setError('')
      setOcrResult(null)
      setProgress(0)
      
      processFile(selectedFile)
    } else {
      console.log('❌ ファイルが選択されていません')
    }
    
    // ファイル選択後、同じファイルでも再選択できるようにinputをリセット
    e.target.value = ''
    console.log('🔄 File input value リセット完了')
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
    if (!file) {
      console.log('❌ OCR処理開始失敗: ファイルなし')
      return
    }

    console.log('🚀 OCR処理開始:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    })

    setLoading(true)
    setError('')
    setProgress(0)

    let progressInterval: NodeJS.Timeout | null = null

    try {
      // プログレス表示の更新
      progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 8, 85)
          console.log(`⏳ OCR進捗: ${newProgress}%`)
          return newProgress
        })
      }, 300)

      // 画像圧縮をクライアントサイドで実行
      console.log('🔄 画像圧縮開始')
      const compressedFile = await compressImage(file)
      console.log('✅ 画像圧縮完了:', {
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio: ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%'
      })
      
      const formData = new FormData()
      formData.append('image', compressedFile)

      console.log('📡 OCR API 呼び出し開始')
      
      // タイムアウト付きでfetch実行
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log('⏰ OCR API タイムアウト (30秒)')
        controller.abort()
      }, 30000) // 30秒タイムアウト

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      
      setProgress(95)

      console.log('📡 OCR API レスポンス受信:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ OCR API エラーレスポンス:', errorText)
        throw new Error(`OCR処理に失敗しました (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ OCR結果受信:', {
        success: result.success,
        itemsCount: result.items?.length || 0,
        extractedTextLength: result.extractedText?.length || 0,
        metadata: result.metadata
      })

      if (!result.success) {
        throw new Error(result.error || 'OCR処理に失敗しました')
      }

      setProgress(100)
      setOcrResult(result)
      
      // 全ての項目をデフォルトで選択
      const selectedIndices = new Set(result.items.map((_: ExtractedItem, index: number) => index))
      setSelectedItems(selectedIndices)
      
      console.log('🎉 OCR処理完了:', {
        detectedItems: result.items.length,
        selectedItems: selectedIndices.size
      })

    } catch (error: unknown) {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      
      console.error('❌ OCR処理エラー:', error)
      
      let errorMessage = 'エラーが発生しました'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'OCR処理がタイムアウトしました。ファイルサイズを小さくして再試行してください。'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
        } else {
          errorMessage = error.message
        }
      }
      
      setError(errorMessage)
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      setLoading(false)
      setProgress(0)
      console.log('🏁 OCR処理終了')
    }
  }, [file, compressImage])

  const resetUpload = useCallback(() => {
    console.log('🔄 アップロードリセット開始')
    
    setFile(null)
    setPreview(null)
    setOcrResult(null)
    setSelectedItems(new Set())
    setError('')
    setProgress(0)
    
    // HTMLファイル入力もリセット
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (fileInput) {
      const previousValue = fileInput.value
      fileInput.value = ''
      console.log('📁 File input リセット:', { previousValue, newValue: fileInput.value })
    } else {
      console.warn('⚠️ File input要素が見つかりません')
    }
    
    console.log('✅ アップロードリセット完了')
  }, [])

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
          category: item.category || ProductCategorizer.categorize(item.name),
          quantity: item.quantity || 1,
          unit: '個',
          purchase_date: new Date().toISOString().split('T')[0],
          notes: item.price ? `価格: ${item.currency === 'USD' ? '$' : '¥'}${item.price}` : null,
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