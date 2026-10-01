'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';

interface RolOption {
  id: number;
  nombre: string;
  descripcion: string;
}

interface VacantesData {
  cupo_maximo: number;
  confirmados: number;
  cupos_disponibles: number;
  lista_espera: number;
}

export default function FormularioInscripcion() {
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [vacantes, setVacantes] = useState<VacantesData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [registradoExitoso, setRegistradoExitoso] = useState<any>(null);

  // Form State
  const [dniPasaporte, setDniPasaporte] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [rolPrincipalId, setRolPrincipalId] = useState<number>(1);
  const [rolesAdicionalesIds, setRolesAdicionalesIds] = useState<number[]>([]);
  const [consentimientoDatos, setConsentimientoDatos] = useState<boolean>(true);

  // Cargar roles y métricas de vacantes
  useEffect(() => {
    async function fetchData() {
      try {
        const [resRoles, resVacantes] = await Promise.all([
          fetch('/api/registro/roles'),
          fetch('/api/vacantes'),
        ]);

        if (resRoles.ok) {
          const dataRoles = await resRoles.json();
          if (dataRoles.roles && dataRoles.roles.length > 0) {
            setRoles(dataRoles.roles);
            setRolPrincipalId(dataRoles.roles[0].id);
          }
        }

        if (resVacantes.ok) {
          const dataVacantes = await resVacantes.json();
          setVacantes({
            cupo_maximo: dataVacantes.cupo_maximo || 400,
            confirmados: dataVacantes.confirmados || 0,
            cupos_disponibles: dataVacantes.cupos_disponibles !== undefined ? dataVacantes.cupos_disponibles : 400,
            lista_espera: dataVacantes.lista_espera || 0,
          });
        }
      } catch (err) {
        console.error('Error cargando datos de inscripción:', err);
      }
    }
    fetchData();
  }, []);

  const handleRolAdicionalToggle = (id: number) => {
    setRolesAdicionalesIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones de frontend
    const cleanDni = dniPasaporte.trim();
    if (!cleanDni || cleanDni.length < 5 || cleanDni.length > 25) {
      Swal.fire({
        icon: 'warning',
        title: 'DNI / Pasaporte inválido',
        text: 'Debe contener entre 5 y 25 caracteres sin símbolos especiales.',
        confirmButtonColor: '#005691',
      });
      return;
    }

    if (!consentimientoDatos) {
      Swal.fire({
        icon: 'warning',
        title: 'Consentimiento Requerido',
        text: 'Debes aceptar los términos y el consentimiento conforme a la Ley 25.326.',
        confirmButtonColor: '#005691',
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        dni_pasaporte: cleanDni,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim().toLowerCase(),
        celular: celular.trim(),
        rol_principal_id: Number(rolPrincipalId),
        roles_adicionales_ids: rolesAdicionalesIds.filter((id) => id !== Number(rolPrincipalId)),
        consentimiento_datos: true,
      };

      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && (data.ok || data.success)) {
        const isConfirmado = data.estado === 'CONFIRMADO';
        setRegistradoExitoso({
          dni: cleanDni,
          nombre: `${nombre.trim()} ${apellido.trim()}`,
          email: email.trim().toLowerCase(),
          estado: data.estado,
          mensaje: data.mensaje,
          qr_token: data.qr_token,
        });

        Swal.fire({
          icon: isConfirmado ? 'success' : 'info',
          title: isConfirmado ? '¡Inscripción Confirmada!' : 'Incorporado a Lista de Espera',
          text: data.mensaje || 'Registro efectuado con éxito.',
          confirmButtonColor: '#005691',
          confirmButtonText: 'Ver mi Credencial Digital',
        });
      } else if (res.status === 409) {
        // DNI ya registrado
        Swal.fire({
          icon: 'info',
          title: 'Ya estás Registrado',
          text: data.message || `El DNI ${cleanDni} ya se encuentra registrado con estado ${data.estado}.`,
          showCancelButton: true,
          confirmButtonColor: '#005691',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Consultar mi Credencial',
          cancelButtonText: 'Cerrar',
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = `/mi-credencial?dni=${encodeURIComponent(cleanDni)}`;
          }
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo completar el registro',
          text: data.message || data.error || 'Por favor revisá los datos ingresados.',
          confirmButtonColor: '#005691',
        });
      }
    } catch (err) {
      console.error('Error enviando formulario de inscripción:', err);
      Swal.fire({
        icon: 'error',
        title: 'Fallo de Conexión',
        text: 'Ocurrió un error al contactar al servidor. Verificá tu conexión a internet.',
        confirmButtonColor: '#005691',
      });
    } finally {
      setLoading(false);
    }
  };

  // Si ya se registró en esta sesión, mostramos la confirmación y acceso directo a credencial
  if (registradoExitoso) {
    const isConfirmado = registradoExitoso.estado === 'CONFIRMADO';
    return (
      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl shadow-xl p-8 md:p-10 text-center animate-fade-in">
        <div className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center text-4xl shadow-inner ${isConfirmado ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
          {isConfirmado ? '✓' : '⏳'}
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--color-azul-oscuro)] mb-2">
          {isConfirmado ? '¡Te damos la bienvenida al Congreso!' : 'Solicitud Recibida en Lista de Espera'}
        </h2>

        <p className="text-gray-600 text-sm md:text-base max-w-lg mx-auto mb-6">
          {registradoExitoso.mensaje}
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-8 text-left space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500 font-medium">Participante:</span>
            <span className="font-bold text-gray-900">{registradoExitoso.nombre}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500 font-medium">DNI / Documento:</span>
            <span className="font-mono font-bold text-gray-900">{registradoExitoso.dni}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500 font-medium">Correo Electrónico:</span>
            <span className="font-medium text-gray-900">{registradoExitoso.email}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-gray-500 font-medium">Estado de Inscripción:</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isConfirmado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {registradoExitoso.estado}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/mi-credencial?dni=${encodeURIComponent(registradoExitoso.dni)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[var(--color-azul-oscuro)] hover:bg-[var(--color-azul-claro)] text-white font-bold rounded-xl shadow-lg transition-all duration-200"
          >
            <span>🪪</span>
            <span>Ver mi Credencial Digital y QR</span>
          </Link>
          <button
            onClick={() => {
              setRegistradoExitoso(null);
              setDniPasaporte('');
              setNombre('');
              setApellido('');
              setEmail('');
              setCelular('');
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl transition"
          >
            Registrar a otra persona
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-white border border-gray-200/80 rounded-3xl shadow-xl p-6 sm:p-10">
      {/* Indicador de Vacantes Oficial */}
      {vacantes && (
        <div className="mb-8 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <span className="font-bold text-gray-900">Aforo Oficial: </span>
              <span className="text-gray-700">Auditorio Polo Saavedra 5085</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white font-semibold text-blue-900 border border-blue-200 rounded-lg shadow-sm">
              {vacantes.cupos_disponibles > 0 ? (
                <span>🎟️ <strong>{vacantes.cupos_disponibles}</strong> vacantes libres</span>
              ) : (
                <span className="text-amber-700">⏳ Lista de espera activa</span>
              )}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              DNI o Pasaporte <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: 38123456"
              value={dniPasaporte}
              onChange={(e) => setDniPasaporte(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[var(--color-azul-claro)] focus:border-transparent outline-none transition"
            />
            <span className="text-[11px] text-gray-400">Sin puntos ni espacios</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Teléfono Celular <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="Ej: +54 9 11 5555-5555"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[var(--color-azul-claro)] focus:border-transparent outline-none transition"
            />
            <span className="text-[11px] text-gray-400">Para avisos sobre acreditación y salas</span>
          </div>
        </div>

        {/* Nombres y Apellidos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Como figurará en tu certificado"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[var(--color-azul-claro)] focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Apellido <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Como figurará en tu certificado"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[var(--color-azul-claro)] focus:border-transparent outline-none transition"
            />
          </div>
        </div>

        {/* Correo Electrónico */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Correo Electrónico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            placeholder="tunombre@institucion.edu.ar o personal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[var(--color-azul-claro)] focus:border-transparent outline-none transition"
          />
          <span className="text-[11px] text-gray-400">Te enviaremos el comprobante y el enlace a tu Credencial Oficial con QR</span>
        </div>

        {/* Rol Institucional Principal */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Rol Institucional Principal <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {roles.map((r) => (
              <label
                key={r.id}
                className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition ${
                  Number(rolPrincipalId) === r.id
                    ? 'border-[var(--color-azul-claro)] bg-blue-50/60 ring-2 ring-[var(--color-azul-claro)]/20'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="rol_principal"
                  value={r.id}
                  checked={Number(rolPrincipalId) === r.id}
                  onChange={() => setRolPrincipalId(r.id)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-bold text-gray-900">{r.nombre}</div>
                  <div className="text-xs text-gray-500 leading-tight mt-0.5">{r.descripcion}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Roles Adicionales Opcionales */}
        {roles.length > 1 && (
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Roles Adicionales (Opcional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Si además cumplís alguna otra función en el marco del Congreso:
            </p>
            <div className="flex flex-wrap gap-2">
              {roles
                .filter((r) => r.id !== Number(rolPrincipalId))
                .map((r) => {
                  const isChecked = rolesAdicionalesIds.includes(r.id);
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => handleRolAdicionalToggle(r.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                        isChecked
                          ? 'bg-[var(--color-azul-oscuro)] text-white border-[var(--color-azul-oscuro)] shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '} {r.nombre}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Consentimiento Normativo Ley 25.326 */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
          <label className="flex items-start gap-3 cursor-pointer text-xs text-gray-700">
            <input
              type="checkbox"
              required
              checked={consentimientoDatos}
              onChange={(e) => setConsentimientoDatos(e.target.checked)}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="leading-relaxed">
              <strong>Consentimiento de Tratamiento de Datos (Ley Nacional 25.326):</strong> Autorizo el tratamiento de mis datos personales para la acreditación, emisión de credenciales con código QR criptográfico, control de aforo y expedición de certificados oficiales del GCBA.
            </span>
          </label>
        </div>

        {/* Botón de Envío */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 bg-[var(--color-amarillo)] hover:bg-[#ebd234] text-[var(--color-azul-oscuro)] font-extrabold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Procesando registro seguro...</span>
              </>
            ) : (
              <>
                <span>✍️</span>
                <span>Confirmar Inscripción al Congreso</span>
              </>
            )}
          </button>
        </div>

        {/* Enlace para participantes ya inscriptos */}
        <div className="text-center pt-2 text-xs text-gray-500">
          ¿Ya te inscribiste anteriormente?{' '}
          <Link href="/mi-credencial" className="text-[var(--color-azul-claro)] font-bold hover:underline">
            Consultá o descargá tu Credencial Digital aquí
          </Link>
        </div>
      </form>
    </div>
  );
}
