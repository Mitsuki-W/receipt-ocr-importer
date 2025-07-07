import { useState, useCallback, useRef } from 'react'
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
  
  // タイマー管理用のref
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)

  const processFile = useCallback((selectedFile: File) => {
    // ファイル形式の検証
    if (!selectedFile.type.startsWith('image/')) {
      setError('画像ファイル（JPEG、PNG、GIF、WebP）のみサポートされています。')
      return
    }
    
    setFile(selectedFile)
    setError('')
    setOcrResult(null)
    setShowCamera(false)
    
    // プレビュー画像を作成
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.onerror = () => {
      setError('画像の読み込みに失敗しました')
    }
    reader.readAsDataURL(selectedFile)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // 前の状態をクリア
      setError('')
      setOcrResult(null)
      setProgress(0)
      
      processFile(selectedFile)
    }
    
    // ファイル選択後、同じファイルでも再選択できるようにinputをリセット
    e.target.value = ''
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
      setError('ファイルが見つかりません。画像を選択してから処理を開始してください。')
      return
    }

    // ファイルの有効性チェック
    if (file.size === 0) {
      setError('ファイルが空またはアクセスできません。別の画像を選択してください。')
      return
    }

    setLoading(true)
    setError('')
    setProgress(0)

    try {
      // 既存のタイマーをクリア
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }

      // プログレス表示の更新
      progressIntervalRef.current = setInterval(() => {
        setProgress(prev => Math.min(prev + 8, 85))
      }, 300)

      // 画像圧縮をクライアントサイドで実行（タイムアウト付き）
      const compressedFile = await Promise.race([
        compressImage(file),
        new Promise<File>((_, reject) => {
          setTimeout(() => {
            reject(new Error('画像圧縮がタイムアウトしました（10秒）'))
          }, 10000) // 10秒でタイムアウト
        })
      ])
      
      const formData = new FormData()
      formData.append('image', compressedFile)

      // タイムアウト付きでfetch実行
      const controller = new AbortController()
      timeoutIdRef.current = setTimeout(() => {
        controller.abort()
        
        // 強制的にエラー状態に移行
        setTimeout(() => {
          setError('OCR処理がタイムアウトしました（30秒）。ファイルサイズを小さくして再試行してください。')
          setLoading(false)
          setProgress(0)
        }, 1000) // 1秒後に強制実行
      }, 30000) // 30秒でタイムアウト

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })

      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      
      setProgress(95)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OCR処理に失敗しました (${response.status}): ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'OCR処理に失敗しました')
      }

      setProgress(100)
      setOcrResult(result)
      
      // 全ての項目をデフォルトで選択
      const selectedIndices = new Set(result.items.map((_: ExtractedItem, index: number) => index))
      setSelectedItems(selectedIndices)

    } catch (error: unknown) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      
      let errorMessage = 'エラーが発生しました'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          errorMessage = 'OCR処理がタイムアウトしました（30秒）。ファイルサイズを小さくして再試行してください。'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
        } else if (error.message.includes('画像圧縮がタイムアウト')) {
          errorMessage = '画像ファイルが大きすぎて処理できません。より小さなファイルを選択してください。'
        } else {
          errorMessage = error.message
        }
      }
      
      setError(errorMessage)
    } finally {
      // すべてのタイマーをクリア
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
      setLoading(false)
      setProgress(0)
    }
  }, [file, compressImage])

  const resetUpload = useCallback(() => {
    // すべてのタイマーを停止
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
    
    // loadingとprogressを確実にリセット
    setLoading(false)
    setProgress(0)
    setFile(null)
    setPreview(null)
    setOcrResult(null)
    setSelectedItems(new Set())
    setError('')
    
    // HTMLファイル入力もリセット
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
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
          price: item.price || null,
          currency: item.currency || null,
          notes: null,
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