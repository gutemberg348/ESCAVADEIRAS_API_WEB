"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Cpu, Gauge, Plus, Save, Trash2, UsersRound } from "lucide-react";
import ArchiveCompanyDialog from "../../../../components/ArchiveCompanyDialog";
import StatusBadge from "../../../../components/StatusBadge";
import { ErrorState, LoadingState } from "../../../../components/States";
import { company as loadCompany, deleteCompany, updateCompany } from "../../../../services/machine.service";
import { session } from "../../../../services/api";

export default function CompanyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await loadCompany(id);
      setItem(result); setName(result.name); setDocument(result.document || "");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { setIsSuperAdmin(session()?.user?.role === "SUPER_ADMIN"); load(); }, [load]);

  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const result = await updateCompany(id, { name: name.trim(), document: document.trim() || null });
      setItem((current) => ({ ...current, ...result }));
      setSuccess("Dados da empresa atualizados.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function archive() {
    await deleteCompany(id);
    router.replace("/admin/companies");
    router.refresh();
  }

  if (loading) return <div className="admin-page"><LoadingState label="Carregando empresa..." /></div>;
  return <div className="admin-page company-detail-page">
    <Link className="back-link" href="/admin/companies"><ArrowLeft size={16} /> Voltar para empresas</Link>
    {error && !item ? <ErrorState message={error} onRetry={load} /> : item && <>
      <header className="page-header"><div><span className="eyebrow">EMPRESA · CENTRO DE OPERAÇÕES</span><h1>{item.name}</h1><p>{item.document || "Documento não informado"} · Cadastro e recursos vinculados à organização.</p></div><StatusBadge status={item.active ? "ONLINE" : "OFFLINE"} /></header>
      {error && <p className="company-form-error" role="alert">{error}</p>}
      {success && <p className="company-form-success" role="status">{success}</p>}
      <section className="company-detail-summary"><div><Building2 size={20} /><span>Empresa</span><strong>{item.active ? "Ativa" : "Inativa"}</strong></div><div><Gauge size={20} /><span>Escavadeiras</span><strong>{item._count?.machines || 0}</strong></div><div><UsersRound size={20} /><span>Usuários ativos</span><strong>{item._count?.users || 0}</strong></div></section>
      <div className="company-detail-grid">
        <section className="surface-panel company-resource-panel"><div className="panel-header"><div><span className="eyebrow">FROTA</span><h2>Escavadeiras desta empresa</h2></div><Gauge size={19} /></div>
          {item.machines?.length ? <div className="company-resource-list">{item.machines.map((machine) => <Link href={`/admin/machines/${machine.id}`} key={machine.id}><span><strong>{machine.code}</strong><small>{machine.name} · {machine.device?.deviceCode || "Sem ESP32"}</small></span><StatusBadge status={machine.status} /></Link>)}</div> : <p className="company-empty">Nenhuma escavadeira ativa cadastrada.</p>}
          <Link className="company-resource-action" href="/admin/machines/new"><Plus size={16} /> Cadastrar escavadeira</Link>
        </section>
        <section className="surface-panel company-resource-panel"><div className="panel-header"><div><span className="eyebrow">ACESSOS</span><h2>Usuários ativos</h2></div><UsersRound size={19} /></div>
          {item.users?.length ? <div className="company-user-list">{item.users.map((user) => <div key={user.id}><span><strong>{user.name}</strong><small>{user.email}</small></span><em>{user.role === "DRIVER" ? "Motorista" : user.role === "COMPANY_ADMIN" ? "Admin da empresa" : "Admin geral"}</em></div>)}</div> : <p className="company-empty">Nenhum usuário ativo nesta empresa.</p>}
          <Link className="company-resource-action" href="/admin/drivers"><Cpu size={16} /> Gerenciar motoristas</Link>
        </section>
      </div>
      {isSuperAdmin && <section className="surface-panel company-edit-panel"><div className="panel-header"><div><span className="eyebrow">CADASTRO</span><h2>Editar dados da empresa</h2></div><Building2 size={19} /></div>
        <form onSubmit={save}><label><span>Nome da empresa *</span><input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Documento</span><input maxLength={30} value={document} onChange={(event) => setDocument(event.target.value)} /></label><button disabled={saving}><Save size={16} /> {saving ? "Salvando..." : "Salvar alterações"}</button></form>
      </section>}
      {isSuperAdmin && <section className="surface-panel company-danger-zone"><div><h2>Excluir empresa do painel</h2><p>Desativa acessos, cartões, escavadeiras e ESP32 vinculados; preserva telemetria e histórico.</p></div><button type="button" onClick={() => setShowArchive(true)}><Trash2 size={16} /> Excluir empresa</button></section>}
      <ArchiveCompanyDialog company={showArchive ? item : null} onClose={() => setShowArchive(false)} onConfirm={archive} />
    </>}
  </div>;
}
