export default function FolderCard({ folder, onOpen }) {
  return (
    <button onClick={() => onOpen(folder.path)} className="media-card group text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3 hover:border-brand-400">
      <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl flex-shrink-0">
        <i className="fas fa-folder"></i>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">{folder.name}</div>
        <div className="text-xs text-slate-500">Cliquer pour explorer</div>
      </div>
      <i className="fas fa-arrow-right text-slate-400 group-hover:text-brand-500 transition"></i>
    </button>
  );
}
