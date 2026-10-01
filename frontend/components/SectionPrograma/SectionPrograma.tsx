"use client";
import { useState, useEffect, useMemo } from "react";
import CardPrograma from "./Card/Card";

interface ActividadPublica {
  id: number;
  title: string;
  descripcion: string;
  categoria: string;
  expositor: string;
  sala: string;
  ubicacion: string;
  horario_inicio: string;
  horario_fin: string;
  fecha_actividad?: string;
  hora_inicio?: string;
  hora_fin?: string;
  cupo_maximo: number;
  ocupacion_actual: number;
  activo: boolean;
}

export default function SectionPrograma() {
  const [filtroSeleccionado, setFiltroSeleccionado] = useState("Todos");
  const [actividades, setActividades] = useState<ActividadPublica[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrograma() {
      try {
        const res = await fetch("/api/actividades");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.actividades) && data.actividades.length > 0) {
            setActividades(data.actividades);
          }
        }
      } catch (err) {
        console.error("Error al cargar programa:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPrograma();
  }, []);

  // Extraer las fechas distintas para las jornadas del evento
  const jornadasDisponibles = useMemo(() => {
    const dates = new Set<string>();
    actividades.forEach((a) => {
      const f = a.fecha_actividad || (a.horario_inicio ? a.horario_inicio.slice(0, 10) : "");
      if (f) dates.add(f);
    });
    return Array.from(dates).sort();
  }, [actividades]);

  // Filtrar según la opción elegida en el selector (Jornadas o Categorías)
  const actividadesFiltradas = useMemo(() => {
    if (filtroSeleccionado === "Todos") {
      return actividades;
    }

    // Si seleccionó una jornada por fecha
    if (filtroSeleccionado.startsWith("jornada:")) {
      const fecha = filtroSeleccionado.replace("jornada:", "");
      return actividades.filter((a) => {
        const f = a.fecha_actividad || (a.horario_inicio ? a.horario_inicio.slice(0, 10) : "");
        return f === fecha;
      });
    }

    // Si seleccionó una categoría (de las que antes estaban en los botones)
    if (filtroSeleccionado.startsWith("cat:")) {
      const term = filtroSeleccionado.replace("cat:", "").toLowerCase();
      return actividades.filter((a) => {
        const cat = (a.categoria || "").toLowerCase();
        const tit = (a.title || "").toLowerCase();
        const desc = (a.descripcion || "").toLowerCase();
        return cat.includes(term) || term.includes(cat) || tit.includes(term) || desc.includes(term);
      });
    }

    return actividades;
  }, [actividades, filtroSeleccionado]);

  // Formato para mostrar duración estimada
  function calcularDuracion(inicio: string, fin: string) {
    const dIni = new Date(inicio).getTime();
    const dFin = new Date(fin).getTime();
    if (isNaN(dIni) || isNaN(dFin) || dFin <= dIni) return "";
    const mins = Math.round((dFin - dIni) / (1000 * 60));
    if (mins >= 60) {
      const hs = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `${hs}h ${rem}m` : `${hs}h`;
    }
    return `${mins} min`;
  }

  function formatearRangoHorario(a: ActividadPublica) {
    if (a.hora_inicio && a.hora_fin) {
      return `${a.hora_inicio} – ${a.hora_fin}`;
    }
    const dIni = new Date(a.horario_inicio);
    const dFin = new Date(a.horario_fin);
    const h1 = !isNaN(dIni.getTime())
      ? dIni.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      : "";
    const h2 = !isNaN(dFin.getTime())
      ? dFin.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      : "";
    return `${h1} – ${h2}`;
  }

  const esFiltroJornada = filtroSeleccionado.startsWith("jornada:");

  return (
    <section id="programa" className="scroll-mt-32 max-w-4xl mx-auto py-10 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-2">
        <div>
          <h2 className="text-3xl font-bold text-azul-oscuro">Programa del Congreso</h2>
          <p className="text-sm text-gray-500 mt-1">
            Cronograma oficial de ponencias, talleres y masterclasses por jornada
          </p>
        </div>
      </div>

      {/* Selector que sustituye totalmente a los botones e integra las opciones */}
      <div className="mb-8 bg-slate-50 p-3.5 sm:p-5 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <label
          htmlFor="selector-programa"
          className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"
        >
          <span className="text-lg">🎯</span> Filtrar Programa:
        </label>
        <div className="relative w-full sm:w-80">
          <select
            id="selector-programa"
            aria-label="Filtrar actividades del programa por jornada o categoría"
            value={filtroSeleccionado}
            onChange={(e) => setFiltroSeleccionado(e.target.value)}
            className="w-full h-9 appearance-none bg-white border border-gray-300 text-gray-800 text-[11px] sm:text-xs font-medium rounded-xl pl-3 pr-8 shadow-2xs hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-azul-oscuro focus:border-azul-oscuro cursor-pointer transition-all"
          >
            <option value="Todos" className="text-[11px]">✨ Todos (Mostrar todo)</option>

            {jornadasDisponibles.length > 0 && (
              <optgroup label="📅 Jornadas del Congreso">
                {jornadasDisponibles.map((f, idx) => {
                  const dateObj = new Date(f + "T00:00:00");
                  const labelDia = isNaN(dateObj.getTime())
                    ? f
                    : dateObj.toLocaleDateString("es-AR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      });
                  const labelFormateado = labelDia.charAt(0).toUpperCase() + labelDia.slice(1);
                  return (
                    <option key={`jornada:${f}`} value={`jornada:${f}`}>
                      Día {idx + 1}: {labelFormateado}
                    </option>
                  );
                })}
              </optgroup>
            )}

            <optgroup label="🏷️ Categorías">
              <option value="cat:Institucional">Institucional</option>
              <option value="cat:Masterclass">Masterclass</option>
              <option value="cat:Taller">Talleres / Actividades simultáneas</option>
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Listado dinámico de actividades */}
      <div>
        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            Cargando cronograma oficial del congreso...
          </div>
        ) : actividadesFiltradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm border border-dashed rounded-xl">
            No se encontraron actividades registradas para la opción seleccionada.
          </div>
        ) : (
          actividadesFiltradas.map((act) => {
            const fechaStr = act.fecha_actividad
              ? new Date(act.fecha_actividad + "T00:00:00").toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })
              : "";

            return (
              <div key={act.id} className="relative">
                {!esFiltroJornada && fechaStr && (
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50/80 px-3 py-1 rounded-md inline-block mb-2">
                    📅 {fechaStr}
                  </div>
                )}
                <CardPrograma
                  horario={formatearRangoHorario(act)}
                  duracion={calcularDuracion(act.horario_inicio, act.horario_fin)}
                  categoria={act.categoria}
                  title={act.title}
                  expositor={act.expositor}
                  descripcion={act.descripcion}
                  estado={act.activo ? "Vigente" : "Inactiva"}
                  sala={act.sala ? `${act.sala}${act.ubicacion ? ` (${act.ubicacion})` : ""}` : "Aula a confirmar"}
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}