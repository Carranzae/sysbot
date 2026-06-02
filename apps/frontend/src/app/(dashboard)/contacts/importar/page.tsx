'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { UploadCloud, FileSpreadsheet, Info, CheckCircle2, AlertTriangle, XCircle, Loader2, ArrowLeft, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { contactsApi } from '@/lib/api'
import { useBusinessStore } from '@/store/business'

interface ParsedContact {
  name: string
  phone: string
  email?: string
  tags: string[]
  source?: string
  notes?: string
}

const SAMPLE_TEMPLATE = `name,phone,email,tags,source\nAna Pérez,+56911111111,ana@somo.cl,VIP|Clientes activos,CRM\nCarlos Díaz,+56922222222,,Potenciales|Campaña 2025,FACEBOOK`.
  replace(/\n/g, '\n')

const REQUIRED_COLUMNS = ['name', 'phone']

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

function detectDelimiter(content: string): string {
  if (content.includes(',') && content.includes(';')) {
    // pick the one that appears more often
    const commaCount = (content.match(/,/g) || []).length
    const semicolonCount = (content.match(/;/g) || []).length
    return commaCount >= semicolonCount ? ',' : ';'
  }
  if (content.includes(';') && !content.includes(',')) return ';'
  return ','
}

export default function ImportContactsPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [fileName, setFileName] = useState<string>('')
  const [rawPaste, setRawPaste] = useState<string>('')
  const [rows, setRows] = useState<ParsedContact[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const summary = useMemo(() => {
    const totalTags = rows.reduce((acc, row) => acc + row.tags.length, 0)
    const withEmail = rows.filter((row) => row.email).length
    return { total: rows.length, totalTags, withEmail }
  }, [rows])

  const previewRows = rows.slice(0, 5)
  const missingBusiness = !selectedBusiness

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      if (!text.trim()) {
        setRows([])
        setErrors(['El archivo está vacío.'])
        return
      }
      analyzeText(text)
    }
    reader.onerror = () => {
      toast({
        title: 'Error al leer el archivo',
        description: 'Revisa el formato o intenta nuevamente.',
        variant: 'destructive',
      })
    }
    reader.readAsText(file, 'utf-8')
  }

  const analyzeText = (content: string) => {
    setIsAnalyzing(true)
    try {
      const delimiter = detectDelimiter(content)
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      if (!lines.length) {
        setRows([])
        setErrors(['El archivo no contiene filas válidas.'])
        return
      }

      const headers = parseCsvLine(lines[0], delimiter).map((header) => header.toLowerCase())

      const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column))
      if (missingColumns.length) {
        setRows([])
        setErrors([`Faltan columnas requeridas: ${missingColumns.join(', ')}`])
        return
      }

      const parsedContacts: ParsedContact[] = []
      const detectedErrors: string[] = []

      lines.slice(1).forEach((line, index) => {
        const values = parseCsvLine(line, delimiter)
        if (!values.some((value) => value.trim().length > 0)) return

        const payload: Record<string, string> = {}
        headers.forEach((header, headerIndex) => {
          payload[header] = values[headerIndex]?.trim() ?? ''
        })

        if (!payload.name || !payload.phone) {
          detectedErrors.push(`Fila ${index + 2}: falta nombre o teléfono.`)
          return
        }

        const rawSource = (payload.source || '').trim().toUpperCase()
        const normalizedSource = ['WHATSAPP', 'MANUAL', 'OTHER'].includes(rawSource) ? rawSource : 'WHATSAPP'

        parsedContacts.push({
          name: payload.name,
          phone: payload.phone,
          email: payload.email || undefined,
          tags: payload.tags ? payload.tags.split('|').map((tag) => tag.trim()).filter(Boolean) : [],
          source: normalizedSource,
          notes: payload.notes || undefined,
        })
      })

      setRows(parsedContacts)
      setErrors(detectedErrors)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handlePasteAnalyze = () => {
    if (!rawPaste.trim()) {
      toast({
        title: 'Pega contenido CSV',
        description: 'Agrega texto con formato CSV para analizarlo.',
        variant: 'destructive',
      })
      return
    }
    analyzeText(rawPaste)
    setFileName('')
  }

  const handleImport = async () => {
    if (missingBusiness) {
      toast({
        title: 'Selecciona un negocio',
        description: 'Necesitas elegir un negocio para asociar los contactos.',
        variant: 'destructive',
      })
      return
    }

    if (!rows.length) {
      toast({
        title: 'Nada para importar',
        description: 'Carga o pega un archivo CSV antes de continuar.',
        variant: 'destructive',
      })
      return
    }

    setIsImporting(true)
    let imported = 0

    try {
      for (const contact of rows) {
        const normalizedSource = ['WHATSAPP', 'MANUAL', 'OTHER'].includes(contact.source || '')
          ? (contact.source as 'WHATSAPP' | 'MANUAL' | 'OTHER')
          : 'MANUAL'

        await contactsApi.create(selectedBusiness!.id, {
          name: contact.name,
          phone: contact.phone,
          email: contact.email || undefined,
          source: normalizedSource,
          tags: contact.tags,
        })
        imported += 1
      }

      toast({
        title: 'Importación completa',
        description: `Se importaron ${imported} contacto(s) correctamente.`,
      })

      setRows([])
      setRawPaste('')
      setFileName('')
    } catch (error) {
      console.error('Error importing contacts', error)
      toast({
        title: 'Error al importar',
        description: 'Revisa los datos o intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleTemplateDownload = () => {
    const blob = new Blob(['\ufeff', SAMPLE_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'plantilla-contactos.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Importa contactos masivamente sin salir del panel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" asChild className="gap-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Volver al dashboard
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleTemplateDownload}>
            <Download className="h-4 w-4" />
            Descargar plantilla
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UploadCloud className="h-5 w-5" />
                Carga un archivo CSV / Excel
              </CardTitle>
              <CardDescription>El archivo debe incluir al menos nombre y teléfono. Puedes añadir columnas extras como email, tags o source.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-center">
                <input id="contact-file" type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleFileChange} />
                <Label htmlFor="contact-file" className="flex cursor-pointer flex-col items-center gap-2 text-sm text-muted-foreground">
                  <UploadCloud className="h-10 w-10 text-primary" />
                  <span className="font-semibold text-primary">Click para elegir archivo</span>
                  <span>o arrastra y suelta tu CSV aquí</span>
                  {fileName && <span className="text-xs text-muted-foreground/80">Archivo seleccionado: {fileName}</span>}
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-text">¿Prefieres pegar el contenido?</Label>
                <Textarea
                  id="csv-text"
                  value={rawPaste}
                  onChange={(event) => setRawPaste(event.target.value)}
                  placeholder="name,phone,email,tags\nAna,+56911111111,ana@somo.cl,VIP"
                  className="min-h-[140px]"
                />
                <Button variant="secondary" className="gap-2" onClick={handlePasteAnalyze} disabled={isAnalyzing}>
                  {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Analizar texto pegado
                </Button>
              </div>

              <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <Info className="h-4 w-4 text-primary" />
                  Formato recomendado
                </p>
                <ul className="mt-2 list-disc pl-6">
                  <li>Separador: coma (,) o punto y coma (;).</li>
                  <li>Tags múltiples se separan con <strong>|</strong> (ej: VIP|Leads 2025).</li>
                  <li>Columnas opcionales: email, tags, source, notes.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen de la carga</CardTitle>
              <CardDescription>Verifica la información antes de importarla definitivamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Contactos detectados</p>
                  <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Contactos con email</p>
                  <p className="mt-1 text-2xl font-semibold">{summary.withEmail}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Tags totales</p>
                  <p className="mt-1 text-2xl font-semibold">{summary.totalTags}</p>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" /> Problemas detectados
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {errors.slice(0, 4).map((error) => (
                      <li key={error}>• {error}</li>
                    ))}
                    {errors.length > 4 && <li>… y {errors.length - 4} más</li>}
                  </ul>
                </div>
              )}

              {previewRows.length ? (
                <div className="overflow-hidden rounded-2xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2">Teléfono</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr key={`${row.phone}-${index}`} className="border-t">
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.phone}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.email || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.tags.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > previewRows.length && (
                    <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
                      Mostrando {previewRows.length} de {rows.length} contactos.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aún no hay contactos analizados. Carga un CSV o pega datos para ver la vista previa.
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={handleImport}
                disabled={isImporting || !rows.length || missingBusiness}
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Importar contactos en {selectedBusiness?.name ?? 'tu negocio'}
              </Button>
              {missingBusiness && (
                <p className="text-center text-xs text-muted-foreground">Selecciona o crea un negocio antes de importar.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>¿Qué pasa después de importar?</CardTitle>
              <CardDescription>Así sincronizamos los datos dentro del CRM de SYST.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-3">
                <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-500" />
                <div>
                  <p className="font-semibold text-foreground">Validación automática</p>
                  <p>Verificamos que cada teléfono tenga un formato correcto y removemos duplicados.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-3">
                <FileSpreadsheet className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Asignación de etiquetas</p>
                  <p>Los tags se convierten en etiquetas dentro del CRM para segmentar campañas rápidamente.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-3">
                <Info className="mt-1 h-4 w-4 text-sky-500" />
                <div>
                  <p className="font-semibold text-foreground">Historial conectado</p>
                  <p>Si ya existía el contacto, actualizamos sus campos sin perder conversaciones previas.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plantilla de ejemplo</CardTitle>
              <CardDescription>Usa este formato como punto de partida.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={SAMPLE_TEMPLATE.replace(/\\n/g, '\n')} readOnly className="min-h-[140px] font-mono text-xs" />
              <p className="text-xs text-muted-foreground">
                Puedes abrir el CSV en Excel o Google Sheets. Asegúrate de exportar nuevamente como CSV (UTF-8) antes de subirlo.
              </p>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Estado de la importación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contactos listos</span>
                  <span className="font-semibold text-foreground">{rows.length}</span>
                </div>
                {errors.length > 0 ? (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" /> {errors.length} filas requieren revisión.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Todo listo para importar.
                  </div>
                )}
                {!rows.length && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-4 w-4" /> Aún no hay datos cargados.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
