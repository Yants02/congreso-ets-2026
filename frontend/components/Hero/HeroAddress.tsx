interface HeroAddressProps {
    text: React.ReactNode;
}

const HeroAddress = ({ text }: HeroAddressProps) => {
    return (
        <p className="pt-6 text-sm font-normal tracking-wide text-white/80 md:text-base">
            {text}
        </p>
    );
};

export default HeroAddress;