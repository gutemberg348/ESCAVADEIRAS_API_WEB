import { AlertTriangle,Inbox,LoaderCircle,RefreshCw } from 'lucide-react';
export function LoadingState({label='Carregando dados do servidor...'}){return <div className="state-card"><LoaderCircle className="spin" size={26}/><strong>Sincronizando</strong><p>{label}</p></div>}
export function ErrorState({message,onRetry}){return <div className="state-card error-state"><AlertTriangle size={27}/><strong>Não foi possível carregar</strong><p>{message}</p>{onRetry&&<button onClick={onRetry}><RefreshCw size={14}/> Tentar novamente</button>}</div>}
export function EmptyState({title='Nenhum resultado',description='Não existem dados para exibir neste momento.'}){return <div className="state-card"><Inbox size={27}/><strong>{title}</strong><p>{description}</p></div>}
