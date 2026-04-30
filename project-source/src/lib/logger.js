import { DEBUG_CONSOLE } from './config.js';

const MAX_LOGS = 500;
const STYLES = {
  debug:   { color: '#6b7280', icon: '🔍', label: 'DEBUG  ' },
  info:    { color: '#3b82f6', icon: 'ℹ️ ', label: 'INFO   ' },
  api:     { color: '#a855f7', icon: '🌐', label: 'API    ' },
  success: { color: '#10b981', icon: '✅', label: 'SUCCESS' },
  warn:    { color: '#f59e0b', icon: '⚠️ ', label: 'WARN   ' },
  error:   { color: '#ef4444', icon: '❌', label: 'ERROR  ' },
  auth:    { color: '#ec4899', icon: '🔐', label: 'AUTH   ' },
  db:      { color: '#14b8a6', icon: '🗄️ ', label: 'DB     ' },
};

class Logger {
  constructor() {
    this.logs = [];
    this.listeners = new Set();
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => this.error('Uncaught error', { message: e.message, filename: e.filename, lineno: e.lineno }));
      window.addEventListener('unhandledrejection', (e) => this.error('Unhandled promise rejection', { reason: String(e.reason) }));
      window.__logger = this;
      if (DEBUG_CONSOLE) {
        console.log(
          '%c🎙️ WEB RADIO COLLÈGE %c\n%cConsole de debug active. Tapez %c__logger.logs%c ou %c__logger.exportJSON()%c.',
          'font-size:18px;font-weight:bold;color:#3b82f6;background:#eef5ff;padding:4px 10px;border-radius:6px', '',
          'color:#64748b;font-size:12px',
          'color:#2563eb;font-family:monospace;background:#f1f5f9;padding:1px 4px;border-radius:3px',
          'color:#64748b;font-size:12px',
          'color:#2563eb;font-family:monospace;background:#f1f5f9;padding:1px 4px;border-radius:3px',
          'color:#64748b;font-size:12px'
        );
      }
    }
  }
  log(level, message, data) {
    const style = STYLES[level] || STYLES.info;
    const entry = { id: Date.now()+'-'+Math.random().toString(36).slice(2,7), level, timestamp: new Date().toISOString(), message, data: data !== undefined ? this._safe(data) : undefined };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) this.logs.shift();
    if (DEBUG_CONSOLE) {
      const time = entry.timestamp.split('T')[1].replace('Z','').slice(0,12);
      const args = [`%c${style.icon} ${style.label} %c${time}%c`, `color:${style.color};font-weight:600`, 'color:#94a3b8;font-family:monospace;font-size:11px', 'color:inherit', message];
      if (data !== undefined) args.push(data);
      console.log(...args);
    }
    this.listeners.forEach((fn) => { try { fn(entry, false, this.logs); } catch (e) {} });
    return entry;
  }
  debug(m,d){return this.log('debug',m,d);}
  info(m,d){return this.log('info',m,d);}
  api(m,d){return this.log('api',m,d);}
  success(m,d){return this.log('success',m,d);}
  warn(m,d){return this.log('warn',m,d);}
  error(m,d){return this.log('error',m,d);}
  auth(m,d){return this.log('auth',m,d);}
  db(m,d){return this.log('db',m,d);}
  group(title, fn){ if(!DEBUG_CONSOLE){fn();return;} console.groupCollapsed(`%c${title}`, 'color:#3b82f6;font-weight:600'); try{fn();} finally{console.groupEnd();} }
  clear(){ this.logs=[]; if(DEBUG_CONSOLE) console.clear(); }
  subscribe(fn){ this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _safe(d){ try { return JSON.parse(JSON.stringify(d, (k,v) => { if(v instanceof Error) return {name:v.name,message:v.message,stack:v.stack}; if(typeof v==='function') return '[Function]'; return v; })); } catch(e) { return String(d); } }
  exportJSON(){ const blob=new Blob([JSON.stringify(this.logs,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`webradio-logs-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); }
}
export const logger = new Logger();
