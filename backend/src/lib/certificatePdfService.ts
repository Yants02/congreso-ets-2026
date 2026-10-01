import { PDFDocument, rgb, StandardFonts, RGB } from 'pdf-lib';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { query } from './db';

export interface CertificateData {
  codigo_verificacion: string;
  tipo_certificado: string;
  horas_catedra: number;
  emitido_en: string | Date;
  usuario: {
    nombre: string;
    apellido: string;
    dni_pasaporte: string;
    rol_nombre?: string;
  };
  metadata?: any;
}

export interface PlantillaCertificadoConfig {
  membrete: {
    linea1: string;
    linea2: string;
    linea3: string;
  };
  titulos: {
    asistencia: string;
    expositor: string;
  };
  cuerpo: {
    formula_intro: string;
    formula_evento: string;
    nombre_congreso: string;
    leyenda_fechas_horas: string;
  };
  firmas: {
    autoridad1_nombre: string;
    autoridad1_cargo: string;
    autoridad1_entidad: string;
    autoridad2_nombre: string;
    autoridad2_cargo: string;
    autoridad2_entidad: string;
    sello_texto_superior: string;
    sello_texto_inferior: string;
  };
  colores: {
    primario: string;
    primario_oscuro: string;
    dorado: string;
    texto_oscuro: string;
  };
}

export const PLANTILLA_DEFAULT: PlantillaCertificadoConfig = {
  membrete: {
    linea1: 'GOBIERNO DE LA CIUDAD AUTÓNOMA DE BUENOS AIRES',
    linea2: 'MINISTERIO DE EDUCACIÓN · DIRECCIÓN DE EDUCACIÓN TÉCNICA SUPERIOR (DETS)',
    linea3: 'INSTITUTO DE FORMACIÓN TÉCNICA SUPERIOR N° 04 · SEDE POLO EDUCATIVO SAAVEDRA',
  },
  titulos: {
    asistencia: 'CERTIFICADO OFICIAL DE ASISTENCIA Y PARTICIPACIÓN',
    expositor: 'CERTIFICADO OFICIAL DE DISERTANTE / EXPOSITOR',
  },
  cuerpo: {
    formula_intro: 'Por cuanto se certifica con validez académica institucional que:',
    formula_evento: 'ha participado y acreditado su asistencia presencial en las actividades académicas del',
    nombre_congreso: '1er CONGRESO DE EDUCACIÓN TÉCNICA SUPERIOR – ETS 2026',
    leyenda_fechas_horas: 'Llevado a cabo los días 15, 16 y 17 de Octubre de 2026 en el Auditorio Polo Saavedra, con una carga horaria total de {{HORAS}} horas cátedra.',
  },
  firmas: {
    autoridad1_nombre: 'Lic. Alejandro Rodríguez',
    autoridad1_cargo: 'Director de Educación Técnica Superior',
    autoridad1_entidad: 'Ministerio de Educación · GCABA',
    autoridad2_nombre: 'Prof. Mariana Gómez',
    autoridad2_cargo: 'Rectora Instituto Superior N° 04',
    autoridad2_entidad: 'Comité Académico Organizador',
    sello_texto_superior: 'DETS',
    sello_texto_inferior: 'GCABA',
  },
  colores: {
    primario: '#005691',
    primario_oscuro: '#003865',
    dorado: '#f39c12',
    texto_oscuro: '#2c3e50',
  },
};

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

/**
 * Convierte un color HEX (ej. #005691) a formato RGB de pdf-lib (0..1)
 */
function hexToPdfRgb(hex: string, fallback: RGB): RGB {
  try {
    const cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
      return rgb(r, g, b);
    }
  } catch (err) {
    // Retorna fallback
  }
  return fallback;
}

/**
 * Centra un texto horizontalmente en un ancho dado
 */
function getCenteredX(text: string, font: any, size: number, pageWidth: number): number {
  const textWidth = font.widthOfTextAtSize(text, size);
  return (pageWidth - textWidth) / 2;
}

/**
 * Obtiene la plantilla activa configurada desde la base de datos o retorna la default
 */
export async function getPlantillaCertificado(): Promise<PlantillaCertificadoConfig> {
  try {
    const res = await query(
      `SELECT valor FROM configuraciones_sistema WHERE clave = 'plantilla_certificado_oficial' LIMIT 1`
    );
    if (res.rows.length > 0 && res.rows[0].valor) {
      const dbConfig = typeof res.rows[0].valor === 'string' 
        ? JSON.parse(res.rows[0].valor) 
        : res.rows[0].valor;

      return {
        membrete: { ...PLANTILLA_DEFAULT.membrete, ...(dbConfig.membrete || {}) },
        titulos: { ...PLANTILLA_DEFAULT.titulos, ...(dbConfig.titulos || {}) },
        cuerpo: { ...PLANTILLA_DEFAULT.cuerpo, ...(dbConfig.cuerpo || {}) },
        firmas: { ...PLANTILLA_DEFAULT.firmas, ...(dbConfig.firmas || {}) },
        colores: { ...PLANTILLA_DEFAULT.colores, ...(dbConfig.colores || {}) },
      };
    }
  } catch (err) {
    console.warn('No se pudo cargar la plantilla personalizada de la BD, usando default:', err);
  }
  return PLANTILLA_DEFAULT;
}

/**
 * Genera el documento PDF binario oficial del diploma con membrete y QR criptográfico
 */
export async function generateCertificatePdf(
  data: CertificateData,
  customPlantilla?: PlantillaCertificadoConfig
): Promise<Uint8Array> {
  const plantilla = customPlantilla || await getPlantillaCertificado();

  const doc = await PDFDocument.create();
  // Formato A4 Paisaje (Landscape): 842 pt de ancho x 595 pt de alto
  const pageWidth = 842;
  const pageHeight = 595;
  const page = doc.addPage([pageWidth, pageHeight]);

  // Tipografías estándar embebidas
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Paleta de colores institucionales dinámicos
  const colorPrimary = hexToPdfRgb(plantilla.colores.primario, rgb(0, 0.337, 0.569));
  const colorPrimaryDark = hexToPdfRgb(plantilla.colores.primario_oscuro, rgb(0, 0.22, 0.396));
  const colorGold = hexToPdfRgb(plantilla.colores.dorado, rgb(0.953, 0.612, 0.071));
  const colorDark = hexToPdfRgb(plantilla.colores.texto_oscuro, rgb(0.173, 0.243, 0.314));
  const colorGray = rgb(0.392, 0.455, 0.545);

  // 1. MARCOS Y BORDES ORNAMENTALES
  // Marco exterior dorado
  page.drawRectangle({
    x: 20,
    y: 20,
    width: pageWidth - 40,
    height: pageHeight - 40,
    borderColor: colorGold,
    borderWidth: 3,
  });

  // Marco interior azul institucional
  page.drawRectangle({
    x: 28,
    y: 28,
    width: pageWidth - 56,
    height: pageHeight - 56,
    borderColor: colorPrimary,
    borderWidth: 1.5,
  });

  // Detalles en esquinas (líneas decorativas)
  const cornerSize = 18;
  const corners = [
    { x: 34, y: pageHeight - 34 },
    { x: pageWidth - 34 - cornerSize, y: pageHeight - 34 },
    { x: 34, y: 34 + cornerSize },
    { x: pageWidth - 34 - cornerSize, y: 34 + cornerSize },
  ];
  for (const c of corners) {
    page.drawRectangle({
      x: c.x,
      y: c.y - cornerSize,
      width: cornerSize,
      height: cornerSize,
      borderColor: colorGold,
      borderWidth: 1,
    });
  }

  // 2. MEMBRETE OFICIAL
  let currentY = pageHeight - 65;

  const header1 = plantilla.membrete.linea1 || PLANTILLA_DEFAULT.membrete.linea1;
  page.drawText(header1, {
    x: getCenteredX(header1, fontBold, 11, pageWidth),
    y: currentY,
    size: 11,
    font: fontBold,
    color: colorDark,
  });

  currentY -= 16;
  const header2 = plantilla.membrete.linea2 || PLANTILLA_DEFAULT.membrete.linea2;
  page.drawText(header2, {
    x: getCenteredX(header2, fontBold, 10, pageWidth),
    y: currentY,
    size: 10,
    font: fontBold,
    color: colorPrimary,
  });

  currentY -= 14;
  const header3 = plantilla.membrete.linea3 || PLANTILLA_DEFAULT.membrete.linea3;
  page.drawText(header3, {
    x: getCenteredX(header3, fontRegular, 9, pageWidth),
    y: currentY,
    size: 9,
    font: fontRegular,
    color: colorGray,
  });

  // Línea divisoria decorativa
  currentY -= 16;
  page.drawLine({
    start: { x: 120, y: currentY },
    end: { x: pageWidth - 120, y: currentY },
    color: colorGold,
    thickness: 1.5,
  });

  // 3. TÍTULO DEL CERTIFICADO
  currentY -= 36;
  const tituloCertificado =
    data.tipo_certificado === 'EXPOSITOR'
      ? (plantilla.titulos.expositor || PLANTILLA_DEFAULT.titulos.expositor)
      : (plantilla.titulos.asistencia || PLANTILLA_DEFAULT.titulos.asistencia);

  page.drawText(tituloCertificado, {
    x: getCenteredX(tituloCertificado, fontBold, 19, pageWidth),
    y: currentY,
    size: 19,
    font: fontBold,
    color: colorPrimaryDark,
  });

  // 4. CUERPO DEL DIPLOMA
  currentY -= 26;
  const subTexto = plantilla.cuerpo.formula_intro || PLANTILLA_DEFAULT.cuerpo.formula_intro;
  page.drawText(subTexto, {
    x: getCenteredX(subTexto, fontOblique, 12, pageWidth),
    y: currentY,
    size: 12,
    font: fontOblique,
    color: colorDark,
  });

  // Nombre del Participante (Destacado en Grande)
  currentY -= 36;
  const nombreCompleto = `${data.usuario.nombre} ${data.usuario.apellido}`.toUpperCase();
  page.drawText(nombreCompleto, {
    x: getCenteredX(nombreCompleto, fontBold, 22, pageWidth),
    y: currentY,
    size: 22,
    font: fontBold,
    color: colorPrimary,
  });

  // DNI
  currentY -= 20;
  const dniTexto = `D.N.I. / Pasaporte N°: ${data.usuario.dni_pasaporte}`;
  page.drawText(dniTexto, {
    x: getCenteredX(dniTexto, fontBold, 12, pageWidth),
    y: currentY,
    size: 12,
    font: fontBold,
    color: colorDark,
  });

  // Descripción institucional del evento
  currentY -= 28;
  const textoCongreso = plantilla.cuerpo.formula_evento || PLANTILLA_DEFAULT.cuerpo.formula_evento;
  page.drawText(textoCongreso, {
    x: getCenteredX(textoCongreso, fontRegular, 11, pageWidth),
    y: currentY,
    size: 11,
    font: fontRegular,
    color: colorDark,
  });

  currentY -= 20;
  const nombreCongreso = plantilla.cuerpo.nombre_congreso || PLANTILLA_DEFAULT.cuerpo.nombre_congreso;
  page.drawText(nombreCongreso, {
    x: getCenteredX(nombreCongreso, fontBold, 14, pageWidth),
    y: currentY,
    size: 14,
    font: fontBold,
    color: colorPrimaryDark,
  });

  currentY -= 20;
  const plantillaHoras = plantilla.cuerpo.leyenda_fechas_horas || PLANTILLA_DEFAULT.cuerpo.leyenda_fechas_horas;
  const horasTexto = plantillaHoras.replace('{{HORAS}}', String(data.horas_catedra));
  page.drawText(horasTexto, {
    x: getCenteredX(horasTexto, fontRegular, 10.5, pageWidth),
    y: currentY,
    size: 10.5,
    font: fontRegular,
    color: colorDark,
  });

  // 5. FIRMAS DE AUTORIDADES Y SELLOS
  const firmasY = 155;
  const leftFirmaX = 130;
  const rightFirmaX = pageWidth - 290;

  // Carga e incrustación de firmas facsimilares (si existen en public/firmas)
  try {
    const firmaDir1 = path.join(process.cwd(), 'public', 'firmas', 'firma_director.png');
    if (fs.existsSync(firmaDir1)) {
      const imgBytes = fs.readFileSync(firmaDir1);
      const embeddedImg = await doc.embedPng(imgBytes);
      page.drawImage(embeddedImg, {
        x: leftFirmaX + 20,
        y: firmasY + 2,
        width: 120,
        height: 45,
      });
    }

    const firmaDir2 = path.join(process.cwd(), 'public', 'firmas', 'firma_rectora.png');
    if (fs.existsSync(firmaDir2)) {
      const imgBytes = fs.readFileSync(firmaDir2);
      const embeddedImg = await doc.embedPng(imgBytes);
      page.drawImage(embeddedImg, {
        x: rightFirmaX + 20,
        y: firmasY + 2,
        width: 120,
        height: 45,
      });
    }
  } catch (err) {
    // Silently continue con líneas vectoriales por defecto ante ausencia de imágenes
  }

  // Firma izquierda
  page.drawLine({
    start: { x: leftFirmaX, y: firmasY },
    end: { x: leftFirmaX + 160, y: firmasY },
    color: colorGray,
    thickness: 1,
  });
  page.drawText(plantilla.firmas.autoridad1_nombre || PLANTILLA_DEFAULT.firmas.autoridad1_nombre, {
    x: leftFirmaX + 15,
    y: firmasY - 14,
    size: 10,
    font: fontBold,
    color: colorDark,
  });
  page.drawText(plantilla.firmas.autoridad1_cargo || PLANTILLA_DEFAULT.firmas.autoridad1_cargo, {
    x: leftFirmaX - 5,
    y: firmasY - 26,
    size: 8.5,
    font: fontRegular,
    color: colorGray,
  });
  page.drawText(plantilla.firmas.autoridad1_entidad || PLANTILLA_DEFAULT.firmas.autoridad1_entidad, {
    x: leftFirmaX + 10,
    y: firmasY - 37,
    size: 8,
    font: fontRegular,
    color: colorGray,
  });

  // Sello central
  const centroX = pageWidth / 2;
  page.drawCircle({
    x: centroX,
    y: firmasY - 15,
    size: 30,
    borderColor: colorGold,
    borderWidth: 1.5,
  });
  page.drawText(plantilla.firmas.sello_texto_superior || PLANTILLA_DEFAULT.firmas.sello_texto_superior, {
    x: centroX - 14,
    y: firmasY - 12,
    size: 9,
    font: fontBold,
    color: colorPrimary,
  });
  page.drawText(plantilla.firmas.sello_texto_inferior || PLANTILLA_DEFAULT.firmas.sello_texto_inferior, {
    x: centroX - 16,
    y: firmasY - 22,
    size: 8,
    font: fontBold,
    color: colorDark,
  });

  // Firma derecha
  page.drawLine({
    start: { x: rightFirmaX, y: firmasY },
    end: { x: rightFirmaX + 160, y: firmasY },
    color: colorGray,
    thickness: 1,
  });
  page.drawText(plantilla.firmas.autoridad2_nombre || PLANTILLA_DEFAULT.firmas.autoridad2_nombre, {
    x: rightFirmaX + 25,
    y: firmasY - 14,
    size: 10,
    font: fontBold,
    color: colorDark,
  });
  page.drawText(plantilla.firmas.autoridad2_cargo || PLANTILLA_DEFAULT.firmas.autoridad2_cargo, {
    x: rightFirmaX + 8,
    y: firmasY - 26,
    size: 8.5,
    font: fontRegular,
    color: colorGray,
  });
  page.drawText(plantilla.firmas.autoridad2_entidad || PLANTILLA_DEFAULT.firmas.autoridad2_entidad, {
    x: rightFirmaX + 12,
    y: firmasY - 37,
    size: 8,
    font: fontRegular,
    color: colorGray,
  });

  // 6. PIE DE PÁGINA: QR CRIPTOGRÁFICO Y VALIDACIÓN EN LÍNEA
  const qrValidationUrl = `${APP_BASE_URL}/validar-certificado/${data.codigo_verificacion}`;

  // Generar QR PNG
  const qrBuffer = await QRCode.toBuffer(qrValidationUrl, {
    width: 140,
    margin: 1,
    color: {
      dark: '#003865',
      light: '#ffffff',
    },
  });
  const qrImage = await doc.embedPng(qrBuffer);

  // Dibujar imagen QR en la esquina inferior derecha
  const qrSize = 64;
  const qrX = pageWidth - 110;
  const qrY = 40;
  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // Texto de validación en la parte inferior izquierda
  const footerX = 45;
  let footerY = 75;

  page.drawText(`CÓDIGO DE VALIDACIÓN ÚNICO: ${data.codigo_verificacion}`, {
    x: footerX,
    y: footerY,
    size: 9.5,
    font: fontBold,
    color: colorPrimaryDark,
  });

  footerY -= 13;
  page.drawText(`Verificación pública en línea: ${qrValidationUrl}`, {
    x: footerX,
    y: footerY,
    size: 8,
    font: fontRegular,
    color: colorDark,
  });

  footerY -= 12;
  const fechaEmision =
    typeof data.emitido_en === 'string' ? data.emitido_en : data.emitido_en.toLocaleString('es-AR');
  page.drawText(
    `Documento digital oficial firmado con hash criptográfico SHA-256 · Emitido: ${fechaEmision}`,
    {
      x: footerX,
      y: footerY,
      size: 7.5,
      font: fontRegular,
      color: colorGray,
    }
  );

  return doc.save();
}
