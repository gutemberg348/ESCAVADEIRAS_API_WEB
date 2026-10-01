"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Save, Truck } from "lucide-react";
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
  const [step, setStep] = useState(1);

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
    if (step < 3) {
      if (step === 1 && (!form.code.trim() || form.code.trim().length < 3 || !form.name.trim() || (isSuperAdmin && !form.companyId))) {
        setError("Informe a empresa, o código e o nome da escavadeira para continuar.");
        return;
      }
      setError("");
      setStep(step + 1);
      return;
    }
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
          <p>Cadastre a escavadeira em três passos. Depois o painel guiará a instalação da placa.</p>
        </div>
      </header>
      {error && <ErrorState message={error} />}
      <form className="surface-panel machine-create-form" onSubmit={submit}>
        <div className="machine-wizard-progress" aria-label={`Passo ${step} de 3`}>
          {["Identificação", "Detalhes opcionais", "Confirmar"].map((label, index) => <span key={label} className={step >= index + 1 ? "active" : ""}><b>{index + 1}</b>{label}</span>)}
        </div>
        <div className="panel-header">
          <div>
            <span className="eyebrow">PASSO {step} DE 3</span>
            <h2>{step === 1 ? "Identifique a escavadeira" : step === 2 ? "Complete se souber" : "Confira antes de cadastrar"}</h2>
          </div>
          <Truck size={20} />
        </div>
        {step === 1 && isSuperAdmin && (
          <label>
            <span>EMPRESA *</span>
            <select
              required={step === 1}
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
        {step === 1 && <div className="machine-form-grid">
          <label>
            <span>CÓDIGO *</span>
            <input
              required={step === 1}
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
              required={step === 1}
              minLength={2}
              placeholder="Escavadeira principal"
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
        </div>}
        {step === 2 && <><p className="guided-help">Estes campos são opcionais. Você pode continuar sem eles e completar depois.</p><div className="machine-form-grid"><label>
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
        </div></>}
        {step === 3 && <div className="machine-review">
          <div><span>Empresa</span><strong>{isSuperAdmin ? companyList.find((item) => item.id === form.companyId)?.name || "Não selecionada" : "Sua empresa"}</strong></div>
          <div><span>Código</span><strong>{form.code.trim()}</strong></div>
          <div><span>Nome</span><strong>{form.name.trim()}</strong></div>
          <div><span>Fabricante / modelo</span><strong>{[form.brand, form.model].filter(Boolean).join(" · ") || "Não informado"}</strong></div>
          <p>Ao confirmar, a escavadeira será criada e você seguirá para instalar ou vincular o ESP32.</p>
        </div>}
        <div className="machine-form-actions">
          {step > 1 ? <button type="button" className="wizard-back" onClick={() => { setStep(step - 1); setError(""); }}>Voltar</button> : <Link href="/admin/machines">Cancelar</Link>}
          <button type="submit" disabled={saving}>
            {step === 3 ? <Save size={16} /> : <ArrowRight size={16} />}
            {saving ? "Salvando..." : step === 3 ? "Cadastrar e instalar placa" : "Continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
