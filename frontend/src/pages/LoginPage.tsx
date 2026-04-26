import { AxiosError } from "axios";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

type FormErrors = Partial<Record<"email" | "password" | "form", string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getMobileState() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(getMobileState);
  const [isOpen, setIsOpen] = useState(getMobileState);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const applyState = (matches: boolean) => {
      setIsMobile(matches);
      if (matches) {
        setIsOpen(true);
      }
    };

    applyState(media.matches);

    const onChange = (event: MediaQueryListEvent) => {
      applyState(event.matches);
    };

    media.addEventListener("change", onChange);

    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return;
    }
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isMobile) return;

    const handleScroll = () => {
      if (window.scrollY > window.innerHeight / 3) {
        setIsOpen(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  const showClosedState = useMemo(() => !isOpen && !isMobile, [isMobile, isOpen]);

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!EMAIL_REGEX.test(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors((current) => ({ ...current, form: undefined }));

    try {
      await login({ email, password });
      navigate("/", { replace: true });
    } catch (error) {
      const message =
        error instanceof AxiosError && error.response?.status === 401
          ? "Invalid email or password."
          : "Unable to log in right now.";
      setErrors((current) => ({ ...current, form: message }));
    } finally {
      setIsSubmitting(false);
    }
  }

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isMobile) return;
    setIsOpen(false);
  };

  return (
    <main className="relative w-full font-['Nunito',sans-serif]">
      <div
        className="h-[160vh] w-full bg-cover bg-center bg-no-repeat sm:h-[200vh]"
        style={{ backgroundImage: "url('/assets/images/background.jpg')" }}
        aria-hidden
      />

      {showClosedState ? (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <div className="flex translate-y-16 flex-col items-center gap-4 text-center transition-transform duration-500">
            <p className="m-0 text-[32px] font-extrabold uppercase leading-none tracking-[0.4px] text-[gray-700]" >
              SCROLL DOWN
            </p>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[gray-700] text-[gray-700]">
              <ArrowDown size={22} strokeWidth={2.4} aria-hidden />
            </span>
          </div>
        </div>
      ) : null}

      <div
        className={`fixed bottom-0 left-0 z-30 flex w-full justify-center px-3 transition-all duration-300 sm:px-5 ${
          isOpen
            ? "top-0 h-full items-center bg-[rgba(51,51,51,0.85)]"
            : "items-end h-[60px] bg-[rgba(51,51,51,0.5)]"
        }`}
      >
        {!isOpen && !isMobile ? (
          <button
            type="button"
            onClick={openModal}
            className="mb-3 inline-flex min-h-[44px] items-center justify-center rounded-[30px] border-0 bg-white px-8 py-2.5 text-[18px] font-semibold text-[black] shadow-[0_10px_40px_rgba(0,0,0,0.16)] outline-none transition-transform duration-300 hover:-translate-y-px sm:px-10"
          >
            Click here to login
          </button>
        ) : null}

        <div
          className={`pointer-events-none absolute inset-0 flex justify-center ${
            isOpen ? "items-center" : "items-end"
          }`}
        >

          <section
            className={`relative flex w-[95vw] max-w-[720px] origin-bottom overflow-hidden rounded-[10px] bg-white transition-all md:w-full ${
              isOpen
                ? "pointer-events-auto -translate-y-8 scale-100 opacity-100 duration-[600ms]"
                : "pointer-events-none translate-y-[220px] scale-[0.4] opacity-0 duration-300"
            }`}
          >
          <button
            type="button"
            onClick={closeModal}
            className="absolute right-[10px] top-3 z-20 flex h-8 w-8 items-center justify-center border-0 bg-transparent p-0 text-black"
            aria-label="Close login modal"
          >
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden>
              <circle cx="16" cy="16" r="15" fill="#000" />
              <path d="M11 11L21 21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <path d="M21 11L11 21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className={`flex flex-1 flex-col bg-white px-[30px] pb-5 pt-[60px] transition-all ${
              isOpen
                ? "translate-y-0 opacity-100 delay-100 duration-500"
                : "translate-y-20 opacity-0 duration-300"
            } md:basis-3/5`}
            style={{ flex: 1.5 }}
          >
            <h1 className="m-0 text-[26px] font-normal leading-tight text-[#55311c]">Welcome!</h1>
            <p className="mb-[30px] mt-1.5 text-sm text-[rgba(0,0,0,0.7)]">
              Access for Condo Managers
            </p>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              {errors.form ? (
                <p className="m-0 text-xs text-red-600">{errors.form}</p>
              ) : null}

              <label className="flex flex-col gap-1.5" htmlFor="login-email">
                <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[#black]">
                  Email
                </span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-9 w-full rounded border border-[#6f635b] bg-[#3e342f] px-[10px] pb-2 pt-[10px] text-[#fff7f2] outline-none transition-colors duration-300 placeholder:text-[#dbcfc8] focus:border-[#b79b89]"
                />
                {errors.email ? <p className="m-0 text-xs text-red-600">{errors.email}</p> : null}
              </label>

              <label className="flex flex-col gap-1.5" htmlFor="login-password">
                <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[#black]">
                  Password
                </span>
                <span className="relative block ">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-9 w-full rounded border border-[#6f635b] bg-[#3e342f] px-[10px] pb-2 pr-9 pt-[10px] text-[#fff7f2] outline-none transition-colors duration-300 placeholder:text-[#dbcfc8] focus:border-[#b79b89]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center border-0 bg-transparent p-1 text-[#dbcfc8]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
                {errors.password ? (
                  <p className="m-0 text-xs text-red-600">{errors.password}</p>
                ) : null}
              </label>

              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded border-0 bg-[#8c7569] px-3 py-2 font-['Nunito',sans-serif] text-white transition-all duration-300 hover:bg-[#55311c] disabled:opacity-80 md:w-auto"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Log in
                </button>
              </div>

              <p className="invisible mt-[60px] text-center text-sm">
                Don't have an account? Sign up now
              </p>
            </form>
          </div>

          <div
            className={`hidden md:block md:basis-2/5 ${
              isOpen ? "scale-100 duration-[1200ms]" : "scale-200 duration-300"
            }`}
            style={{ flex: 2, transformOrigin: "center" }}
            aria-hidden
          >
            <img
              src="/assets/images/unsplash.jpg"
              alt="Warm indoor environment with sofa and notebook"
              className="h-full w-full object-cover"
            />
          </div>
          </section>
        </div>
      </div>
    </main>
  );
}
