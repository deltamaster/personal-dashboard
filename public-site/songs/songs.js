(function () {
  const logic = window.SongListLogic;
  const search = document.getElementById("song-search");
  const grid = document.getElementById("song-grid");
  const status = document.getElementById("song-status");
  let songs = [];

  function renderItem(song, copy) {
    const el = document.createElement("div");
    el.className = "song";
    el.style.gridColumnEnd = "span " + logic.columnSpan(song.name);
    el.textContent = song.name;
    const singers = song.singers.join(", ");
    el.title = singers ? song.name + " — " + singers : song.name;
    el.dataset.songId = copy ? song.id + "-copy" : song.id;
    return el;
  }

  function render() {
    const query = search.value;
    const searching = query.trim().length > 0;
    const visible = logic.filterSongs(songs, query);
    const marquee = !searching && visible.length > 0;
    grid.replaceChildren();
    grid.classList.toggle("is-marquee", marquee);
    if (marquee) {
      grid.style.animation = "";
      grid.style.transform = "";
    } else {
      grid.style.animation = "none";
      grid.style.transform = "none";
    }
    if (!songs.length) {
      status.hidden = false;
      status.textContent = "歌单还是空的";
      return;
    }
    if (!visible.length) {
      status.hidden = false;
      status.textContent = "没有匹配的歌";
      return;
    }
    status.hidden = true;
    for (const song of visible) grid.appendChild(renderItem(song, false));
    if (!searching) {
      for (const song of visible) grid.appendChild(renderItem(song, true));
    }
  }

  search.addEventListener("input", render);
  document.addEventListener("visibilitychange", function () {
    grid.style.animationPlayState = document.hidden ? "paused" : "running";
  });

  function fetchSongList(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      var type = res.headers.get("content-type") || "";
      if (!res.ok || type.indexOf("json") === -1) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  fetchSongList("/api/songs")
    .catch(function () {
      return fetchSongList("/songs/songs.json");
    })
    .then(function (data) {
      if (!Array.isArray(data)) throw new Error("bad payload");
      songs = logic.sortSongs(
        data
          .map(function (song) {
            return {
              id: String(song.id || ""),
              name: String(song.name || ""),
              singers: Array.isArray(song.singers) ? song.singers.map(String) : [],
            };
          })
          .filter(function (song) {
            return song.id && song.name;
          })
      );
      render();
    })
    .catch(function () {
      status.hidden = false;
      status.textContent = "歌单加载失败";
    });
})();
