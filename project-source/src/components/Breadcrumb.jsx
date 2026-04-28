import { REPO } from '../lib/config.js';

export default function Breadcrumb({ path, onNavigate }) {
  const segments = path.split('/').filter(Boolean);
  const rootSegs = REPO.rootPath.split('/').filter(Boolean);
  const displaySegs = segments.slice(rootSegs.length);
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm flex-wrap">
      <button onClick={() => onNavigate(REPO.rootPath)} className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-500 font-medium">
        <i className="fas fa-house mr-1"></i>Accueil
      </button>
      {displaySegs.map((seg, i) => {
        const target = [...rootSegs, ...displaySegs.slice(0, i + 1)].join('/');
        const isLast = i === displaySegs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            <i className="fas fa-chevron-right text-xs text-slate-400"></i>
            <button onClick={() => !isLast && onNavigate(target)} disabled={isLast}
              className={'px-2 py-1 rounded ' + (isLast ? 'text-slate-700 dark:text-slate-200 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-500')}>
              {decodeURIComponent(seg)}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
