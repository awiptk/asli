export default async (request, context) => {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');

  // Validasi URL
  if (!imageUrl) {
    return new Response('Missing image URL parameter', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Validasi URL format
  try {
    new URL(imageUrl);
  } catch {
    return new Response('Invalid image URL', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  try {
    // Cek cache terlebih dahulu
    const cache = caches.default;
    const cacheKey = new Request(request.url);
    
    let cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse) {
      console.log('✅ Cache HIT:', imageUrl);
      // Tambah header untuk tahu ini dari cache
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache-Status', 'HIT');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });
    }

    console.log('❌ Cache MISS:', imageUrl);

    // Fetch gambar dari URL asli
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NetlifyEdgeFunction/1.0)'
      }
    });

    if (!imageResponse.ok) {
      return new Response(`Failed to fetch image: ${imageResponse.status}`, { 
        status: imageResponse.status 
      });
    }

    // Get content type
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Pastikan ini memang gambar
    if (!contentType.startsWith('image/')) {
      return new Response('URL is not an image', { status: 400 });
    }

    // Clone response untuk di-cache
    const responseBody = await imageResponse.arrayBuffer();

    // Buat response dengan cache headers
    const cachedResponse2 = new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 jam
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=31536000', // 1 tahun di CDN
        'X-Cache-Status': 'MISS',
        'Access-Control-Allow-Origin': '*', // CORS jika perlu
      }
    });

    // Simpan ke cache (async, tidak blocking response)
    context.waitUntil(cache.put(cacheKey, cachedResponse2.clone()));

    return cachedResponse2;

  } catch (error) {
    console.error('Error fetching image:', error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

// Config untuk edge function
export const config = {
  path: '/api/image-proxy' // URL endpoint
};
