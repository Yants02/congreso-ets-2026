// page.tsx — Página de materiales y novedades del Congreso

"use client";

import { useMemo, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import CardMateriales, {
    type Content,
} from "../../components/CardMateriales/cardmateriales";

// Contenidos de ejemplo. Estos datos luego deberían provenir del sistema de gestión.
const contents: Content[] = [
    {
        id: "1",
        type: "novedad",
        date: "11 sep 2026",
        title: "Novedades del Congreso ETS 2026",
        description:
            "En este espacio se publicarán las novedades relacionadas con el Congreso de Educación Técnica Superior.",
    },
    {
        id: "2",
        type: "documento",
        date: "10 sep 2026",
        title: "Documento general de participación",
        description:
            "Información orientativa para participar del 1er Congreso de Educación Técnica Superior.",
        fileUrl: "/documentos/participacion.pdf",
    },
    {
        id: "3",
        type: "video",
        date: "9 sep 2026",
        title: "Conocé el Congreso ETS 2026",
        description:
            "Contenido audiovisual institucional relacionado con el Congreso.",
        videoUrl: "https://www.youtube.com/",
    },
    {
        id: "4",
        type: "flyer",
        date: "8 sep 2026",
        title: "Flyer oficial del Congreso",
        description:
            "Pieza gráfica institucional del Congreso de Educación Técnica Superior.",
    },
    {
        id: "5",
        type: "foto",
        date: "7 sep 2026",
        title: "Fotografías del Congreso",
        description:
            "Registro fotográfico de las actividades del Congreso de Educación Técnica Superior.",
        images: [],
    },
    {
        id: "6",
        type: "recurso",
        date: "6 sep 2026",
        title: "Recursos para participantes",
        description:
            "Materiales y recursos vinculados con el programa y los dispositivos de participación.",
    },
];

type FilterType = "todos" | Content["type"];

const FilterButton = ({
    active,
    children,
    onClick,
}: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
}) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-left text-sm transition ${active
                ? "font-bold text-azul-claro"
                : "text-azul-oscuro/60 hover:text-azul-claro"
                }`}
        >
            {children}
        </button>
    );
};

export default function Materiales() {
    const [selectedType, setSelectedType] =
        useState<FilterType>("todos");
    const [search, setSearch] = useState("");
    const [sortOrder, setSortOrder] =
        useState<"recientes" | "antiguos">("recientes");
    const [selectedContent, setSelectedContent] =
        useState<Content | null>(null);

    // Filtra por tipo y búsqueda, y luego ordena los resultados por fecha.
    const filteredContents = useMemo(() => {
        const filtered = contents.filter((content) => {
            const matchesType =
                selectedType === "todos" ||
                content.type === selectedType;

            const searchText = search.toLowerCase().trim();

            const matchesSearch =
                searchText === "" ||
                content.title.toLowerCase().includes(searchText) ||
                content.description?.toLowerCase().includes(searchText);

            return matchesType && matchesSearch;
        });

        return [...filtered].sort((a, b) => {
            if (!a.date || !b.date) {
                return 0;
            }

            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();

            return sortOrder === "recientes"
                ? dateB - dateA
                : dateA - dateB;
        });
    }, [selectedType, search, sortOrder]);

    return (
        <>
            <title>Materiales | DETS 2026</title>
            <Header />

            <main className="min-h-screen bg-blanco pt-24">

                {/* Encabezado de la sección */}
                <section className="bg-azul-claro/10">
                    <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-azul-claro">
                            Congreso ETS 2026
                        </p>

                        <h1 className="text-4xl font-bold tracking-tight text-azul-oscuro md:text-5xl">
                            Materiales y novedades
                        </h1>

                        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-azul-oscuro/70">
                            Accedé a contenidos relacionados con el Congreso de
                            Educación Técnica Superior.
                        </p>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
                    <div className="grid gap-12 lg:grid-cols-[240px_1fr]">

                        {/* Filtros y búsqueda */}
                        <aside>
                            <div className="lg:sticky lg:top-8">
                                <div>
                                    <label
                                        htmlFor="buscar"
                                        className="mb-3 block text-sm font-bold text-azul-oscuro"
                                    >
                                        Buscar
                                    </label>

                                    <div className="relative">
                                        <input
                                            id="buscar"
                                            type="text"
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            placeholder="Buscar materiales..."
                                            className="w-full border border-azul-oscuro/20 bg-white pl-4 pr-10 py-3 text-sm text-azul-oscuro outline-none transition focus:border-azul-claro"
                                        />
                                        {search && (
                                            <button
                                                type="button"
                                                onClick={() => setSearch("")}
                                                title="Limpiar búsqueda"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-azul-oscuro/50 hover:text-azul-oscuro font-bold text-xs p-1 rounded-full hover:bg-azul-oscuro/5 transition"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Tipos disponibles. Al cambiar el filtro también se cierra el detalle abierto. */}
                                <div className="mt-10">
                                    <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-azul-oscuro">
                                        Tipo de contenido
                                    </h2>

                                    <div className="flex flex-col gap-3">
                                        <FilterButton
                                            active={selectedType === "todos"}
                                            onClick={() => {
                                                setSelectedContent(null);
                                                setSelectedType("todos");
                                            }}
                                        >
                                            Todos
                                        </FilterButton>

                                        <FilterButton
                                            active={selectedType === "novedad"}
                                            onClick={() => {
                                                setSelectedContent(null);
                                                setSelectedType("novedad");
                                            }}
                                        >
                                            Novedades
                                        </FilterButton>

                                        <FilterButton
                                            active={selectedType === "documento"}
                                            onClick={() => {
                                                setSelectedContent(null);
                                                setSelectedType("documento");
                                            }}
                                        >
                                            Documentos
                                        </FilterButton>

                                        <FilterButton
                                            active={selectedType === "video"}
                                            onClick={() => {
                                                setSelectedContent(null);
                                                setSelectedType("video");
                                            }}
                                        >
                                            Videos
                                        </FilterButton>

                                        <FilterButton
                                            active={selectedType === "flyer"}
                                            onClick={() => {
                                                setSelectedContent(null);
                                                setSelectedType("flyer");
                                            }}
                                        >
                                            Flyers
                                        </FilterButton>

                                        <FilterButton
                                            active={selectedType === "foto"}
                                            onClick={() => {
                                                setSelectedContent(null);
                                                setSelectedType("foto");
                                            }}
                                        >
                                            Fotos
                                        </FilterButton>

                                        <FilterButton
                                            active={selectedType === "recurso"}
                                            onClick={() => {
                                                setSelectedContent(null);
                                                setSelectedType("recurso");
                                            }}
                                        >
                                            Recursos
                                        </FilterButton>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <section>
                            {selectedContent ? (

                                /* Detalle del contenido seleccionado */
                                <article>
                                    <div className="mb-8 flex items-center justify-between border-b border-azul-oscuro/15 pb-4">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedContent(null)}
                                            className="text-left text-sm text-azul-oscuro/60 transition hover:text-azul-claro"
                                        >
                                            ← Volver a resultados
                                        </button>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-azul-claro">
                                            {selectedContent.type}
                                            {selectedContent.date &&
                                                ` · ${selectedContent.date}`}
                                        </p>

                                        <h2 className="mt-2 text-3xl font-bold text-azul-oscuro md:text-4xl">
                                            {selectedContent.title}
                                        </h2>

                                        {selectedContent.image && (
                                            <img
                                                src={selectedContent.image}
                                                alt=""
                                                className="mt-8 max-h-[500px] w-full object-cover"
                                            />
                                        )}

                                        {selectedContent.description && (
                                            <p className="mt-8 max-w-3xl text-base leading-relaxed text-azul-oscuro/80">
                                                {selectedContent.description}
                                            </p>
                                        )}

                                        {selectedContent.url && (
                                            <a
                                                href={selectedContent.url}
                                                className="mt-8 inline-flex items-center border border-azul-claro px-5 py-2.5 text-sm font-medium text-azul-claro transition hover:bg-azul-claro hover:text-white"
                                            >
                                                Ver recurso
                                            </a>
                                        )}
                                    </div>
                                </article>
                            ) : (

                                /* Lista de resultados */
                                <>
                                    <div className="mb-8 flex items-center justify-between border-b border-azul-oscuro/15 pb-4">
                                        <h2 className="text-2xl font-bold text-azul-oscuro">
                                            Resultados
                                        </h2>

                                        <select
                                            value={sortOrder}
                                            onChange={(event) =>
                                                setSortOrder(
                                                    event.target.value as
                                                    | "recientes"
                                                    | "antiguos"
                                                )
                                            }
                                            className="border border-azul-oscuro/20 bg-white px-3 py-2 text-sm text-azul-oscuro outline-none focus:border-azul-claro"
                                            aria-label="Ordenar resultados"
                                        >
                                            <option value="recientes">
                                                Más recientes
                                            </option>
                                            <option value="antiguos">
                                                Más antiguos
                                            </option>
                                        </select>
                                    </div>

                                    {filteredContents.length > 0 ? (
                                        <div className="flex flex-col gap-6">
                                            {filteredContents.map((content) => (
                                                <CardMateriales
                                                    key={content.id}
                                                    content={content}
                                                    onView={setSelectedContent}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[320px] items-center justify-center text-center">
                                            <div>
                                                <h3 className="text-lg font-bold text-azul-oscuro">
                                                    {search
                                                        ? "No encontramos contenidos"
                                                        : "Todavía no hay contenidos publicados"}
                                                </h3>

                                                <p className="mt-2 max-w-md text-sm leading-relaxed text-azul-oscuro/60">
                                                    {search
                                                        ? "Probá con otra búsqueda."
                                                        : "Próximamente encontrarás aquí las novedades y recursos del Congreso."}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                </section>
            </main>

            <Footer />
        </>
    );
}
