import { useState, useEffect } from 'react';
import { isAdmin } from '../lib/config.js';
import { getAllComments, deleteComment } from '../lib/comments.js';

export default function AdminPanel({ open, onClose }) {
  const [allComments, setAllComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try { setAllComments(await getAllComments(500)); }
    catch (err) { alert('Erreur : ' + err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);
  if (!open) return null;

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try { await deleteComment(id); setAllComments((c) => c.filter((x) => x.id !== id)); }
    catch (err) { alert('Erreur : ' + err.message); }
  };

  const filtered = search ? allComments.filter((c) => (c.content + ' ' + c.user_email + ' ' + c.media_name).toLowerCase().includes(search.toLowerCase())) : allComments;
  const byMedia = {};
  filtered.forEach((c) => {
    if (!byMedia[c.media_id]) byMedia[c.media_id] = { media_name: c.media_name, comments: [] };
    byMedia[c.media_id].comments.push(c);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <i className="fas fa-user-shield text-amber-500" />
            Panneau d'administration
            <span className="text-sm font-normal text-slate-500">({allComments.length} commentaires)</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600" title="Rafraîchir">
              <i className={'fas fa-rotate ' + (loading ? 'fa-spin' : '')} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><i className="fas fa-xmark" /></button>
          </div>
        </div>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-10"><div className="spinner w-10 h-10 mx-auto" /></div>
          ) : Object.keys(byMedia).length === 0 ? (
            <div className="text-center py-10 text-slate-500"><i className="fas fa-inbox text-4xl mb-2 block opacity-30" />Aucun commentaire</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(byMedia).map(([mId, grp]) => (
                <section key={mId}>
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <i className="fas fa-file-audio mr-1 text-brand-500" />{grp.media_name}
                    <span className="ml-2 text-xs font-normal text-slate-500">{grp.comments.length} commentaire(s)</span>
                  </h3>
                  <ul className="space-y-2">
                    {grp.comments.map((c) => (
                      <li key={c.id} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className={'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + (isAdmin(c.user_email) ? 'bg-amber-500 text-white' : 'bg-brand-600 text-white')}>
                            {(c.user_name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap text-sm">
                              <span className="font-semibold">{c.user_name}</span>
                              <span className="text-xs text-slate-500">{c.user_email}</span>
                              {isAdmin(c.user_email) && <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                              <span className="text-xs text-slate-500">• {new Date(c.created_at).toLocaleString('fr-FR')}</span>
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.content}</p>
                          </div>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600" title="Supprimer">
                            <i className="fas fa-trash text-xs" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
