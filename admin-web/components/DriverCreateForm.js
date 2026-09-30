"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Save, UserRound, X } from "lucide-react";
import { request } from "../services/api";

export default function DriverCreateForm({ onCreated, onCancel }) {
  const [companies, setCompanies] = useState([]),
    [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      companyId: "",
      phone: "",
    });
  const [showPassword, setShowPassword] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    request("/companies")
      .then((result) => {
        const items = Array.isArray(result) ? result : result.data || [];
        setCompanies(items);
        if (items.length === 1)
          setForm((current) => ({ ...current, companyId: items[0].id }));
      })
      .catch((err) => setError(err.message));
  }, []);
  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...form };
      if (!body.phone.trim()) delete body.phone;
      const created = await request("/drivers", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated(created.driverProfile?.id || created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="surface-panel driver-create" onSubmit={submit}>
      <div className="driver-create-head">
        <span>
          <UserRound size={22} />
        </span>
        <div>
          <small>NOVO ACESSO</small>
          <h2>Cadastrar operador</h2>
          <p>
            Crie o login do aplicativo. O cartão RFID poderá ser vinculado em
            seguida.
          </p>
        </div>
        <button type="button" aria-label="Fechar" onClick={onCancel}>
          <X size={19} />
        </button>
      </div>
      <div className="driver-form-grid">
        <label>
          <span>NOME COMPLETO *</span>
          <input
            autoFocus
            required
            minLength={2}
            autoComplete="name"
            placeholder="Nome do motorista"
            value={form.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </label>
        <label>
          <span>TELEFONE</span>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            value={form.phone}
            onChange={(event) => change("phone", event.target.value)}
          />
        </label>
        <label>
          <span>E-MAIL PARA LOGIN *</span>
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="operador@empresa.com"
            value={form.email}
            onChange={(event) => change("email", event.target.value)}
          />
        </label>
        <label>
          <span>SENHA INICIAL *</span>
          <div className="password-field">
            <input
              required
              type={showPassword ? "text" : "password"}
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              value={form.password}
              onChange={(event) => change("password", event.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        <label className="driver-company-field">
          <span>EMPRESA *</span>
          <select
            required
            value={form.companyId}
            onChange={(event) => change("companyId", event.target.value)}
          >
            <option value="">Selecione a empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="driver-create-actions">
        <button type="button" className="secondary-action" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? "Salvando..." : "Cadastrar operador"}
        </button>
      </div>
    </form>
  );
}
