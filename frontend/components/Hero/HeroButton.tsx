"use client";

import { useRouter } from "next/navigation";

interface HeroButtonProps {
    text: string;
}

const HeroButton = ({ text }: HeroButtonProps) => {
    const router = useRouter();

    const onClickHandler = () => {
        router.push("/participa");
    };

    return (
        <button
            onClick={onClickHandler}
            className="cursor-pointer bg-amarillo text-azul-oscuro font-bold py-2 px-16 rounded mt-8 hover:bg-white transition-colors duration-300"
        >
            {text}
        </button>
    );
};

export default HeroButton;