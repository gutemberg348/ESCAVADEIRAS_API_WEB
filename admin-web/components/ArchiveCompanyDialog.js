"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Trash2, X } from "lucide-react";

export default function ArchiveCompanyDialog({ company, onClose, onConfirm }) {
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setConfirmation(""); setError(""); }, [company?.id]);
  if (!company) return null;

  async function confirm(event) {
    event.preventDefault();
    if (confirmation.trim() !== company.name) return;
    setSaving(true);
    setError("");
    try { await onConfirm(company); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop company-archive-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className="surface-panel company-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="company-archive-title" onSubmit={confirm}>
      <button type="button" className="company-dialog-close" aria-label="Fechar" disabled={saving} onClick={onClose}><X size={19} /></button>
      <span className="company-archive-icon"><ShieldAlert size={24} /></span>
      <h2 id="company-archive-title">Excluir {company.name} do painel?</h2>
      <p>Esta ação arquiva a empresa. Para não deixar acessos ativos, também desativa seus usuários, cartões RFID, escavadeiras e credenciais dos ESP32. A telemetria e o histórico de auditoria permanecem salvos.</p>
      <div className="company-archive-impact"><span><b>{company._count?.users || 0}</b> usuários ativos</span><span><b>{company._count?.machines || 0}</b> escavadeiras ativas</span></div>
      <label><span>Digite <strong>{company.name}</strong> para confirmar</span><input autoFocus required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      {error && <p className="company-archive-error" role="alert">{error}</p>}
      <div className="company-archive-actions"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="danger" disabled={saving || confirmation.trim() !== company.name}><Trash2 size={16} /> {saving ? "Arquivando..." : "Excluir empresa"}</button></div>
    </form>
  </div>;
}
