import Image, { StaticImageData } from "next/image";

interface HeroHeadingProps {
    text: string;
    src: StaticImageData;
}

const HeroHeading = ({ src, text }: HeroHeadingProps) => {
    return (
        <div className="flex items-center justify-center gap-2 pt-5 md:gap-3">
            <h1 className="max-w-[360px] text-center text-4xl font-bold uppercase leading-tight md:text-5xl">
                {text}
            </h1>

            <Image
                src={src}
                alt="Logo del Congreso de Educación Técnica Superior"
                width={300}
                height={200}
                priority
                className="w-52 md:w-60"
            />
        </div>
    );
};

export default HeroHeading;