declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

  export function getDocument(
    src: any
  ): { promise: Promise<PDFDocumentProxy> };
}
