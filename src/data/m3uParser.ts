import { LiveChannel } from '../types/streaming';

export const parseM3U = (data: string): LiveChannel[] => {
  if (!data || typeof data !== 'string') return [];
  const lines = data.split(/\r?\n/);
  const channels: LiveChannel[] = [];
  let currentChannel: Partial<LiveChannel> = {};

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Extract metadata
      const nameMatch = line.match(/,(.*)$/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i) || line.match(/tvg-logo=([^\s,]+)/i);
      const groupMatch = line.match(/group-title="([^"]+)"/i) || line.match(/group-title=([^\s,]+)/i);
      const idMatch = line.match(/tvg-id="([^"]+)"/i) || line.match(/tvg-id=([^\s,]+)/i);
      const chNoMatch = line.match(/tvg-chno="([^"]+)"/i) || line.match(/tvg-chno=([^\s,]+)/i);

      let name = nameMatch ? nameMatch[1].trim() : '';
      if (!name) {
        // Fallback: search for tvg-name
        const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
        name = tvgNameMatch ? tvgNameMatch[1].trim() : '';
      }

      const logo = logoMatch ? logoMatch[1].trim() : '';
      const category = groupMatch ? groupMatch[1].trim() : 'Geral';
      const rawId = idMatch ? idMatch[1].trim() : `ch-${channels.length + 1}`;
      const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');

      const channelNumber = chNoMatch && !isNaN(Number(chNoMatch[1]))
        ? Number(chNoMatch[1])
        : channels.length + 1;

      const fallbackLogo = '/src/assets/images/live_sports_stadium_1794091825611.jpg';
      const channelLogo = (logo && logo !== '📺' && (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('/')))
        ? logo
        : fallbackLogo;

      currentChannel = {
        id: `iptv-${safeId}-${channels.length + 1}-${Date.now().toString(36).slice(-4)}`,
        name: name || `Canal ${channels.length + 1}`,
        logo: channelLogo,
        category: mapCategory(category),
        currentShow: 'Programação ao vivo',
        nextShow: 'A seguir',
        progressPercentage: Math.floor(Math.random() * 80) + 10,
        viewers: `${Math.floor(Math.random() * 45) + 5}k`,
        schedule: [],
        channelNumber,
      };
    } else if (line.startsWith('#EXTGRP:')) {
      const group = line.replace('#EXTGRP:', '').trim();
      if (currentChannel) {
        currentChannel.category = mapCategory(group);
      }
    } else if (line.startsWith('#')) {
      // Ignore other M3U directives (#EXTM3U, #EXTVLCOPT, #EXT-X-..., etc.)
      continue;
    } else if (
      line.startsWith('http://') ||
      line.startsWith('https://') ||
      line.startsWith('rtmp://') ||
      line.startsWith('rtsp://') ||
      line.startsWith('/') ||
      line.includes('.m3u8') ||
      line.includes('.ts') ||
      line.includes('.mpd')
    ) {
      const streamUrl = line;
      if (currentChannel && currentChannel.name) {
        currentChannel.videoUrl = streamUrl;
        if (!currentChannel.channelNumber) {
          currentChannel.channelNumber = channels.length + 1;
        }
        channels.push(currentChannel as LiveChannel);
        currentChannel = {};
      } else {
        // Plain URL without prior #EXTINF
        const guessedName = decodeURIComponent(streamUrl.split('/').pop()?.replace(/\.(m3u8|ts|mp4|mpd).*/i, '') || '')
          .replace(/[-_+]/g, ' ')
          .trim();
        channels.push({
          id: `raw-ch-${channels.length + 1}-${Date.now().toString(36).slice(-4)}`,
          name: guessedName && guessedName.length > 2 ? guessedName : `Canal ${channels.length + 1}`,
          logo: '/src/assets/images/live_sports_stadium_1794091825611.jpg',
          category: 'Variedades',
          currentShow: 'Transmissão ao vivo',
          nextShow: 'A seguir',
          progressPercentage: 50,
          viewers: '2k',
          schedule: [],
          videoUrl: streamUrl,
          channelNumber: channels.length + 1,
        });
      }

      if (channels.length >= 5000) break;
    }
  }

  return channels;
};

const mapCategory = (cat: string): any => {
  const c = cat.toLowerCase();
  if (c.includes('sport') || c.includes('esporte') || c.includes('desporto') || c.includes('futebol') || c.includes('bola')) return 'Esportes';
  if (c.includes('news') || c.includes('notícia') || c.includes('noticia') || c.includes('jornal') || c.includes('info')) return 'Notícias';
  if (c.includes('movie') || c.includes('filme') || c.includes('serie') || c.includes('série') || c.includes('cinema') || c.includes('telecine') || c.includes('hbo')) return 'Filmes & Séries';
  if (c.includes('kid') || c.includes('infantil') || c.includes('desenho') || c.includes('anim') || c.includes('toon') || c.includes('disney')) return 'Infantil';
  return 'Variedades';
};

