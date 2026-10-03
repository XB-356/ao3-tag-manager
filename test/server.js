/* 极简静态文件服务：给本地 mock 页面用（仅测试） */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, 'mock');
const PORT = Number(process.env.PORT || 8877);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, urlPath === '/' ? 'list.html' : urlPath);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found: ' + urlPath);
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('mock server on http://127.0.0.1:' + PORT);
});

server.on('error', (err) => {
  console.error('mock server 启动失败: ' + err.message);
  process.exit(1);
});

// 父进程结束时一并退出，避免残留占用端口
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => process.exit(0)));
