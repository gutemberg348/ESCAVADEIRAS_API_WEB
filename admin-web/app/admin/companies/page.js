"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Gauge, Plus, Search, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import ArchiveCompanyDialog from "../../../components/ArchiveCompanyDialog";
import { EmptyState, ErrorState, LoadingState } from "../../../components/States";
import { deleteCompany, fleetCompanies } from "../../../services/machine.service";
import { session } from "../../../services/api";

export default function CompaniesPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await fleetCompanies()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { setIsSuperAdmin(session()?.user?.role === "SUPER_ADMIN"); load(); }, [load]);
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.document || ""}`.toLowerCase().includes(search.toLowerCase())), [items, search]);

  async function archive(item) {
    await deleteCompany(item.id);
    await load();
  }

  if (loading) return <div className="admin-page"><LoadingState label="Carregando empresas..." /></div>;
  return <div className="admin-page companies-page">
    <PageHeader eyebrow="GESTÃO MULTIEMPRESA" title={isSuperAdmin ? "Empresas" : "Minha empresa"} description="Abra uma empresa para ver seus equipamentos e usuários, atualizar o cadastro ou gerenciar seu acesso." action={isSuperAdmin ? "Nova empresa" : undefined} href="/admin/companies/new" icon={Plus} />
    {error && <ErrorState message={error} onRetry={load} />}
    {!error && <>
      <section className="company-overview">
        <div><Building2 size={20} /><p><span>EMPRESAS</span><strong>{items.length}</strong></p></div>
        <div><Gauge size={20} /><p><span>ESCAVADEIRAS</span><strong>{items.reduce((sum, item) => sum + (item._count?.machines || 0), 0)}</strong></p></div>
        <div><UsersRound size={20} /><p><span>USUÁRIOS ATIVOS</span><strong>{items.reduce((sum, item) => sum + (item._count?.users || 0), 0)}</strong></p></div>
        <div><ShieldCheck size={20} /><p><span>EMPRESAS ATIVAS</span><strong>{items.filter((item) => item.active).length}</strong></p></div>
      </section>
      <label className="company-search"><Search size={18} /><input aria-label="Buscar empresa" placeholder="Buscar empresa por nome ou documento" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {filtered.length ? <section className="company-grid">{filtered.map((item) => <article className="company-card surface-panel" key={item.id}>
        <div className="company-card-head"><span className="company-logo">{initials(item.name)}</span><StatusBadge status={item.active ? "ONLINE" : "OFFLINE"} /></div>
        <h2>{item.name}</h2><p className="company-document">{item.document || "Documento não informado"}</p>
        <div className="company-stats"><div><Gauge size={16} /><span><b>{item._count?.machines || 0}</b> escavadeiras</span></div><div><UsersRound size={16} /><span><b>{item._count?.users || 0}</b> usuários</span></div></div>
        <div className="company-actions"><Link href={`/admin/companies/${item.id}`}>Abrir empresa <ChevronRight size={16} /></Link>{isSuperAdmin && <button type="button" onClick={() => setSelected(item)}><Trash2 size={15} /> Excluir</button>}</div>
      </article>)}</section> : <EmptyState title={search ? "Nenhuma empresa corresponde à busca" : "Nenhuma empresa cadastrada"} description={search ? "Tente outro nome ou documento." : "Cadastre a primeira empresa para começar."} />}
    </>}
    <ArchiveCompanyDialog company={selected} onClose={() => setSelected(null)} onConfirm={archive} />
  </div>;
}

function initials(name = "") { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
