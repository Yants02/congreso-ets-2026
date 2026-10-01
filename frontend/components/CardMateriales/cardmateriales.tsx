// CardMateriales.tsx — Tarjeta para mostrar contenidos de Materiales

type ContentType =
    | "novedad"
    | "video"
    | "flyer"
    | "foto"
    | "documento"
    | "recurso";

export type Content = {
    id: string;
    type: ContentType;
    title: string;
    date?: string;
    description?: string;
    image?: string;
    url?: string;
    videoUrl?: string;
    fileUrl?: string;
    images?: string[];
};

type CardMaterialesProps = {
    content: Content;
    onView?: (content: Content) => void;
};

// Si se agrega un nuevo tipo de contenido, también debe agregarse su nombre acá
const typeLabels: Record<ContentType, string> = {
    novedad: "Novedad",
    video: "Video",
    flyer: "Flyer",
    foto: "Foto",
    documento: "Documento",
    recurso: "Recurso",
};

export default function CardMateriales({
    content,
    onView,
}: CardMaterialesProps) {
    const { type, date, title, description, image, url } = content;

    const actionLabel = type === "documento" ? "Descargar" : "Ver";

    const handleClick = () => {
        if (onView) {
            onView(content);
        }
    };

    return (
        <article className="grid overflow-hidden border border-azul-oscuro/15 bg-white md:grid-cols-[240px_1fr]">

            {/* Imagen o identificación del tipo de contenido */}
            <div className="flex min-h-[190px] items-center justify-center bg-azul-oscuro">
                {image ? (
                    <img
                        src={image}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span className="text-sm font-bold uppercase tracking-wide text-white">
                        {typeLabels[type]}
                    </span>
                )}
            </div>

            <div className="p-6 md:p-8">
                <p className="text-xs font-bold uppercase tracking-wide text-azul-claro">
                    {typeLabels[type]}
                    {date && ` · ${date}`}
                </p>

                <h3 className="mt-2 text-xl font-bold text-azul-oscuro md:text-2xl">
                    {title}
                </h3>

                {description && (
                    <p className="mt-3 max-w-2xl leading-relaxed text-azul-oscuro/70">
                        {description}
                    </p>
                )}

                {/* La acción cambia según si el contenido se abre en detalle o tiene un enlace */}
                {onView ? (
                    <button
                        type="button"
                        onClick={handleClick}
                        className="mt-6 inline-flex items-center border border-azul-claro px-5 py-2.5 text-sm font-medium text-azul-claro transition hover:bg-azul-claro hover:text-white"
                    >
                        {actionLabel}
                    </button>
                ) : url ? (
                    <a
                        href={url}
                        className="mt-6 inline-flex items-center border border-azul-claro px-5 py-2.5 text-sm font-medium text-azul-claro transition hover:bg-azul-claro hover:text-white"
                    >
                        {actionLabel}
                    </a>
                ) : null}
            </div>
        </article>
    );
}