import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { query } from './db';

export interface AttendanceSheetResult {
  pdfBuffer: Uint8Array;
  filename: string;
  totalInscriptos: number;
  actividadTitulo: string;
}

/**
 * Genera la Planilla Oficial de Asistencia en Sala (PDF Vectorial) para una actividad
 */
export async function generateAttendanceSheetPdf(actividadId: number): Promise<AttendanceSheetResult> {
  // 1. Obtener datos de la actividad y punto de acceso (sala)
  const actRes = await query(
    `SELECT a.id, a.nombre, a.descripcion, a.cupo_maximo, a.horario_inicio, a.horario_fin,
            a.disertante_nombre,
            pa.nombre as sala_nombre, pa.ubicacion_fisica, pa.capacidad_maxima
     FROM actividades a
     LEFT JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
     WHERE a.id = $1`,
    [actividadId]
  );

  if (actRes.rows.length === 0) {
    throw new Error(`Actividad con ID ${actividadId} no encontrada.`);
  }

  const act = actRes.rows[0];

  // 2. Obtener lista de asistentes inscriptos
  const asistRes = await query(
    `SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.email,
            COALESCE(ro.nombre, 'Participante') as rol_nombre,
            ai.estado
     FROM actividad_inscripciones ai
     JOIN usuarios u ON ai.usuario_id = u.id
     LEFT JOIN roles ro ON u.rol_principal_id = ro.id
     WHERE ai.actividad_id = $1 AND ai.estado IN ('INSCRIPTO', 'CONFIRMADO')
     ORDER BY u.apellido ASC, u.nombre ASC`,
    [actividadId]
  );

  const inscriptos = asistRes.rows;

  // 3. Crear documento PDF (A4 Vertical: 595.28 pt ancho x 841.89 pt alto)
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const colorPrimary = rgb(0, 0.22, 0.396);    // #003865
  const colorAccent = rgb(0, 0.337, 0.569);    // #005691
  const colorDark = rgb(0.12, 0.16, 0.23);     // #1f2937
  const colorGray = rgb(0.4, 0.45, 0.5);       // #6b7280
  const colorLightBg = rgb(0.96, 0.97, 0.98);  // #f3f4f6
  const colorLine = rgb(0.85, 0.88, 0.92);     // #d1d5db

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const rowsPerPage = 22;
  const totalPages = Math.max(1, Math.ceil(inscriptos.length / rowsPerPage));

  // Formatear fechas y horas
  const fechaStr = act.horario_inicio ? new Date(act.horario_inicio).toLocaleDateString('es-AR') : '06/11/2026';
  const horaInicioStr = act.horario_inicio ? new Date(act.horario_inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '09:00';
  const horaFinStr = act.horario_fin ? new Date(act.horario_fin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '10:30';
  const disertanteStr = act.disertante_nombre || 'Equipo Docente DETS';

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = doc.addPage([pageWidth, pageHeight]);

    // ENCABEZADO INSTITUCIONAL
    page.drawRectangle({
      x: margin,
      y: pageHeight - 75,
      width: contentWidth,
      height: 45,
      color: colorPrimary,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
    } as any);

    page.drawText('1er CONGRESO DE EDUCACIÓN TÉCNICA SUPERIOR (ETS 2026)', {
      x: margin + 14,
      y: pageHeight - 50,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText('DIRECCIÓN DE EDUCACIÓN TÉCNICA SUPERIOR · MINISTERIO DE EDUCACIÓN GCABA', {
      x: margin + 14,
      y: pageHeight - 64,
      size: 8,
      font: fontRegular,
      color: rgb(0.85, 0.9, 0.95),
    });

    // BANDA SUBTÍTULO
    page.drawRectangle({
      x: margin,
      y: pageHeight - 135,
      width: contentWidth,
      height: 56,
      color: colorLightBg,
      borderColor: colorLine,
      borderWidth: 1,
    });

    page.drawText(`PLANILLA DE ASISTENCIA Y FIRMAS EN SALA`, {
      x: margin + 12,
      y: pageHeight - 93,
      size: 11,
      font: fontBold,
      color: colorAccent,
    });

    const tituloCorto = act.nombre.length > 60 ? act.nombre.substring(0, 57) + '...' : act.nombre;
    page.drawText(`Actividad: ${tituloCorto}`, {
      x: margin + 12,
      y: pageHeight - 108,
      size: 9.5,
      font: fontBold,
      color: colorDark,
    });

    page.drawText(`Sala / Recinto: ${act.sala_nombre || 'Auditorio General'}  |  Fecha: ${fechaStr} (${horaInicioStr} a ${horaFinStr} hs)  |  Disertante: ${disertanteStr}`, {
      x: margin + 12,
      y: pageHeight - 124,
      size: 8,
      font: fontRegular,
      color: colorGray,
    });

    // CABECERA DE LA TABLA
    const tableTop = pageHeight - 155;
    const colX = {
      num: margin,
      dni: margin + 30,
      nombre: margin + 115,
      rol: margin + 320,
      firma: margin + 415,
    };
    const colWidth = {
      num: 30,
      dni: 85,
      nombre: 205,
      rol: 95,
      firma: 108,
    };

    // Fondo cabecera tabla
    page.drawRectangle({
      x: margin,
      y: tableTop - 18,
      width: contentWidth,
      height: 20,
      color: colorAccent,
    });

    const headerTextY = tableTop - 13;
    page.drawText('Nº', { x: colX.num + 8, y: headerTextY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('DNI / Pasaporte', { x: colX.dni + 6, y: headerTextY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('Apellido y Nombre', { x: colX.nombre + 6, y: headerTextY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('Estamento / Rol', { x: colX.rol + 6, y: headerTextY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('Firma del Asistente', { x: colX.firma + 10, y: headerTextY, size: 8, font: fontBold, color: rgb(1, 1, 1) });

    // FILAS DE ASISTENTES
    const startIndex = pageNum * rowsPerPage;
    const endIndex = Math.min(inscriptos.length, startIndex + rowsPerPage);
    let currentY = tableTop - 20;
    const rowHeight = 25;

    for (let i = startIndex; i < endIndex; i++) {
      const p = inscriptos[i];
      const isEven = (i - startIndex) % 2 === 0;

      page.drawRectangle({
        x: margin,
        y: currentY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: isEven ? rgb(1, 1, 1) : rgb(0.98, 0.98, 0.99),
        borderColor: colorLine,
        borderWidth: 0.5,
      });

      const textY = currentY - 16;
      page.drawText(`${i + 1}`, { x: colX.num + 6, y: textY, size: 8, font: fontRegular, color: colorGray });
      page.drawText(`${p.dni_pasaporte}`, { x: colX.dni + 6, y: textY, size: 8.5, font: fontBold, color: colorDark });
      
      const apeNom = `${p.apellido}, ${p.nombre}`.substring(0, 32);
      page.drawText(apeNom, { x: colX.nombre + 6, y: textY, size: 8.5, font: fontRegular, color: colorDark });

      const rolTxt = (p.rol_nombre || 'Asistente').substring(0, 16);
      page.drawText(rolTxt, { x: colX.rol + 6, y: textY, size: 7.5, font: fontRegular, color: colorGray });

      // Línea de firma
      page.drawLine({
        start: { x: colX.firma + 10, y: currentY - 20 },
        end: { x: colX.firma + colWidth.firma - 10, y: currentY - 20 },
        thickness: 0.5,
        color: colorLine,
      });

      currentY -= rowHeight;
    }

    // Si la lista está vacía en la página 1
    if (inscriptos.length === 0) {
      page.drawText('No se registran participantes inscriptos para esta actividad en este momento.', {
        x: margin + 30,
        y: currentY - 30,
        size: 9.5,
        font: fontRegular,
        color: colorGray,
      });
      currentY -= 50;
    }

    // PIE DE PÁGINA Y RECUADRO DE FIRMA DEL COORDINADOR
    const footerY = 55;

    page.drawLine({
      start: { x: margin, y: footerY + 30 },
      end: { x: pageWidth - margin, y: footerY + 30 },
      thickness: 1,
      color: colorLine,
    });

    page.drawText(`Firma del Coordinador de Sala: _____________________________________`, {
      x: margin + 10,
      y: footerY + 12,
      size: 8.5,
      font: fontRegular,
      color: colorDark,
    });

    page.drawText(`Aclaración: _____________________________`, {
      x: margin + 330,
      y: footerY + 12,
      size: 8.5,
      font: fontRegular,
      color: colorDark,
    });

    page.drawText(`Total Inscriptos: ${inscriptos.length}  |  Página ${pageNum + 1} de ${totalPages}  |  Sistema Congreso ETS 2026`, {
      x: margin + 10,
      y: footerY - 5,
      size: 7.5,
      font: fontRegular,
      color: colorGray,
    });
  }

  const pdfBytes = await doc.save();
  const safeTitle = act.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const filename = `Planilla_Asistencia_Actividad_${act.id}_${safeTitle}.pdf`;

  return {
    pdfBuffer: pdfBytes,
    filename,
    totalInscriptos: inscriptos.length,
    actividadTitulo: act.nombre,
  };
}
