require("http")
  .createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("fc placeholder");
  })
  .listen(Number(process.env.PORT) || 9000, "0.0.0.0");
