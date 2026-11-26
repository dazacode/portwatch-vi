// Scribbletune can write MIDI files to disk, so it imports fs, which browsers don't have. The
// soundtrack never writes files; this stands in for fs in the browser bundle.
export default {}
