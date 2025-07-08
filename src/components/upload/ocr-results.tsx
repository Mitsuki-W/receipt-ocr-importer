import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { OCRResult } from '@/types/upload'

interface OCRResultsProps {
  ocrResult: OCRResult
  selectedItems: Set<number>
  loading: boolean
  onToggleItemSelection: (index: number) => void
  onSaveItems: () => void
  onReset: () => void
}

export default function OCRResults({
  ocrResult,
  selectedItems,
  loading,
  onToggleItemSelection,
  onSaveItems,
  onReset
}: OCRResultsProps) {
  const getCurrencySymbol = (currency: string | undefined): string => {
    if (currency === 'JPY') return '¥'
    if (currency === 'USD') return '$'
    return currency || '$'
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-slate-800 flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-violet-600 rounded-md flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          読み取り結果
        </CardTitle>
        <CardDescription className="text-slate-600">
          保存したい食材を選択してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {ocrResult.items.length === 0 ? (
            <p className="text-muted-foreground">食材が見つかりませんでした</p>
          ) : (
            <>
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {ocrResult.items.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-sm ${
                      selectedItems.has(index) 
                        ? 'bg-gradient-to-r from-teal-50 to-teal-100/50 border-teal-200 shadow-sm' 
                        : 'bg-white/60 border-slate-200 hover:bg-white/80 hover:border-slate-300'
                    }`}
                    onClick={() => onToggleItemSelection(index)}
                  >
                    <div className="flex-shrink-0">
                      {selectedItems.has(index) ? (
                        <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-slate-300 rounded-full hover:border-teal-400 transition-colors duration-200" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-sm text-slate-600">
                        {item.category} 
                        {item.price && ` • ${getCurrencySymbol(item.currency)}${item.price.toLocaleString('en-CA')}`}
                        {item.quantity && item.quantity > 1 && ` • 数量: ${item.quantity}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-200/60">
                <Button
                  onClick={onSaveItems}
                  disabled={loading || selectedItems.size === 0}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200"
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
                  onClick={onReset}
                  className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-medium transition-all duration-200"
                >
                  リセット
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}