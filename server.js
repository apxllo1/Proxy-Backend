const http = require('http');
const https = require('https');
const url = require('url');

const host = '0.0.0.0';
const port = process.env.PORT || 8080;

// Helper to injection-rewrite URLs inside text code (HTML/CSS/JS)
function rewriteUrls(data, targetOrigin, proxyHost) {
    if (typeof data !== 'string') return data;
    
    // Replace absolute links (e.g., https://instagram.com to https://yourproxy.com/proxy/https://instagram.com)
    const absoluteRegex = /(https?:\/\/[a-z0-9-\.]+\.[a-z]{2,})/ig;
    let rewritten = data.replace(absoluteRegex, (match) => {
        if (match.includes(proxyHost)) return match; // Skip if already proxied
        return `https://${proxyHost}/proxy/${match}`;
    });

    return rewritten;
}

http.createServer(function(clientReq, clientRes) {
    const parsedUrl = url.parse(clientReq.url, true);
    const proxyHost = clientReq.headers.host;

    // 1. Serve the Front-End Hub Dashboard
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
        clientRes.writeHead(200, {'Content-Type': 'text/html'});
        clientRes.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Advanced Network Proxy Gateway</title>
                <style>
                    body { background: #0f0f11; color: #e4e4e7; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .container { background: #18181b; padding: 40px; border-radius: 16px; border: 1px solid #27272a; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; }
                    h1 { color: #3b82f6; font-size: 28px; margin-bottom: 8px; }
                    p { color: #a1a1aa; font-size: 14px; margin-bottom: 24px; }
                    input { width: 100%; padding: 14px; background: #09090b; border: 1px solid #27272a; border-radius: 8px; color: white; font-size: 16px; box-sizing: border-box; margin-bottom: 16px; outline: none; transition: 0.2s; }
                    input:focus { border-color: #3b82f6; }
                    button { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s; }
                    button:hover { background: #2563eb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Web Gateway Proxy</h1>
                    <p>Enter any web address below to stream it natively through your server node.</p>
                    <input type="text" id="urlInput" value="https://instagram.com" placeholder="https://example.com">
                    <button onclick="navigate()">Connect to Node</button>
                </div>
                <script>
                    function navigate() {
                        let target = document.getElementById('urlInput').value.trim();
                        if (!target) return;
                        if (!target.startsWith('http://') && !target.startsWith('https://')) {
                            target = 'https://' + target;
                        }
                        window.location.href = '/proxy/' + target;
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // 2. The Core Rewriting Proxy Engine
    if (parsedUrl.pathname.startsWith('/proxy/')) {
        let targetUrlStr = clientReq.url.substring(7); // Extract the target URL after /proxy/
        
        if (!targetUrlStr.startsWith('http://') && !targetUrlStr.startsWith('https://')) {
            targetUrlStr = 'https://' + targetUrlStr;
        }

        let targetUrl;
        try {
            targetUrl = new URL(targetUrlStr);
        } catch (e) {
            clientRes.writeHead(400, {'Content-Type': 'text/plain'});
            clientRes.end('Invalid URL format targeting the proxy layer.');
            return;
        }

        // Clone browser headers and update origin configurations
        const proxyHeaders = Object.assign({}, clientReq.headers);
        proxyHeaders['host'] = targetUrl.host;
        proxyHeaders['origin'] = targetUrl.origin;
        if (proxyHeaders['referer']) {
            proxyHeaders['referer'] = targetUrl.origin;
        }
        
        // Disable content compression so the proxy server can read and rewrite the text
        delete proxyHeaders['accept-encoding']; 

        const requestOptions = {
            method: clientReq.method,
            headers: proxyHeaders,
            agent: false
        };

        const proxyLib = targetUrl.protocol === 'https:' ? https : http;

        // Issue request to the real destination site
        const remoteRequest = proxyLib.request(targetUrlStr, requestOptions, function(remoteResponse) {
            let responseHeaders = Object.assign({}, remoteResponse.headers);

            // Strip frame-blocking and strict security configurations completely
            delete responseHeaders['x-frame-options'];
            delete responseHeaders['content-security-policy'];
            delete responseHeaders['content-security-policy-report-only'];
            delete responseHeaders['cross-origin-opener-policy'];

            // Loop back standard 301/302 redirects through our proxy string
            if (responseHeaders['location']) {
                let absoluteRedirect = responseHeaders['location'];
                if (absoluteRedirect.startsWith('/')) {
                    absoluteRedirect = targetUrl.origin + absoluteRedirect;
                }
                responseHeaders['location'] = `https://${proxyHost}/proxy/${absoluteRedirect}`;
            }

            // Set up CORS configurations to keep the browser environment open
            responseHeaders['access-control-allow-origin'] = '*';
            responseHeaders['access-control-allow-credentials'] = 'true';

            const contentType = responseHeaders['content-type'] || '';

            // IF TEXT CONTENT (HTML/CSS/JS): Download, rewrite internal URLs, and send
            if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('application/javascript')) {
                let rawData = '';
                remoteResponse.setEncoding('utf8');
                remoteResponse.on('data', (chunk) => { rawData += chunk; });
                remoteResponse.on('end', () => {
                    const cleanOutput = rewriteUrls(rawData, targetUrl.origin, proxyHost);
                    
                    // Force inject a script modifying relative paths in the client browser environment
                    let finalHtml = cleanOutput;
                    if (contentType.includes('text/html')) {
                        const injectionScript = `
                            <script>
                                // Intercept client-side dynamically generated link assignments
                                const _open = window.XMLHttpRequest.prototype.open;
                                window.XMLHttpRequest.prototype.open = function(method, url) {
                                    if(url && !url.startsWith('http') && !url.startsWith('/proxy/')) {
                                        url = window.location.origin + '/proxy/' + new URL(url, "${targetUrl.origin}").href;
                                    }
                                    return _open.apply(this, arguments);
                                };
                            </script>
                        `;
                        finalHtml = cleanOutput.replace('<head>', '<head>' + injectionScript);
                    }

                    delete responseHeaders['content-length']; // Length changed due to path modifications
                    clientRes.writeHead(remoteResponse.statusCode, responseHeaders);
                    clientRes.end(finalHtml);
                });
            } else {
                // IF BINARY CONTENT (Images/Videos/Fonts): Pipe stream directly to browser
                clientRes.writeHead(remoteResponse.statusCode, responseHeaders);
                remoteResponse.pipe(clientRes);
            }
        });

        remoteRequest.on('error', function(err) {
            clientRes.writeHead(500, {'Content-Type': 'text/plain'});
            clientRes.end('Proxy node routing failure: ' + err.message);
        });

        clientReq.pipe(remoteRequest);
        return;
    }

    // Default route mismatch error handling
    clientRes.writeHead(404, {'Content-Type': 'text/plain'});
    clientRes.end('Resource route not mapable on current node.');

}).listen(port, host, function() {
    console.log('Production rewriting proxy layer online.');
});
