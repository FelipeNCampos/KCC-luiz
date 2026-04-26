import { AxiosError } from "axios";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";

import { AuthLayout } from "../components/AuthLayout";
import { TextField } from "../components/TextField";
import { useAuth } from "../hooks/useAuth";

type FormErrors = Partial<Record<"name" | "email" | "password" | "form", string>>;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (name.trim().length < 2) nextErrors.name = "Informe seu nome.";
    if (!email.includes("@")) nextErrors.email = "Informe um email válido.";
    if (password.length < 8) nextErrors.password = "Use pelo menos 8 caracteres.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register({ name, email, password });
      navigate("/", { replace: true });
    } catch (error) {
      const message =
        error instanceof AxiosError && error.response?.status === 409
          ? "Este email já está cadastrado."
          : "Não foi possível criar a conta agora.";
      setErrors({ form: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
        <div>
          <p className="oak-label">Novo acesso</p>
          <h2 className="mt-2 text-2xl font-extrabold text-oak-coffee">Criar conta</h2>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Cadastre um usuário para operar o ambiente administrativo.
          </p>
        </div>
        {errors.form ? (
          <div className="rounded-lg border border-oak-danger/20 bg-oak-dangerBg px-4 py-3 text-sm font-bold text-oak-danger">
            {errors.form}
          </div>
        ) : null}
        <TextField
          label="Nome"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          helperText="Mínimo de 8 caracteres."
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="oak-button-primary w-full" type="submit" disabled={isSubmitting}>
          <UserPlus size={18} strokeWidth={2.2} />
          {isSubmitting ? "Criando..." : "Criar conta"}
        </button>
        <p className="text-center text-sm font-semibold text-black/60">
          Já tem conta?{" "}
          <Link className="font-extrabold text-oak-coffee hover:text-oak-taupe" to="/login">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
