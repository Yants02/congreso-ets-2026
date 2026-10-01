'use client';

import { useState, useEffect } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useBackendSyncStatus } from "@/hooks/useBackendSyncStatus";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const { isSynced } = useBackendSyncStatus();

    // Verificar si ya existe una sesión activa para evitar abandono si el usuario retrocede
    useEffect(() => {
        if (typeof window !== "undefined") {
            fetch("/api/admin/auth/me")
                .then((res) => {
                    if (res.ok) {
                        return res.json();
                    }
                    return null;
                })
                .then((data) => {
                    if (data && data.operador) {
                        setSuccessMsg(`Sesión activa de ${data.operador.nombre} detectada. Redirigiendo al panel...`);
                        setTimeout(() => {
                            window.location.replace("/admin");
                        }, 300);
                    }
                })
                .catch(() => {});
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            const res = await fetch("/api/admin/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                    recordar: true,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMsg(data.message || data.error || "Credenciales inválidas");
                return;
            }

            setSuccessMsg(`¡Bienvenido/a, ${data.operador?.nombre || 'Operador'}! Redirigiendo al panel...`);
            if (data.token) {
                localStorage.setItem("congreso_token", data.token);
                localStorage.setItem("congreso_user", JSON.stringify(data.operador));
            }
            setTimeout(() => {
                window.location.replace('/admin');
            }, 300);
        } catch (err: any) {
            setErrorMsg("No se pudo conectar con el servidor de autenticación.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Header />
            
            <main className="flex-grow flex items-center justify-center px-4 py-12 pt-28">
                <div className="bg-white p-8 md:p-10 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
                    <div className="flex flex-col items-center mb-8">
                        <h2 className="text-2xl font-bold text-azul-oscuro mt-2">Acceso Administrativo</h2>
                        <p className="text-gray-500 text-sm mt-2 text-center">
                            Ingrese sus credenciales institucionales para acceder a la plataforma del congreso.
                        </p>
                    </div>

                    {errorMsg && (
                        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                            {errorMsg}
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-4 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                            {successMsg}
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="usuario">
                                Correo Institucional
                            </label>
                            <input 
                                id="usuario" 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                                placeholder="ejemplo@bue.edu.ar"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="clave">
                                Clave de Acceso
                            </label>
                            <div className="relative flex items-center">
                                <input 
                                    id="clave" 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-11 py-2.5 bg-gray-50 border border-gray-300 rounded text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Ocultar clave de acceso" : "Mostrar clave de acceso"}
                                    title={showPassword ? "Ocultar clave" : "Mostrar clave"}
                                    className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors cursor-pointer"
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="mt-2 w-full flex items-center justify-center gap-2 bg-azul-oscuro text-white font-bold py-3 px-4 rounded shadow hover:bg-black hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
                            title={
                                isSynced === true
                                    ? "Sincronización activa con Backend (OK)"
                                    : isSynced === false
                                    ? "Sin sincronización con Backend (Desconectado)"
                                    : "Comprobando sincronización..."
                            }
                        >
                            <span 
                                className={`inline-block h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                                    isSynced === true
                                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                                        : isSynced === false
                                        ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)] animate-pulse"
                                        : "bg-amber-400 animate-pulse"
                                }`}
                            />
                            <span>{loading ? "Validando credenciales..." : "Ingresar"}</span>
                        </button>
                    </form>
                </div>
            </main>

            <Footer />
        </div>
    );
}