import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
        <p className="text-muted-foreground">
          レシートから食材を管理しましょう
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>レシートアップロード</CardTitle>
            <CardDescription>
              レシート画像をアップロードして食材を自動登録
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/upload">
              <Button className="w-full">アップロード開始</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>食材管理</CardTitle>
            <CardDescription>
              登録済みの食材を確認・編集
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/items">
              <Button variant="outline" className="w-full">食材一覧</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>履歴</CardTitle>
            <CardDescription>
              過去のレシート登録履歴を確認
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/history">
              <Button variant="outline" className="w-full">履歴確認</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}