const cors_proxy = require('cors-anywhere');
const http = require('http');

const host = '0.0.0.0';
const port = process.env.PORT || 8080;

// Initialize core proxy configurations
const proxyServer = cors_proxy.createServer({
    originWhitelist: [], 
    requireHeader: [], // Removed to allow direct address-bar browser access
    removeHeaders: ['cookie', 'cookie2']
});

// Main router handling webpage serving vs data routing
http.createServer(function(req, res) {
    
    // 1. Serve the Main Hub UI Dashboard
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Private Unblocked Web Gateway</title>
                <style>
                    body { background: #121212; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #1e1e1e; padding: 40px; border-radius: 12px; text-align: center; width: 90%; max-width: 480px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); border: 1px solid #2a2a2a; }
                    h2 { margin-top: 0; color: #007bff; font-size: 24px; }
                    p { color: #aaaaaa; margin-bottom: 25px; font-size: 14px; }
                    .input-group { display: flex; flex-direction: column; gap: 12px; }
                    input { padding: 14px; border: 1px solid #333; background: #121212; color: white; border-radius: 6px; font-size: 16px; outline: none; transition: 0.2s; }
                    input:focus { border-color: #007bff; }
                    button { background: #007bff; color: white; border: none; padding: 14px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
                    button:hover { background: #0056b3; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Private Web Gateway</h2>
                    <p>Enter any public URL below to view it unblocked through your dedicated server instance.</p>
                    <div class="input-group">
                        <input type="text" id="targetUrl" value="https://instagram.com" placeholder="https://example.com">
                        <button onclick="launchProxy()">Launch Unblocked Frame</button>
                    </div>
                </div>
                <script>
                    function launchProxy() {
                        let url = document.getElementById('targetUrl').value.trim();
                        if (!url) return;
                        if (!url.startsWith('http://') && !url.startsWith('https://')) {
                            url = 'https://' + url;
                        }
                        // Routes to our wrapper page below
                        window.location.href = '/view?url=' + encodeURIComponent(url);
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // 2. Serve the Navigation Controller Interface (Wraps requested sites in a top bar frame)
    if (req.url.startsWith('/view')) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gateway Viewer</title>
                <style>
                    body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #121212; font-family: sans-serif; }
                    #nav-panel { height: 55px; background: #1c1c1e; border-bottom: 1px solid #2c2c2e; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; box-sizing: border-box; }
                    .left-controls { display: flex; align-items: center; gap: 15px; }
                    .btn { background: #2c2c2e; color: #fff; border: 1px solid #3a3a3c; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; text-decoration: none; }
                    .btn:hover { background: #3a3a3c; }
                    .btn-home { background: #007bff; border-color: #0056b3; }
                    .btn-home:hover { background: #0056b3; }
                    .url-display { color: #8e8e93; font-size: 13px; font-family: monospace; background: #121212; padding: 6px 12px; border-radius: 4px; border: 1px solid #2c2c2e; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    iframe { width: 100%; height: calc(100% - 55px); border: none; background: #ffffff; }
                </style>
            </head>
            <body>

                <div id="nav-panel">
                    <div class="left-controls">
                        <button class="btn btn-home" onclick="returnToHub()">🏠 Return to Hub</button>
                        <button class="btn" onclick="refreshFrame()">🔄 Refresh Page</button>
                    </div>
                    <div class="url-display" id="urlText">Loading...</div>
                </div>

                <iframe id="content-viewport" src=""></iframe>

                <script>
                    const urlParams = new URLSearchParams(window.location.search);
                    const destination = urlParams.get('url');
                    
                    if (destination) {
                        document.getElementById('urlText').textContent = destination;
                        // Appends the target destination directly into the local proxy engine route
                        document.getElementById('content-viewport').src = window.location.origin + '/' + destination;
                    } else {
                        returnToHub();
                    }

                    function returnToHub() {
                        window.location.href = '/';
                    }

                    function refreshFrame() {
                        const frame = document.getElementById('content-viewport');
                        frame.src = frame.src;
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // 3. Fallback: Forward all other raw traffic patterns directly into the Proxy Engine
    proxyServer.emit('request', req, res);

}).listen(port, host, function() {
    console.log('Proxy environment online.');
});


// Add this helper function to parse and isolate upstream redirects
function proxyResponseHeaders(req, res, proxyRes) {
    // Intercept upstream location changes (HTTP 301/302 redirects)
    if (proxyRes.headers.location) {
        let originalRedirect = proxyRes.headers.location;
        
        // If the redirect is relative, convert it into an absolute URL
        if (originalRedirect.startsWith('/')) {
            const targetUrlParam = new URL(req.url, 'http://localhost').pathname.substring(1);
            const targetOrigin = new URL(targetUrlParam).origin;
            originalRedirect = targetOrigin + originalRedirect;
        }
        
        // Force the browser redirect to loop back through your proxy wrapper path
        proxyRes.headers.location = '/view?url=' + encodeURIComponent(originalRedirect);
    }
}
