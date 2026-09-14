import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportSection, TransferReport } from "./report-data";
import { editableCopyNotice, reportDisclaimer } from "./report-data";

export type ReportFonts = { regular: Uint8Array; bold: Uint8Array };
export type ReportFormat = "pdf" | "docx";
let fontsPromise: Promise<ReportFonts> | undefined;
export function loadReportFonts(): Promise<ReportFonts> {
  return (fontsPromise ||= Promise.all(
    ["Regular", "Bold"].map(async (weight) => {
      const res = await fetch(`/fonts/THSarabunNew-${weight}.ttf`);
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
export const reportLayout = {
  font: "TH Sarabun New",
  bodySize: 16,
  titleSize: 20,
  // Physical margins in points: left 3 cm, top 2.5 cm, right/bottom 2 cm.
  margins: [85.04, 70.87, 56.69, 56.69] as [number, number, number, number],
  marginTwips: { left: 1701, top: 1417, right: 1134, bottom: 1134 },
};
const thaiNumber = (n: number) =>
  String(n).replace(/\d/g, (d) => "๐๑๒๓๔๕๖๗๘๙"[Number(d)]);
const dateLabel = (s: string) =>
  new Date(s).toLocaleDateString("th-TH-u-nu-thai", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const blank = "........................................................";
function officialLines(report: TransferReport) {
  const o = report.official || {};
  return [
    `สถานศึกษา / หน่วยงาน  ${o.organization?.trim() || blank}`,
    `งาน / ฝ่าย  ${o.department?.trim() || blank}`,
    `เลขที่หนังสืออ้างอิง  ${o.referenceNumber?.trim() || blank}`,
    `วันที่จัดทำรายงาน  ${dateLabel(report.generatedAt)}`,
  ];
}
function signatureLines(report: TransferReport, reviewer = false) {
  const o = report.official || {};
  return [
    `ลงชื่อ ${blank}`,
    `(${reviewer ? blank : o.preparedBy?.trim() || blank})`,
    `ตำแหน่ง ${reviewer ? blank : o.position?.trim() || blank}`,
    reviewer ? "ผู้ตรวจสอบหลักฐาน" : "ผู้จัดทำรายงาน",
    "วันที่ .......... เดือน ........................ พ.ศ. ..........",
  ];
}
const signatureNotice =
  "ช่องลงนามสำหรับจัดทำและตรวจสอบเอกสาร การอนุมัติเทียบโอนให้เป็นไปตามอำนาจและขั้นตอนของสถานศึกษา";
// Allocate more width to source evidence than short credit values.
export function reportColumnWeights(headers: string[]) {
  if (headers.length === 3 && headers[1] === "ทฤษฎี ปฏิบัติ หน่วยกิต")
    return [34, 17, 49];
  return headers.map(() => 1);
}
// Thai has no spaces between words. Insert legal break opportunities for PDF layout.
const segmenter = new Intl.Segmenter("th", { granularity: "word" });
function pdfText(s: string): Content[] {
  // Decompose Thai SARA AM before shaping so PDF text extraction does not duplicate SARA AA.
  const words = [
    ...segmenter.segment(s.replaceAll("ำ", "\u0e4d\u0e32")),
  ].flatMap(({ segment }) =>
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

// Keep only short reference blocks together. A block taller than a page can
// otherwise be discarded by pdfmake, especially with landscape course text.
function keepSectionTogether(section: ReportSection) {
  const paragraphs = section.paragraphs || [];
  return (
    !section.table &&
    paragraphs.length <= 5 &&
    paragraphs.join("").length < 450 &&
    paragraphs.reduce((n, p) => n + p.split("\n").length, 0) < 10
  );
}
export function pdfDefinition(report: TransferReport): TDocumentDefinitions {
  const content: Content[] = [
    {
      text: pdfText(report.title),
      fontSize: reportLayout.titleSize,
      alignment: "center",
      bold: true,
      color: "#000000",
      margin: [0, 0, 0, 10],
    },
    ...officialLines(report).map((text): Content => ({
      text: pdfText(text),
      margin: [0, 0, 0, 3],
    })),
    {
      text: pdfText("สถานะเอกสาร  " + report.status),
      bold: true,
      color: "#000000",
      margin: [0, 0, 0, 10],
    },
    ...report.meta.map((text): Content => ({
      text: pdfText(text),
      margin: [0, 0, 0, 5],
    })),
    {
      text: pdfText(reportDisclaimer),
      margin: [0, 10, 0, 8],
      color: "#000000",
    },
  ];
  for (const [sectionIndex, section] of report.sections.entries()) {
    const sectionStart = content.length;
    content.push({
      text: pdfText(`${thaiNumber(sectionIndex + 1)}. ${section.title}`),
      headlineLevel: section.table ? 2 : 1,
      fontSize: reportLayout.bodySize,
      bold: true,
      color: "#000000",
      margin: [0, 14, 0, 7],
      ...(section.pageBreak ? { pageBreak: "before" as const } : {}),
    });
    for (const text of section.paragraphs || [])
      content.push({ text: pdfText(text), margin: [0, 0, 0, 6] });
    if (section.table) {
      if (!section.table.rows.length) {
        content.push({ text: "ไม่มีรายการในส่วนนี้", color: "#000000" });
      } else {
        content.push({
          fontSize: reportLayout.bodySize,
          table: {
            headerRows: 1,
            // A source row can exceed a whole page. Keeping it with the
            // header makes pdfmake discard its first page of text.
            keepWithHeaderRows: 0,
            dontBreakRows: section.table.rows.every((row) =>
              row.every(
                (cell) =>
                  cell.length <
                    (section.table!.headers.length <= 3 ? 500 : 350) &&
                  cell.split("\n").length < 10,
              ),
            ),
            widths: reportColumnWeights(section.table.headers).map(
              (weight, _i, all) =>
                `${(100 * weight) / all.reduce((a, b) => a + b, 0)}%`,
            ),
            body: [
              section.table.headers.map((text) => ({
                text: pdfText(text),
                bold: true,
                fillColor: "#f2f2f2",
              })),
              ...section.table.rows.map((row) =>
                row.map((text) => ({ text: pdfText(text || "ยังไม่ระบุ") })),
              ),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#000000",
            vLineColor: () => "#000000",
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        });
      }
    }
    if (keepSectionTogether(section)) {
      content.push({ stack: content.splice(sectionStart), unbreakable: true });
    }
  }
  content.push({
    unbreakable: true,
    margin: [0, 18, 0, 0],
    stack: [
      {
        text: pdfText("การจัดทำและตรวจสอบเอกสาร"),
        bold: true,
        margin: [0, 0, 0, 6],
      },
      { text: pdfText(signatureNotice), margin: [0, 0, 0, 20] },
      {
        columns: [false, true].map((reviewer) => ({
          width: "*",
          alignment: "center" as const,
          stack: signatureLines(report, reviewer).map((text) => ({
            text: pdfText(text),
            margin: [0, 0, 0, 3] as [number, number, number, number],
          })),
        })),
        columnGap: 20,
      },
    ],
  });
  return {
    info: {
      title: report.title,
      author: "OVEC Mapping",
      subject: report.status,
      creator: "OVEC Mapping",
    },
    pageSize: "A4",
    pageBreakBefore: (node, following, _next, previous) =>
      (node.headlineLevel === 2 &&
        (node.startPosition?.verticalRatio || 0) > 0.65) ||
      (!!node.headlineLevel && following.length === 0 && previous.length > 0),
    pageOrientation: report.landscape ? "landscape" : "portrait",
    pageMargins: reportLayout.margins,
    defaultStyle: {
      font: reportLayout.font,
      fontSize: reportLayout.bodySize,
      lineHeight: 1,
      color: "#000000",
    },
    header: (page) =>
      page > 1
        ? {
            text: `- ${thaiNumber(page)} -`,
            alignment: "center",
            fontSize: 14,
            margin: [reportLayout.margins[0], 30, reportLayout.margins[2], 0],
          }
        : { text: "" },
    footer: (page, pages) => ({
      text: `OVEC Mapping   วันที่ ${dateLabel(report.generatedAt)}   หน้า ${thaiNumber(page)} จาก ${thaiNumber(pages)}`,
      alignment: "center",
      fontSize: 12,
      margin: [reportLayout.margins[0], 15, reportLayout.margins[2], 0],
      color: "#000000",
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
    "THSarabunNew-Regular.ttf": Buffer.from(fonts.regular).toString("base64"),
    "THSarabunNew-Bold.ttf": Buffer.from(fonts.bold).toString("base64"),
  };
  const definition = {
    [reportLayout.font]: {
      normal: "THSarabunNew-Regular.ttf",
      bold: "THSarabunNew-Bold.ttf",
      italics: "THSarabunNew-Regular.ttf",
      bolditalics: "THSarabunNew-Bold.ttf",
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
      spacing: { after: 120, line: 240 },
      keepNext,
    });
  const children: (
    InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>
  )[] = [
    new d.Paragraph({ text: report.title, heading: d.HeadingLevel.TITLE }),
    ...officialLines(report).map((text) => para(text)),
    para(editableCopyNotice, true),
    para("สถานะเอกสาร  " + report.status, true),
    ...report.meta.map((text) => para(text)),
    para(reportDisclaimer),
  ];
  for (const [sectionIndex, section] of report.sections.entries()) {
    children.push(
      new d.Paragraph({
        text: `${thaiNumber(sectionIndex + 1)}. ${section.title}`,
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
          keepSectionTogether(section) && index < paragraphs.length - 1,
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
            columnWidths: reportColumnWeights(section.table.headers).map(
              (weight, _i, all) =>
                Math.floor(
                  ((report.landscape ? 14003 : 9071) * weight) /
                    all.reduce((a, b) => a + b, 0),
                ),
            ),
            borders: Object.fromEntries(
              [
                "top",
                "bottom",
                "left",
                "right",
                "insideHorizontal",
                "insideVertical",
              ].map((side) => [
                side,
                { style: d.BorderStyle.SINGLE, size: 4, color: "000000" },
              ]),
            ),
            rows: [section.table.headers, ...section.table.rows].map(
              (row, index) =>
                new d.TableRow({
                  tableHeader: index === 0,
                  cantSplit: row.every(
                    (cell) => cell.length < 350 && cell.split("\n").length < 10,
                  ),
                  children: row.map(
                    (text, cellIndex) =>
                      new d.TableCell({
                        width: {
                          size:
                            (100 *
                              reportColumnWeights(section.table!.headers)[
                                cellIndex
                              ]) /
                            reportColumnWeights(section.table!.headers).reduce(
                              (a, b) => a + b,
                              0,
                            ),
                          type: d.WidthType.PERCENTAGE,
                        },
                        shading: index === 0 ? { fill: "F2F2F2" } : undefined,
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
  children.push(
    new d.Paragraph({
      text: "การจัดทำและตรวจสอบเอกสาร",
      heading: d.HeadingLevel.HEADING_1,
    }),
    para(signatureNotice, false, true),
  );
  // A borderless table keeps the two signature blocks aligned and on one page.
  children.push(
    new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      borders: Object.fromEntries(
        [
          "top",
          "bottom",
          "left",
          "right",
          "insideHorizontal",
          "insideVertical",
        ].map((side) => [
          side,
          { style: d.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        ]),
      ),
      rows: [
        new d.TableRow({
          cantSplit: true,
          children: [false, true].map(
            (reviewer) =>
              new d.TableCell({
                width: { size: 50, type: d.WidthType.PERCENTAGE },
                margins: { top: 360, bottom: 0, left: 80, right: 80 },
                children: signatureLines(report, reviewer).map(
                  (text) =>
                    new d.Paragraph({
                      text,
                      alignment: d.AlignmentType.CENTER,
                      spacing: { after: 60, line: 240 },
                    }),
                ),
              }),
          ),
        }),
      ],
    }),
  );
  const document = new d.Document({
    creator: "OVEC Mapping",
    title: report.title,
    description: report.status,
    fonts: [{ name: reportLayout.font, data: Buffer.from(fonts.regular) }],
    styles: {
      default: {
        document: {
          run: {
            font: reportLayout.font,
            size: 32,
            sizeComplexScript: 32,
            color: "000000",
            language: { value: "th-TH" },
          },
          paragraph: { spacing: { after: 120, line: 240 } },
        },
        title: {
          run: {
            font: reportLayout.font,
            size: 40,
            sizeComplexScript: 40,
            bold: true,
            color: "000000",
          },
          paragraph: {
            alignment: d.AlignmentType.CENTER,
            spacing: { after: 200 },
            keepNext: true,
          },
        },
        heading1: {
          run: {
            font: reportLayout.font,
            size: 32,
            sizeComplexScript: 32,
            bold: true,
            color: "000000",
          },
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
            margin: { ...reportLayout.marginTwips, header: 567, footer: 567 },
          },
        },
        footers: {
          default: new d.Footer({
            children: [
              new d.Paragraph({
                alignment: d.AlignmentType.CENTER,
                children: [
                  new d.TextRun({
                    text: `OVEC Mapping   วันที่ ${dateLabel(report.generatedAt)}   หน้า `,
                    size: 24,
                    sizeComplexScript: 24,
                  }),
                  new d.TextRun({
                    children: [
                      d.PageNumber.CURRENT,
                      " / ",
                      d.PageNumber.TOTAL_PAGES,
                    ],
                    size: 24,
                    sizeComplexScript: 24,
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
