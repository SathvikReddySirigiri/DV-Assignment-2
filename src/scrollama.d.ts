declare module "scrollama" {
  type ScrollamaResponse = { index: number; element: HTMLElement; direction: "up" | "down" };

  interface ScrollamaInstance {
    setup(options: {
      step: string | Element[];
      offset?: number;
      progress?: boolean;
      order?: string;
      once?: boolean;
      debug?: boolean;
    }): ScrollamaInstance;
    onStepEnter(cb: (r: ScrollamaResponse) => void): ScrollamaInstance;
    onStepExit(cb: (r: ScrollamaResponse) => void): ScrollamaInstance;
    resize(): void;
    destroy(): void;
  }

  function scrollama(): ScrollamaInstance;
  export default scrollama;
}
