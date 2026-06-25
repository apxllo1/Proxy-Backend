const cors_proxy = require('cors-anywhere');
const http = require('http');
const url = require('url');

const host = '0.0.0.0';
const port = process.env.PORT || 8080;

const proxyServer = cors_proxy.createServer({
    originWhitelist: [], 
    requireHeader: [], 
    removeHeaders: ['cookie', 'cookie2', 'x-frame-options', 'content-security-policy'] // Strips the blocks that cause white screens
});

http.createServer(function(req, res) {
    // 1. Home Hub
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Private Proxy Hub</title>
                <style>
                    body { background: #121212; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .box { background: #1e1e1e; padding: 40px; border-radius: 12px; text-align: center; width: 90%; max-width: 450px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                    input { width: 85%; padding: 12px; border: none; border-radius: 6px; margin-bottom: 20px; font-size: 16px; background: #2a2a2a; color: white; }
                    button { background: #007bff; color: white; border: none; padding: 12px 25px; border-radius: 6px; font-size: 16px; cursor: pointer; width: 100%; font-weight: bold;}
                    button:hover { background: #0056b3; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h2>Private Web Gateway</h2>
                    <p>Enter a URL to browse directly through this server instance:</p>
                    <input type="text" id="urlInput" value="https://instagram.com">
                    <button onclick="go()">Browse Unblocked</button>
                </div>
                <script>
                    function go() {
                        let target = document.getElementById('urlInput').value.trim();
                        if(!target.startsWith('http')) { target = 'https://' + target; }
                        window.location.href = window.location.origin + '/proxy/' + target;
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // 2. Direct Proxy Router (No Iframe)
    if (req.url.startsWith('/proxy/')) {
        // Strip the "/proxy/" prefix to get the actual target URL
        const targetUrl = req.url.substring(7);
        req.url = '/' + targetUrl;
        
        // Intercept headers to drop security restrictions before serving the page to your browser
        res.oldWriteHead = res.writeHead;
        res.writeHead = function(statusCode, headers) {
            if (headers) {
                delete headers['x-frame-options'];
                delete headers['content-security-policy'];
                // Redirect loops stay trapped inside your proxy directory
                if (headers['location'] && !headers['location'].startsWith(req.headers.origin)) {
                    headers['location'] = '/proxy/' + headers['location'];
                }
            }
            res.oldWriteHead(statusCode, headers);
        };

        proxyServer.emit('request', req, res);
        return;
    }

    // Fallback routing
    proxyServer.emit('request', req, res);

}).listen(port, host, function() {
    console.log('Proxy bypass running seamlessly.');
});
