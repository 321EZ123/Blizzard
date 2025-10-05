import axios from 'axios';
import https from 'https';

export default async function glacierHandler(winterRequest, iceResponse) {
    if (winterRequest.method === 'OPTIONS') {
        iceResponse.setHeader("Access-Control-Allow-Origin", "*");
        iceResponse.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        iceResponse.setHeader("Access-Control-Allow-Headers", "Content-Type, User-Agent, Referer");
        return iceResponse.status(204).end();
    }

    let { targetDestination } = winterRequest.query;
    if (!targetDestination) return iceResponse.status(400).send("Missing `targetDestination` query parameter.");

    try {
        targetDestination = decodeURIComponent(targetDestination);
        console.log(`Glacier routing: ${targetDestination}`);

        const frostAgent = new https.Agent({ rejectUnauthorized: false });

        const isImageAsset = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(targetDestination);
        const isBinaryAsset = /\.(woff2?|ttf|eot|otf|ico)$/i.test(targetDestination);
        const isJsonAsset = /\.json$/i.test(targetDestination);
        const isJsAsset = /\.js$/i.test(targetDestination);

        const glacierResponse = await axios.get(targetDestination, {
            httpsAgent: frostAgent,
            responseType: isImageAsset || isBinaryAsset ? 'arraybuffer' : 'text',
            timeout: 30000,
            headers: {
                'User-Agent': winterRequest.headers['user-agent'] || '',
                'Accept': '*/*',
            },
        });

        const frozenContentType = glacierResponse.headers['content-type'] || 'application/octet-stream';
        iceResponse.setHeader("Access-Control-Allow-Origin", "*");
        iceResponse.setHeader("Content-Type", frozenContentType);

        const stormHeaders = { ...glacierResponse.headers };
        delete stormHeaders['content-security-policy'];
        delete stormHeaders['content-security-policy-report-only'];
        delete stormHeaders['x-frame-options'];

        for (const [headerKey, headerValue] of Object.entries(stormHeaders)) {
            iceResponse.setHeader(headerKey, headerValue);
        }

        if (isImageAsset || isBinaryAsset) {
            return iceResponse.status(glacierResponse.status).send(Buffer.from(glacierResponse.data));
        }

        if (isJsonAsset) {
            return iceResponse.status(glacierResponse.status).json(glacierResponse.data);
        }

        let frozenContent = glacierResponse.data;

        if (!isJsAsset && frozenContentType.includes('text/html')) {
            const blizzardBaseUrl = new URL(targetDestination);

            frozenContent = frozenContent.replace(/(src|href|srcset|poster)=["']([^"']+)["']/gi, (match, attr, link) => {
                try {
                    if (link.startsWith('data:') || link.startsWith('mailto:') || link.startsWith('javascript:')) {
                        return match;
                    }
                    const absoluteDestination = new URL(link, blizzardBaseUrl).toString();
                    const glacierRoute = `/storm/index.js?targetDestination=${encodeURIComponent(absoluteDestination)}`;
                    return `${attr}="${glacierRoute}"`;
                } catch (winterError) {
                    return match;
                }
            });

            frozenContent = frozenContent.replace('loading="lazy"', 'loading="eager"');

            const stormRedirectPatterns = [
                /(?:window\.|top\.|document\.)?location(?:\.href)?\s*=\s*["'`](.*?)["'`]/gi,
                /window\.open\s*\(\s*["'`](.*?)["'`]\s*(,.*?)?\)/gi,
            ];

            for (const pattern of stormRedirectPatterns) {
                frozenContent = frozenContent.replace(pattern, (...args) => {
                    let link = args[1];
                    let extra = args[2] || '';
                    try {
                        const target = new URL(link || '.', blizzardBaseUrl).toString();
                        const glacierRoute = `/storm/index.js?targetDestination=${encodeURIComponent(target)}`;
                        if (pattern.source.startsWith("window.open")) {
                            return `window.open('${glacierRoute}'${extra})`;
                        } else {
                            return `window.location = '${glacierRoute}'`;
                        }
                    } catch (winterError) {
                        return args[0];
                    }
                });
            }

            frozenContent = frozenContent.replace(/<\/body>/i, `
                <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
                <script>eruda.init();</script>
            </body>`);

            frozenContent = frozenContent.replace(/(--background-image\s*:\s*url\(["']?)([^"')]+)(["']?\))/g, (match, prefix, imageUrl, suffix) => {
                if (imageUrl.startsWith('http')) return match;
                const glacierImageUrl = `/storm/index.js?targetDestination=${encodeURIComponent(imageUrl)}`;
                return `${prefix}${glacierImageUrl}${suffix}`;
            });

            frozenContent = frozenContent.replace(/url\(["']?(?!data:|http|\/\/)([^"')]+)["']?\)/gi, (match, relativePath) => {
                const absolute = new URL(relativePath, blizzardBaseUrl).toString();
                const glacierRoute = `/storm/index.js?targetDestination=${encodeURIComponent(absolute)}`;
                return `url('${glacierRoute}')`;
            });

            frozenContent = frozenContent.replace(/<iframe\s+[^>]*src=["'](.*?)["'][^>]*>/gi, (match, link) => {
                try {
                    const target = new URL(link || '.', blizzardBaseUrl).toString();
                    const glacierRoute = `/storm/index.js?targetDestination=${encodeURIComponent(target)}`;
                    return match.replace(link, glacierRoute);
                } catch (winterError) {
                    return match;
                }
            });

            frozenContent = frozenContent.replace(/<\/body>/i, `
                <script>
                    (() => {
                      const stormForm = document.getElementById('tsf');
                      if (stormForm) {
                        const parentElement = stormForm.parentNode;
                        const childElements = Array.from(stormForm.childNodes);
                        childElements.forEach(child => parentElement.insertBefore(child, stormForm));
                        parentElement.removeChild(stormForm);
                        console.log('Storm form unwrapped successfully.');
                      } else {
                        console.warn('No storm form with ID "tsf" found.');
                      }
                    })();

                        setInterval(function() {

                            const glacierSearchBar = document.getElementsByClassName('SDkEP')[0];

                            if (glacierSearchBar && glacierSearchBar.style.width !== '670px') {

                                glacierSearchBar.style.width = '670px';

                                console.log('Glacier search bar grown to proper size');
                            }
                        }, 10);
                </script>
            </body>`);

            frozenContent = frozenContent.replace(
                    /<\/body>/i,
                    `
                        <script>
                            document.addEventListener('DOMContentLoaded', function () {
                                const stormSearchInput = document.querySelector('input[name="q"], textarea[name="q"]');
                                if (stormSearchInput) {
                                    stormSearchInput.addEventListener('keypress', function (winterEvent) {
                                        if (winterEvent.key === 'Enter') {
                                            winterEvent.preventDefault();
                                            const searchTerm = stormSearchInput.value;
                                            const searchDestination = 'https://www.google.com/search?q=' + encodeURIComponent(searchTerm);
                                            window.location.href = '/storm/index.js?targetDestination=' + encodeURIComponent(searchDestination);
                                        }
                                    });
                                }
                            });
                        </script>
                    </body>`
            );

        }

        frozenContent = frozenContent.replace(/%20/g, ' ')
            .replace(/%21/g, '!')
            .replace(/%22/g, '"')
            .replace(/%23/g, '#')
            .replace(/%24/g, '$')
            .replace(/%25/g, '%')
            .replace(/%26/g, '&')
            .replace(/%27/g, "'")
            .replace(/%28/g, '(')
            .replace(/%29/g, ')')
            .replace(/%2A/g, '*')
            .replace(/%2B/g, '+')
            .replace(/%2C/g, ',')
            .replace(/%2D/g, '-')
            .replace(/%2E/g, '.')
            .replace(/%2F/g, '/')
            .replace(/%30/g, '0')
            .replace(/%31/g, '1')
            .replace(/%32/g, '2')
            .replace(/%33/g, '3')
            .replace(/%34/g, '4')
            .replace(/%35/g, '5')
            .replace(/%36/g, '6')
            .replace(/%37/g, '7')
            .replace(/%38/g, '8')
            .replace(/%39/g, '9')
            .replace(/%3A/g, ':')
            .replace(/%3B/g, ';')
            .replace(/%3C/g, '<')
            .replace(/%3D/g, '=')
            .replace(/%3E/g, '>')
            .replace(/%3F/g, '?')
            .replace(/%40/g, '@')
            .replace(/%41/g, 'A')
            .replace(/%42/g, 'B')
            .replace(/%43/g, 'C')
            .replace(/%44/g, 'D')
            .replace(/%45/g, 'E')
            .replace(/%46/g, 'F')
            .replace(/%47/g, 'G')
            .replace(/%48/g, 'H')
            .replace(/%49/g, 'I')
            .replace(/%4A/g, 'J')
            .replace(/%4B/g, 'K')
            .replace(/%4C/g, 'L')
            .replace(/%4D/g, 'M')
            .replace(/%4E/g, 'N')
            .replace(/%4F/g, 'O')
            .replace(/%50/g, 'P')
            .replace(/%51/g, 'Q')
            .replace(/%52/g, 'R')
            .replace(/%53/g, 'S')
            .replace(/%54/g, 'T')
            .replace(/%55/g, 'U')
            .replace(/%56/g, 'V')
            .replace(/%57/g, 'W')
            .replace(/%58/g, 'X')
            .replace(/%59/g, 'Y')
            .replace(/%5A/g, 'Z')
            .replace(/%5B/g, '[')
            .replace(/%5C/g, '\\')
            .replace(/%5D/g, ']')
            .replace(/%5E/g, '^')
            .replace(/%5F/g, '_')
            .replace(/%60/g, '`')
            .replace(/%61/g, 'a')
            .replace(/%62/g, 'b')
            .replace(/%63/g, 'c')
            .replace(/%64/g, 'd')
            .replace(/%65/g, 'e')
            .replace(/%66/g, 'f')
            .replace(/%67/g, 'g')
            .replace(/%68/g, 'h')
            .replace(/%69/g, 'i')
            .replace(/%6A/g, 'j')
            .replace(/%6B/g, 'k')
            .replace(/%6C/g, 'l')
            .replace(/%6D/g, 'm')
            .replace(/%6E/g, 'n')
            .replace(/%6F/g, 'o')
            .replace(/%70/g, 'p')
            .replace(/%71/g, 'q')
            .replace(/%72/g, 'r')
            .replace(/%73/g, 's')
            .replace(/%74/g, 't')
            .replace(/%75/g, 'u')
            .replace(/%76/g, 'v')
            .replace(/%77/g, 'w')
            .replace(/%78/g, 'x')
            .replace(/%79/g, 'y')
            .replace(/%7A/g, 'z')
            .replace(/%7B/g, '{')
            .replace(/%7C/g, '|')
            .replace(/%7D/g, '}')
            .replace(/%7E/g, '~');

        frozenContent = frozenContent.replace(/content="([^"]+)"/g, (match, jsonContent) => {
            try {
                let jsonData = JSON.parse(decodeURIComponent(jsonContent));
                const updateStormAssetUrl = (obj) => {
                    for (let key in obj) {
                        const val = obj[key];
                        if (typeof val === 'string' && !val.startsWith('data:') && !val.startsWith('http')) {
                            obj[key] = new URL(val, blizzardBaseUrl).toString();
                        }
                    }
                };

                if (jsonData.assets) {
                    if (jsonData.assets.video) {
                        for (let size in jsonData.assets.video) {
                            updateStormAssetUrl(jsonData.assets.video[size]);
                        }
                    }
                    if (jsonData.assets.poster) {
                        updateStormAssetUrl(jsonData.assets.poster);
                    }
                    if (jsonData.assets.image) {
                        for (let size in jsonData.assets.image) {
                            const img = jsonData.assets.image[size];
                            if (img && img.src && !img.src.startsWith('http')) {
                                jsonData.assets.image[size].src = new URL(img.src, blizzardBaseUrl).toString();
                            }
                        }
                    }
                }

                return `content="${encodeURIComponent(JSON.stringify(jsonData))}"`;
            } catch (winterError) {
                console.error("Error processing frozen content:", winterError);
                return match;
            }
        });

        return iceResponse.status(glacierResponse.status).send(frozenContent);

    } catch (stormError) {
        console.error(`Glacier Error: ${stormError.message}`);
        return iceResponse.status(500).send(`<h1>Glacier Error</h1><p>${stormError.message}</p>`);
    }
}
