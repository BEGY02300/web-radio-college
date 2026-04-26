import { useState, useEffect, useCallback } from 'react';
import { humanFileSize, mediaId } from '../lib/github-api.js';
import { isAdmin } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getCommentsForMedia, postComment, deleteComment } from '../lib/comments.js';

export default function FileCard({ file, user, expanded, onToggleExpand, onOpenAuth }) {
  const isAudio = file.mediaType === 'audio';
  const ext = file.name.split('.').pop().toLowerCase();
  const mId = mediaId(file);
  const [comments, setComments] = useState([]);
  const [loadingC, setLoadingC] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingC(true);
    try { setComments(await getCommentsForMedia(mId)); }
    catch (err) { logger.error('Commentaires', { err: err.message }); }
    finally { setLoadingC(false); }
  }, [mId]);

  useEffect(() => { if (expanded && comments.length === 0 && !loadingC) loadComments(); }, [expanded]); // eslint-disable-line

  const handlePost = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    setPosting(true);
    try { await postComment({ mediaId: mId, mediaName: file.name, user, content: newComment }); setNewComment(''); await loadComments(); }
    catch (err) { alert('Erreur : ' + err.message); }
    finally { setPosting(false); }
  };
  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try { await deleteComment(id); setComments((c) => c.filter((x) => x.id !== id)); }
    catch (err) { alert('Erreur : ' + err.message); }
  };

  return (
    <article className="media-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={'w-12 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ' +
            (isAudio ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                     : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400')}>
            <i className={'fas ' + (isAudio ? 'fa-podcast' : 'fa-film')} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate" title={file.name}>{file.name}</div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="uppercase font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{ext}</span>
              <span>{humanFileSize(file.size)}</span>
              <span>•</span>
              <span>{isAudio ? 'Podcast' : 'Reportage'}</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          {isAudio
            ? <audio src={file.downloadUrl} controls preload="metadata" className="w-full" />
            : <video src={file.downloadUrl} controls playsInline preload="metadata" className="w-full max-h-96 rounded-lg bg-black" />}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <a href={file.downloadUrl} download={file.name} rel="noopener noreferrer"
            onClick={() => logger.info('📥 Téléchargement', { file: file.name })}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white transition">
            <i className="fas fa-download" /> Télécharger
          </a>
          <button onClick={onToggleExpand} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
            <i className={'fas ' + (expanded ? 'fa-comment-slash' : 'fa-comments')} />
            {expanded ? 'Masquer les commentaires' : 'Commentaires'}
            {comments.length > 0 && <span className="bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">{comments.length}</span>}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 fade-in">
          {user ? (
            <form onSubmit={handlePost} className="mb-4 flex gap-2">
              <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {(user.displayName || user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 flex gap-2">
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Laissez un commentaire..." rows="2" maxLength="2000"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none" />
                <button type="submit" disabled={posting || !newComment.trim()} className="self-end px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap">
                  {posting ? <i className="fas fa-circle-notch fa-spin" /> : <><i className="fas fa-paper-plane mr-1" />Publier</>}
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Connectez-vous pour laisser un commentaire.</p>
              <button onClick={onOpenAuth} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
                <i className="fas fa-right-to-bracket mr-1" />Se connecter
              </button>
            </div>
          )}

          {loadingC ? (
            <div className="text-center text-slate-500 py-4"><div className="spinner w-6 h-6 mx-auto" /></div>
          ) : comments.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-4"><i className="fas fa-comment-dots text-2xl mb-2 block opacity-30" />Aucun commentaire. Soyez le premier !</div>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const canDelete = user && (isAdmin(user.email) || user.uid === c.user_uid);
                const cIsAdmin = isAdmin(c.user_email);
                return (
                  <li key={c.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className={'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + (cIsAdmin ? 'bg-amber-500 text-white' : 'bg-brand-600 text-white')}>
                        {(c.user_name || c.user_email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{c.user_name || c.user_email}</span>
                          {cIsAdmin && <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                          <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString('fr-FR')}</span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.content}</p>
                      </div>
                      {canDelete && (
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 flex-shrink-0" title="Supprimer">
                          <i className="fas fa-trash text-xs" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
