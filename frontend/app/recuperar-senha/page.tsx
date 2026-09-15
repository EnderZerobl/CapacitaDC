import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LayoutGrid, ArrowLeft, Info } from "lucide-react"

export default function RecuperarSenhaPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <LayoutGrid className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Gestão Comercial</h1>
            <p className="text-sm text-muted-foreground">Sistema de gestão de conteúdos</p>
          </div>
        </div>
        <Card className="bg-card border-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-foreground">Recuperar senha</CardTitle>
            <CardDescription>A recuperação de senha por email ainda está indisponível.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Entre em contato com a administração da plataforma para receber ajuda com seu acesso.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        <div className="text-center">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />Voltar para o login
          </Link>
        </div>
      </div>
    </main>
  )
}
