import Image, { StaticImageData } from "next/image";

interface CardProps {
    cardImg: StaticImageData | string;
    title: string;
    description: string;
    pdfUrl?: string;
    badge?: string;
}


const Card = ({ cardImg, title, description, pdfUrl, badge }: CardProps) => {
    // Separa conectores como "/" o "-" con espacios anterior y posterior para que desciendan a la línea inferior sin división silábica
    const formattedTitle = title ? title.replace(/\s*([/-])\s*/g, " $1 ") : "";

    return (
        <div className="bg-[#FCFCFC] rounded-xl shadow-sm border border-[#1D3343]/20 p-6 flex flex-col h-full transition-all duration-300 hover:shadow-md hover:-translate-y-2 select-none">
           
           <div className="flex items-start gap-4 mb-4 min-h-[56px]">
                <div className="w-14 h-14 rounded-full flex-shrink-0 relative overflow-hidden bg-white border border-gray-100 shadow-inner flex items-center justify-center p-2.5 mt-0.5">
                    {typeof cardImg === 'string' ? (
                        <img 
                            src={cardImg} 
                            alt={title} 
                            className="w-full h-full object-contain pointer-events-none" 
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/assets/icons/card1.svg';
                            }}
                        />
                    ) : (
                        <Image src={cardImg} alt={title} fill className="object-contain p-1 pointer-events-none"/>
                    )}
                </div>
                
                <div className="min-w-0 flex-1">
                    {badge && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#035C80] bg-blue-50 px-2 py-0.5 rounded-sm mb-1">
                            {badge}
                        </span>
                    )}
                    <h3 className="font-bold text-lg text-[#1D3343] leading-snug break-words min-w-0 flex-1 hyphens-none">{formattedTitle}</h3>
                </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
            
            <div className="mt-auto pt-2">
                {pdfUrl && (
                    <a 
                    href={pdfUrl || "#"}
                    target={pdfUrl ? "_blank" : "_self"} 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-bold text-[#035C80] hover:text-[#FFCD02] transition-colors cursor-pointer">
                        Saber más &rarr;
                    </a>
                )}
            </div>
        </div>
    )
    
}


export default Card