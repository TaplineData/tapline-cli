/** Data goes to stdout; everything else goes to stderr, so pipes only ever see data. */
export interface Output {
  data: (text: string) => void;
  note: (text: string) => void;
}

export const processOutput: Output = {
  data: (text) => process.stdout.write(text.endsWith('\n') ? text : `${text}\n`),
  note: (text) => process.stderr.write(`${text}\n`),
};
