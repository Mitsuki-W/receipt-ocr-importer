import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2 } from 'lucide-react'
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
  return (
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
                    onClick={() => onToggleItemSelection(index)}
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
                  onClick={onSaveItems}
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
                  onClick={onReset}
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