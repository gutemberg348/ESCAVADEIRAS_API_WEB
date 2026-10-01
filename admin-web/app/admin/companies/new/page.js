"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Save } from "lucide-react";
import { createCompany } from "../../../../services/machine.service";
import { session } from "../../../../services/api";

export default function NewCompanyPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setAllowed(session()?.user?.role === "SUPER_ADMIN"); }, []);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const created = await createCompany({ name: name.trim(), document: document.trim() || undefined });
      router.push(`/admin/companies/${created.id}`);
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return <div className="admin-page company-detail-page">
    <Link className="back-link" href="/admin/companies"><ArrowLeft size={16} /> Voltar para empresas</Link>
    <header className="page-header"><div><span className="eyebrow">NOVA ORGANIZAÇÃO</span><h1>Cadastrar empresa</h1><p>Depois do cadastro, você poderá adicionar escavadeiras, operadores e placas ESP32.</p></div></header>
    {!allowed ? <div className="surface-panel company-permission">Somente o administrador geral pode cadastrar empresas.</div> : <form className="surface-panel company-edit-panel" onSubmit={submit}>
      <div className="panel-header"><div><span className="eyebrow">IDENTIFICAÇÃO</span><h2>Dados da empresa</h2></div><Building2 size={21} /></div>
      <label><span>Nome da empresa *</span><input required minLength={2} maxLength={120} autoComplete="organization" placeholder="Ex.: Construtora Horizonte" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label><span>Documento (opcional)</span><input maxLength={30} placeholder="CNPJ ou identificador" value={document} onChange={(event) => setDocument(event.target.value)} /></label>
      {error && <p className="company-form-error" role="alert">{error}</p>}
      <div className="company-form-actions"><Link href="/admin/companies">Cancelar</Link><button disabled={saving}><Save size={17} /> {saving ? "Cadastrando..." : "Cadastrar empresa"}</button></div>
    </form>}
  </div>;
}
