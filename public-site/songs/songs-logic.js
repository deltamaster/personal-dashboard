(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SongListLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function adjustedLength(str) {
    let length = 0;
    for (let i = 0; i < str.length; i++) {
      length += str.charCodeAt(i) > 127 ? 2 : 1;
    }
    return length;
  }

  function columnSpan(name) {
    return Math.min(2 + Math.floor(String(name).length / 2.5), 8);
  }

  function sortSongs(songs) {
    return songs.slice().sort((a, b) => adjustedLength(a.name) - adjustedLength(b.name));
  }

  function filterSongs(songs, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (song) =>
        song.name.toLowerCase().includes(q) ||
        song.singers.some((singer) => singer.toLowerCase().includes(q))
    );
  }

  return { adjustedLength, columnSpan, sortSongs, filterSongs };
});
