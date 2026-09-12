import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { TransferReport } from "./report-data";
import { editableCopyNotice, reportDisclaimer } from "./report-data";

export type ReportFonts = { regular: Uint8Array; bold: Uint8Array };
export type ReportFormat = "pdf" | "docx";
let fontsPromise: Promise<ReportFonts> | undefined;
export function loadReportFonts(): Promise<ReportFonts> {
  return (fontsPromise ||= Promise.all(
    ["Regular", "Bold"].map(async (weight) => {
      const res = await fetch(`/fonts/Sarabun-${weight}.ttf`);
      if (!res.ok)
        throw new Error("โหลดแบบอักษรไม่สำเร็จ กรุณาลองดาวน์โหลดอีกครั้ง");
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 1000 || bytes[0] !== 0 || bytes[1] !== 1)
        throw new Error("ไฟล์แบบอักษรไม่ถูกต้อง กรุณาลองใหม่");
      return bytes;
    }),
  )
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error) => {
      fontsPromise = undefined;
      throw error;
    }));
}
const dateLabel = (s: string) =>
  new Date(s).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
// Thai has no spaces between words. Insert legal break opportunities for PDF layout.
const segmenter = new Intl.Segmenter("th", { granularity: "word" });
function pdfText(s: string): Content[] {
  const words = [...segmenter.segment(s)].flatMap(({ segment }) =>
    segment.length > 28 && /^[\w/-]+$/.test(segment)
      ? segment.match(/.{1,24}/g)!
      : [segment],
  );
  // Sarabun has no visible ZWSP glyph. A zero-size inline keeps it invisible
  // while pdfmake uses it as a word boundary, without modifying source quotes.
  return words.flatMap((text, i): Content[] =>
    i ? [{ text: "\u200b", fontSize: 0 }, { text }] : [{ text }],
  );
}

export function pdfDefinition(report: TransferReport): TDocumentDefinitions {
  const content: Content[] = [
    {
      text: pdfText(report.title),
      fontSize: 20,
      bold: true,
      color: "#111827",
      margin: [0, 0, 0, 10],
    },
    {
      text: pdfText(report.status),
      bold: true,
      color: "#92400e",
      margin: [0, 0, 0, 10],
    },
    ...report.meta.map((text): Content => ({
      text: pdfText(text),
      margin: [0, 0, 0, 5],
    })),
    {
      text: pdfText(reportDisclaimer),
      margin: [0, 10, 0, 8],
      color: "#475569",
    },
  ];
  for (const section of report.sections) {
    const sectionStart = content.length;
    content.push({
      text: pdfText(section.title),
      fontSize: 14,
      bold: true,
      color: "#115e59",
      margin: [0, 14, 0, 7],
      ...(section.pageBreak ? { pageBreak: "before" as const } : {}),
    });
    for (const text of section.paragraphs || [])
      content.push({ text: pdfText(text), margin: [0, 0, 0, 6] });
    if (section.table) {
      if (!section.table.rows.length) {
        content.push({ text: "ไม่มีรายการในส่วนนี้", color: "#64748b" });
      } else {
        content.push({
          fontSize: 10,
          table: {
            headerRows: 1,
            dontBreakRows: section.table.rows.every((row) =>
              row.every(
                (cell) => cell.length < 600 && cell.split("\n").length < 10,
              ),
            ),
            widths: section.table.headers.map(() => "*"),
            body: [
              section.table.headers.map((text) => ({
                text: pdfText(text),
                bold: true,
                fillColor: "#e8f3f0",
              })),
              ...section.table.rows.map((row) =>
                row.map((text) => ({ text: pdfText(text || "ยังไม่ระบุ") })),
              ),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#cbd5e1",
            vLineColor: () => "#cbd5e1",
            paddingLeft: () => 7,
            paddingRight: () => 7,
            paddingTop: () => 7,
            paddingBottom: () => 7,
          },
        });
      }
    }
    if (!section.table && (section.paragraphs || []).join("").length < 1600) {
      content.push({ stack: content.splice(sectionStart), unbreakable: true });
    }
  }
  return {
    info: {
      title: report.title,
      author: "OVEC Mapping",
      subject: report.status,
      creator: "OVEC Mapping",
    },
    pageSize: "A4",
    pageOrientation: report.landscape ? "landscape" : "portrait",
    pageMargins: [36, 52, 36, 55],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 11,
      lineHeight: 1.15,
      color: "#1e293b",
    },
    header: {
      text: "OVEC Mapping  |  TPQI × อาชีวศึกษา",
      font: "Sarabun",
      fontSize: 9,
      color: "#475569",
      margin: [36, 22, 36, 0],
    },
    footer: (page, pages) => ({
      columns: [
        {
          text: `จัดทำ ${dateLabel(report.generatedAt)} (เวลาไทย)`,
          width: "*",
        },
        { text: `หน้า ${page} / ${pages}`, alignment: "right", width: "auto" },
      ],
      margin: [36, 20, 36, 0],
      fontSize: 8,
      color: "#64748b",
    }),
    content,
  };
}
export async function createReportPdf(
  report: TransferReport,
  fonts: ReportFonts,
): Promise<Blob> {
  const [{ default: pdfMake }, { Buffer }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("buffer"),
  ]);
  const vfs = {
    "Sarabun-Regular.ttf": Buffer.from(fonts.regular).toString("base64"),
    "Sarabun-Bold.ttf": Buffer.from(fonts.bold).toString("base64"),
  };
  const definition = {
    Sarabun: {
      normal: "Sarabun-Regular.ttf",
      bold: "Sarabun-Bold.ttf",
      italics: "Sarabun-Regular.ttf",
      bolditalics: "Sarabun-Bold.ttf",
    },
  };
  return new Promise((resolve, reject) => {
    try {
      pdfMake
        .createPdf(pdfDefinition(report), undefined, definition, vfs)
        .getBlob(resolve);
    } catch (error) {
      reject(error);
    }
  });
}
export async function createReportWord(
  report: TransferReport,
  fonts: ReportFonts,
): Promise<Blob> {
  const [d, { Buffer }] = await Promise.all([import("docx"), import("buffer")]);
  const para = (text: string, bold = false, keepNext = false) =>
    new d.Paragraph({
      children: text
        .split("\n")
        .flatMap((line, i) => [
          new d.TextRun({ text: line, bold, ...(i ? { break: 1 } : {}) }),
        ]),
      spacing: { after: 100, line: 290 },
      keepNext,
    });
  const children: (
    InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>
  )[] = [
    new d.Paragraph({ text: report.title, heading: d.HeadingLevel.TITLE }),
    para(editableCopyNotice, true),
    para(report.status, true),
    ...report.meta.map((text) => para(text)),
    para(reportDisclaimer),
  ];
  for (const section of report.sections) {
    children.push(
      new d.Paragraph({
        text: section.title,
        heading: d.HeadingLevel.HEADING_1,
        pageBreakBefore: section.pageBreak,
      }),
    );
    const paragraphs = section.paragraphs || [];
    paragraphs.forEach((text, index) =>
      children.push(
        para(
          text,
          false,
          !section.table &&
            paragraphs.join("").length < 1600 &&
            index < paragraphs.length - 1,
        ),
      ),
    );
    if (section.table) {
      if (!section.table.rows.length)
        children.push(para("ไม่มีรายการในส่วนนี้"));
      else
        children.push(
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            layout: d.TableLayoutType.FIXED,
            columnWidths: section.table.headers.map(() =>
              Math.floor(
                (report.landscape ? 15398 : 10466) /
                  section.table!.headers.length,
              ),
            ),
            rows: [section.table.headers, ...section.table.rows].map(
              (row, index) =>
                new d.TableRow({
                  tableHeader: index === 0,
                  cantSplit: row.every(
                    (cell) => cell.length < 600 && cell.split("\n").length < 10,
                  ),
                  children: row.map(
                    (text) =>
                      new d.TableCell({
                        width: {
                          size: 100 / row.length,
                          type: d.WidthType.PERCENTAGE,
                        },
                        shading: index === 0 ? { fill: "E8F3F0" } : undefined,
                        margins: { top: 90, bottom: 90, left: 100, right: 100 },
                        children: [para(text || "ยังไม่ระบุ", index === 0)],
                      }),
                  ),
                }),
            ),
          }),
        );
    }
  }
  const document = new d.Document({
    creator: "OVEC Mapping",
    title: report.title,
    description: report.status,
    fonts: [{ name: "Sarabun", data: Buffer.from(fonts.regular) }],
    styles: {
      default: {
        document: {
          run: { font: "Sarabun", size: 22, sizeComplexScript: 22 },
          paragraph: { spacing: { after: 100, line: 290 } },
        },
        title: {
          run: { font: "Sarabun", size: 38, bold: true, color: "111827" },
          paragraph: { spacing: { after: 200 }, keepNext: true },
        },
        heading1: {
          run: { font: "Sarabun", size: 28, bold: true, color: "115E59" },
          paragraph: { spacing: { before: 220, after: 120 }, keepNext: true },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: report.landscape
                ? d.PageOrientation.LANDSCAPE
                : d.PageOrientation.PORTRAIT,
            },
            margin: { top: 900, bottom: 900, left: 720, right: 720 },
          },
        },
        headers: {
          default: new d.Header({
            children: [para("OVEC Mapping | TPQI × อาชีวศึกษา")],
          }),
        },
        footers: {
          default: new d.Footer({
            children: [
              new d.Paragraph({
                alignment: d.AlignmentType.RIGHT,
                children: [
                  new d.TextRun({
                    text: `จัดทำ ${dateLabel(report.generatedAt)} | หน้า `,
                    size: 16,
                  }),
                  new d.TextRun({
                    children: [
                      d.PageNumber.CURRENT,
                      " / ",
                      d.PageNumber.TOTAL_PAGES,
                    ],
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return d.Packer.toBlob(document);
}
export async function downloadReport(
  report: TransferReport,
  format: ReportFormat,
) {
  const fonts = await loadReportFonts();
  const blob = await (format === "pdf"
    ? createReportPdf(report, fonts)
    : createReportWord(report, fonts));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.filename.replace(/[^a-zA-Z0-9_-]/g, "-")}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
