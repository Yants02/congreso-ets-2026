// NavLinks.tsx — Secciones de la barra de navegación

import Link from "next/link";

// Secciones disponibles en la navegación principal
const links = [
    { href: "/", label: "Inicio" },
    { href: "/#congreso", label: "El Congreso" },
    { href: "/#programa", label: "Programa" },
    { href: "/participa", label: "Participa" },
    { href: "/contacto", label: "Contacto" },
    { href: "/materiales", label: "Materiales" },
];

interface NavLinksProps {
    mobile?: boolean;
    onLinkClick?: () => void;
}

const NavLinks = ({ mobile = false, onLinkClick }: NavLinksProps) => {
    return (
        <div className={
            mobile
                ? "flex flex-col gap-3"
                : "hidden items-center gap-10 xl:flex"
        }>
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    onClick={onLinkClick}
                    className={
                        mobile
                            ? "py-2 font-bold text-gray-800 transition hover:text-amber-300"
                            : "font-bold text-gray-800 transition hover:text-amber-300"
                    }
                >
                    {link.label}
                </Link>
            ))}
        </div>
    );
};

export default NavLinks;