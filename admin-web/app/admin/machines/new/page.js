"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Truck } from "lucide-react";
import { companies, createMachine } from "../../../../services/machine.service";
import { session } from "../../../../services/api";
import { ErrorState } from "../../../../components/States";

const emptyForm = {
  companyId: "",
  code: "",
  name: "",
  brand: "",
  model: "",
  serialNumber: "",
  year: "",
};

export default function NewMachinePage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [companyList, setCompanyList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    setIsSuperAdmin(session()?.user?.role === "SUPER_ADMIN");
  }, []);

  useEffect(() => {
    if (isSuperAdmin)
      companies()
        .then((result) => setCompanyList(result.data || []))
        .catch((err) => setError(err.message));
  }, [isSuperAdmin]);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => String(value).trim() !== ""),
      );
      if (payload.year) payload.year = Number(payload.year);
      const created = await createMachine(payload);
      router.push(`/admin/devices?machine=${created.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <Link className="back-link" href="/admin/machines">
        <ArrowLeft size={15} /> Voltar para escavadeiras
      </Link>
      <header className="page-header">
        <div>
          <span className="eyebrow">NOVO ATIVO</span>
          <h1>Cadastrar escavadeira</h1>
          <p>
            Primeiro crie o equipamento. Depois vincule o ESP32 em Dispositivos.
          </p>
        </div>
      </header>
      {error && <ErrorState message={error} />}
      <form className="surface-panel machine-create-form" onSubmit={submit}>
        <div className="panel-header">
          <div>
            <span className="eyebrow">IDENTIFICAÇÃO</span>
            <h2>Dados do equipamento</h2>
          </div>
          <Truck size={20} />
        </div>
        {isSuperAdmin && (
          <label>
            <span>EMPRESA *</span>
            <select
              required
              value={form.companyId}
              onChange={(e) => change("companyId", e.target.value)}
            >
              <option value="">Selecione a empresa</option>
              {companyList.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="machine-form-grid">
          <label>
            <span>CÓDIGO *</span>
            <input
              required
              minLength={3}
              maxLength={40}
              placeholder="ESC-001"
              value={form.code}
              onChange={(e) => change("code", e.target.value.toUpperCase())}
            />
          </label>
          <label>
            <span>NOME *</span>
            <input
              required
              minLength={2}
              placeholder="Escavadeira principal"
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <label>
            <span>FABRICANTE</span>
            <input
              placeholder="Caterpillar"
              value={form.brand}
              onChange={(e) => change("brand", e.target.value)}
            />
          </label>
          <label>
            <span>MODELO</span>
            <input
              placeholder="320 GC"
              value={form.model}
              onChange={(e) => change("model", e.target.value)}
            />
          </label>
          <label>
            <span>NÚMERO DE SÉRIE</span>
            <input
              placeholder="Série da máquina"
              value={form.serialNumber}
              onChange={(e) => change("serialNumber", e.target.value)}
            />
          </label>
          <label>
            <span>ANO</span>
            <input
              type="number"
              min="1950"
              max="2100"
              inputMode="numeric"
              placeholder="2024"
              value={form.year}
              onChange={(e) => change("year", e.target.value)}
            />
          </label>
        </div>
        <div className="machine-form-actions">
          <Link href="/admin/machines">Cancelar</Link>
          <button disabled={saving}>
            <Save size={16} />
            {saving ? "Salvando..." : "Cadastrar escavadeira"}
          </button>
        </div>
      </form>
    </div>
  );
}
