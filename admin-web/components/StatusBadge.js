const labels={ONLINE:'Online',OFFLINE:'Offline',ALERT:'Em alerta',MAINTENANCE:'Manutenção',DISABLED:'Desativada',ACTIVE:'Ativo',INACTIVE:'Inativo'};
export default function StatusBadge({status}){return <span className={`status-badge ${(status||'OFFLINE').toLowerCase()}`}><i/>{labels[status]||status}</span>}
