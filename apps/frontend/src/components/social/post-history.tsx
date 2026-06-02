'use client';

import { useState, useEffect } from 'react';
import { 
  History, 
  Copy, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreVertical,
  Play,
  Video,
  ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { socialApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface PostHistoryProps {
  businessId: string;
  onReuse: (post: any) => void;
}

export function PostHistory({ businessId, onReuse }: PostHistoryProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      const res = await socialApi.getPosts(businessId);
      setPosts(res.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      fetchPosts();
    }
  }, [businessId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
      case 'SCHEDULED': return <Clock className="h-3 w-3 text-blue-500" />;
      case 'FAILED': return <AlertCircle className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-slate-400" />;
    }
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Historial de Envíos</h3>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={fetchPosts}>
          <MoreVertical className="h-4 w-4 text-slate-400" />
        </Button>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="p-10 text-center space-y-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando historial...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No hay envíos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {posts.map((post) => (
              <div key={post.id} className="p-4 hover:bg-slate-50/50 transition-colors group">
                <div className="flex gap-4">
                  <div className="h-16 w-12 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 relative">
                    {post.mediaUrl ? (
                      post.mediaType === 'video' ? (
                        <video src={post.mediaUrl} className="h-full w-full object-cover opacity-60" />
                      ) : (
                        <img src={post.mediaUrl} className="h-full w-full object-cover opacity-60" />
                      )
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Video className="h-4 w-4 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-4 w-4 text-white fill-current" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getStatusIcon(post.status)}
                        <span className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">
                          {post.caption || 'Sin título'}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: es })}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-1">
                        {post.targets?.map((t: any) => (
                          <Badge key={t.id} variant="outline" className="text-[8px] font-black px-1.5 py-0 rounded-md border-slate-100 bg-white">
                            {t.platform.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-3 rounded-lg text-primary hover:bg-primary/5 font-black text-[9px] uppercase tracking-widest gap-1.5"
                        onClick={() => onReuse(post)}
                      >
                        <Copy className="h-3 w-3" />
                        Reusar Copy
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 bg-slate-50/50 border-t border-slate-50">
        <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          Usa el botón &quot;Reusar Copy&quot; para cargar el texto y configuración en una nueva publicación.
        </p>
      </div>
    </div>
  );
}
