declare module 'pdfjs-dist' {
  export interface PDFViewport {
    width: number;
    height: number;
  }

  export interface RenderTask {
    promise: Promise<void>;
  }

  export interface PDFPageProxy {
    getViewport(params: { scale: number }): PDFViewport;
    render(params: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }): RenderTask;
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export function getDocument(params: { data: ArrayBuffer }): { promise: Promise<PDFDocumentProxy> };
  export const GlobalWorkerOptions: { workerSrc: string };
}
