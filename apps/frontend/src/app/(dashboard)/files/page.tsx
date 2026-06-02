'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { filesApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { FileText, Upload, Trash2, CheckCircle, Clock, AlertCircle, Building2, Edit, History, Image, Video, Music } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function FilesPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingFile, setEditingFile] = useState<any>(null)
  const [fileHistory, setFileHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const loadFiles = useCallback(async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      const response = await filesApi.getAll(selectedBusiness.id)
      setFiles(response.data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los archivos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness, toast])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedBusiness || !e.target.files?.[0]) return

    const file = e.target.files[0]

    // Validar tamaño según el rubro
    const maxSize = getMaxFileSizeForIndustry(selectedBusiness.industryType)
    if (file.size > maxSize) {
      toast({
        title: 'Archivo muy grande',
        description: `El archivo no debe superar los ${maxSize / (1024 * 1024)}MB para ${selectedBusiness.industryType}`,
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      if (editingFile) {
        await filesApi.update(editingFile.id, file, description || undefined, tags.length > 0 ? tags : undefined)
        toast({
          title: 'Archivo actualizado',
          description: 'El archivo se está procesando',
        })
        setEditingFile(null)
      } else {
        await filesApi.upload(selectedBusiness.id, file, description || undefined, tags.length > 0 ? tags : undefined)
        toast({
          title: 'Archivo subido',
          description: 'El archivo se está procesando',
        })
      }
      setDescription('')
      setTags([])
      loadFiles()
    } catch (error: any) {
      toast({
        title: 'Error al procesar archivo',
        description: error.response?.data?.message || 'No se pudo procesar el archivo',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleEditFile = (file: any) => {
    setEditingFile(file)
    setDescription(file.description || '')
    setTags(file.tags || [])
  }

  const handleViewHistory = async (fileId: string) => {
    try {
      const response = await filesApi.getHistory(fileId)
      setFileHistory(response.data)
      setShowHistory(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el historial',
        variant: 'destructive',
      })
    }
  }

  const getMaxFileSizeForIndustry = (industryType: string): number => {
    switch (industryType) {
      case 'REAL_ESTATE':
      case 'AUTOMOTIVE':
        return 50 * 1024 * 1024 // 50MB
      case 'ACADEMY':
        return 100 * 1024 * 1024 // 100MB
      default:
        return 10 * 1024 * 1024 // 10MB
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este archivo?')) return

    try {
      await filesApi.delete(id)
      toast({
        title: 'Archivo eliminado',
        description: 'El archivo se eliminó correctamente',
      })
      loadFiles()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el archivo',
        variant: 'destructive',
      })
    }
  }

  const getStatusIcon = (isProcessed: boolean) => {
    return isProcessed ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <Clock className="w-5 h-5 text-yellow-600 animate-spin" />
    )
  }

  const getFileTypeIcon = (fileType: string, mimeType: string) => {
    switch (fileType) {
      case 'IMAGE':
        return <Image className="w-5 h-5 text-purple-600" />
      case 'VIDEO':
        return <Video className="w-5 h-5 text-red-600" />
      case 'AUDIO':
        return <Music className="w-5 h-5 text-orange-600" />
      default:
        return <FileText className="w-5 h-5 text-slate-300" />
    }
  }

  const getFileTypeLabel = (fileType: string) => {
    switch (fileType) {
      case 'IMAGE':
        return 'Imagen'
      case 'VIDEO':
        return 'Video'
      case 'AUDIO':
        return 'Audio'
      case 'DOCUMENT':
        return 'Documento'
      default:
        return 'Archivo'
    }
  }

  const getStatusText = (isProcessed: boolean) => {
    return isProcessed ? 'Procesado' : 'Procesando...'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-slate-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">No hay negocio seleccionado</h2>
        <p className="text-slate-300 mb-6">Selecciona un negocio para gestionar archivos</p>
        <Link href="/businesses">
          <Button>Ir a Negocios</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Archivos de Conocimiento</h1>
          <p className="text-slate-300 mt-1">Sube documentos para entrenar al bot</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el archivo..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Tags (opcional)
              </label>
              <input
                type="text"
                value={tags.join(', ')}
                onChange={(e) => setTags(e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0))}
                placeholder="tag1, tag2, tag3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.avif,.mp4,.avi,.mov,.mp3,.wav,.ogg"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <Button asChild disabled={uploading}>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {editingFile ? 'Actualizar' : uploading ? 'Subiendo...' : 'Subir Archivo'}
                  </label>
                </Button>
                {editingFile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => {
                      setEditingFile(null)
                      setDescription('')
                      setTags([])
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
        <CardHeader>
          <CardTitle>Archivos Subidos</CardTitle>
          <CardDescription>
            Formatos soportados: Documentos (PDF, TXT, DOC, DOCX), Imágenes (JPG, PNG, GIF, WebP), Videos (MP4, AVI, MOV), Audio (MP3, WAV, OGG)
            <br />
            Tamaño máximo varía según el rubro del negocio (10MB-100MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Cargando archivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No hay archivos</h3>
              <p className="text-slate-300 mb-4">Sube tu primer archivo para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      <div className="flex-shrink-0 mt-1">
                        {getFileTypeIcon(file.fileType, file.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-medium text-white truncate">{file.originalName}</p>
                          <span className="text-xs bg-white/10 text-slate-300 px-2 py-1 rounded">
                            v{file.version}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                            {getFileTypeLabel(file.fileType)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-slate-500 mb-2">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{file.mimeType}</span>
                          {file._count?.knowledgeChunks > 0 && (
                            <>
                              <span>•</span>
                              <span>{file._count.knowledgeChunks} fragmentos</span>
                            </>
                          )}
                          {file._count?.fileVersions > 0 && (
                            <>
                              <span>•</span>
                              <span>{file._count.fileVersions} versiones previas</span>
                            </>
                          )}
                        </div>

                        {file.description && (
                          <p className="text-sm text-slate-300 mb-2">{file.description}</p>
                        )}

                        {file.tags && file.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {file.tags.map((tag: string, index: number) => (
                              <span
                                key={index}
                                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          {getStatusIcon(file.isProcessed)}
                          <span className="text-sm font-medium text-slate-200">
                            {getStatusText(file.isProcessed)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewHistory(file.id)}
                        title="Ver historial"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditFile(file)}
                        disabled={!file.isProcessed}
                        title="Actualizar archivo"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(file.id)}
                        disabled={!file.isProcessed}
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Consejos para mejores resultados</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Sube documentos, imágenes, videos y audio relevantes para tu negocio</li>
            <li>• Incluye descripciones y tags para mejor organización</li>
            <li>• Los archivos se procesan automáticamente según el rubro del negocio</li>
            <li>• Mantén un historial de versiones para seguimiento de cambios</li>
            <li>• Las imágenes se optimizan automáticamente con diferentes tamaños</li>
          </ul>
        </CardContent>
      </Card>

      {/* Modal de Historial */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Versiones</DialogTitle>
            <DialogDescription>
              Historial completo de cambios del archivo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {fileHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-300">No hay versiones anteriores</p>
              </div>
            ) : (
              fileHistory.map((version: any) => (
                <div
                  key={version.id}
                  className="p-4 border rounded-lg bg-white/5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">
                        Versión {version.version}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-slate-300 space-y-1">
                    <p><strong>Nombre:</strong> {version.originalName}</p>
                    <p><strong>Tipo:</strong> {version.mimeType}</p>
                    <p><strong>Tamaño:</strong> {formatFileSize(version.size)}</p>
                    {version.description && (
                      <p><strong>Descripción:</strong> {version.description}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
