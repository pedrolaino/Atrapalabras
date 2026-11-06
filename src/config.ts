// General game settings. Change these values and reload the app.
export const config = {
  name: 'Atrapalabras',
  subtitle: '25 Letras',
  showSubtitle: true,
  // Time per player, in seconds.
  secondsPerPlayer: 180,
  // Remaining seconds from which the "time is running out" beep plays.
  warningSeconds: 10,
  // Letters of the wheel, in order (no K or W).
  letters: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N',
    'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z',
  ],
  // How many taps in a row can be undone.
  maxUndo: 30,
}
