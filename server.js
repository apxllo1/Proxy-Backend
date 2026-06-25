const cors_proxy = require('cors-anywhere');
const host = '0.0.0.0';
const port = process.env.PORT || 8080;

// Create proxy engine and remove all security blocks for ease of use
const proxyServer = cors_proxy.createServer({
    originWhitelist: [], 
    requireHeader: [], // Removes the mandatory header rule
    removeHeaders: ['cookie', 'cookie2']
});

const http = require('http');
http.createServer(function(req, res) {
    // Serve a simple visual UI if you just visit the main link
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>My Unblocked Web Gateway</title>
                <style>
                    body { background: #121212; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .box { background: #1e1e1e; padding: 30px; border-radius: 12px; text-align: center; width: 90%; max-width: 500px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                    input { width: 85%; padding: 12px; border: none; border-radius: 6px; margin-bottom: 15px; font-size: 16px; }
                    button { background: #007bff; color: white; border: none; padding: 12px 25px; border-radius: 6px; font-size: 16px; cursor: pointer; }
                    button:hover { background: #0056b3; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h2>Unblocked Web Gateway</h2>
                    <p>Type any web address below to bypass network blocks:</p>
                    <input type="text" id="urlInput" value="https://instagram.com"><br>
                    <button onclick="launch()">Go to Website</button>
                </div>
                <script>
                    function launch() {
                        var target = document.getElementById('urlInput').value;
                        if(!target.startsWith('http')) { target = 'https://' + target; }
                        window.location.href = window.location.origin + '/' + target;
                    }
                </script>
            </body>
            </html>
        `);
    } else {
        // Pass website requests straight to the proxy system
        proxyServer.emit('request', req, res);
    }
}).listen(port, host, function() {
    console.log('Proxy with UI running.');
});
