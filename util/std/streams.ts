// Drop-in replacement for jsr:@std/streams — TextLineStream.

export class TextLineStream extends TransformStream<string, string> {
  #buffer = "";

  constructor() {
    super({
      transform: (chunk, controller) => {
        this.#buffer += chunk;
        let index: number;
        while ((index = this.#buffer.indexOf("\n")) !== -1) {
          let line = this.#buffer.slice(0, index);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          controller.enqueue(line);
          this.#buffer = this.#buffer.slice(index + 1);
        }
      },
      flush: controller => {
        if (this.#buffer.length > 0) controller.enqueue(this.#buffer);
      },
    });
  }
}
