/*
@header({
  searchable: 1,
  filterable: 0,
  quickSearch: 0,
  title: '⚽ 体育cat｜聚合',
  author: 'OpenClaw',
  lang: 'cat',
  style: { type: 'rect', ratio: 0.75 }
})
*/


const __sports_src_0 = (function () {


let host = 'https://www.88kanqiu.la';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const headers = {
  'User-Agent': UA,
  'Referer': host + '/',
  'Accept': 'text/html,application/json,*/*'
};

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function stripHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absUrl(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf('//') === 0) return 'https:' + url;
  if (url.charAt(0) === '/') return host + url;
  return host + '/' + url;
}

function safeJson(text, def) {
  try { return JSON.parse(text || '{}'); } catch (e) { return def || {}; }
}

// TV 端 JS 环境不一定有 atob/TextDecoder；这里按 PHP 源的 base64_decode 逻辑手写 UTF-8 解码。
function base64ToUtf8(str) {
  str = String(str || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  for (let i = 0; i < str.length; i += 4) {
    const c1 = B64_CHARS.indexOf(str.charAt(i));
    const c2 = B64_CHARS.indexOf(str.charAt(i + 1));
    const c3 = B64_CHARS.indexOf(str.charAt(i + 2));
    const c4 = B64_CHARS.indexOf(str.charAt(i + 3));
    if (c1 < 0 || c2 < 0) continue;
    const n = (c1 << 18) | (c2 << 12) | ((c3 < 0 ? 0 : c3) << 6) | (c4 < 0 ? 0 : c4);
    bytes.push((n >> 16) & 255);
    if (str.charAt(i + 2) !== '=') bytes.push((n >> 8) & 255);
    if (str.charAt(i + 3) !== '=') bytes.push(n & 255);
  }

  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      out += String.fromCharCode(b1);
    } else if (b1 >= 0xc0 && b1 < 0xe0) {
      const b2 = bytes[i++] || 0;
      out += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if (b1 >= 0xe0 && b1 < 0xf0) {
      const b2 = bytes[i++] || 0;
      const b3 = bytes[i++] || 0;
      out += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else {
      const b2 = bytes[i++] || 0;
      const b3 = bytes[i++] || 0;
      const b4 = bytes[i++] || 0;
      const cp = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
      const u = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return out;
}

function decodePlaySource(raw) {
  raw = String(raw || '').trim();
  if (!raw) return null;
  for (let prefix = 0; prefix <= 8; prefix++) {
    for (let suffix = 0; suffix <= 4; suffix++) {
      if (raw.length <= prefix + suffix) continue;
      const candidate = raw.slice(prefix, raw.length - suffix);
      try {
        const decoded = base64ToUtf8(candidate);
        const pos = decoded.indexOf('{');
        if (pos < 0) continue;
        const obj = JSON.parse(decoded.slice(pos));
        if (obj && typeof obj === 'object') return obj;
      } catch (e) {}
    }
  }
  return null;
}

function toDirectPlayUrl(url) {
  url = String(url || '').trim();
  if (!url) return '';
  const m = url.match(/[?&]url=([^&]+)/);
  if (m && m[1]) {
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  return url;
}

async function fetchText(url, referer) {
  const hd = {
    'User-Agent': UA,
    'Referer': referer || host + '/',
    'Accept': 'text/html,application/json,*/*'
  };

  // 部分壳只有 Java.req，部分壳只有 req；两种都兼容。
  if (typeof Java !== 'undefined' && Java && Java.req) {
    const r = Java.req(url, { headers: hd });
    return String((r && (r.body || r.content)) || '');
  }
  const r2 = await req(url, { headers: hd });
  return String((r2 && (r2.content || r2.body)) || '');
}

function getClasses() {
  return [
    { type_id: 'live', type_name: '正在直播' },
    { type_id: '0', type_name: '全部直播' },
    { type_id: '1', type_name: '篮球直播' },
    { type_id: '8', type_name: '足球直播' },
    { type_id: '21', type_name: '其他直播' }
  ];
}

function parseList(html, onlyLiving) {
  const list = [];
  const reg = /<li[^>]*class=["'][^"']*list-group-item[^"']*["'][^>]*>[\s\S]*?<\/li>/gi;
  let m;
  while ((m = reg.exec(String(html || ''))) !== null) {
    const item = m[0];
    const hrefMatch = item.match(/<a[^>]+href=["']([^"']*\/live\/\d+\/play[^"']*)["'][^>]*>/i);
    if (!hrefMatch) continue;

    const time = stripHtml((item.match(/class=["'][^"']*category-game-time[^"']*["'][^>]*>([\s\S]*?)<\//i) || [])[1]);
    const gameType = stripHtml((item.match(/class=["'][^"']*game-type[^"']*["'][^>]*>([\s\S]*?)<\//i) || [])[1]);

    const teams = [];
    const teamReg = /class=["'][^"']*team-name[^"']*["'][^>]*>([\s\S]*?)<\//gi;
    let tm;
    while ((tm = teamReg.exec(item)) !== null) teams.push(stripHtml(tm[1]));

    let title = [time, gameType, teams.length >= 2 ? teams[0] + ' vs ' + teams[1] : teams.join(' vs ')].filter(Boolean).join(' ').trim();
    if (!title || title === 'vs') title = stripHtml(item).replace(/直播中|观看|高清|视频直播/g, '').trim();
    if (!title) continue;

    const btnTextMatch = item.match(/<a[^>]+href=["']([^"']*\/live\/\d+\/play[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    const remark = stripHtml(btnTextMatch ? btnTextMatch[2] : '') || '直播中';
    if (onlyLiving && remark !== '直播中') continue;
    const picMatch = item.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);

    list.push({
      vod_id: absUrl(hrefMatch[1]) + '###' + encodeURIComponent(title),
      vod_name: title,
      vod_pic: absUrl(picMatch ? picMatch[1] : '/static/img/default.png'),
      vod_remarks: remark
    });
  }
  return list;
}

async function fetchGroupList(group) {
  let paths = ['/'];
  if (group === 'basketball') {
    paths = ['/match/1/live', '/match/2/live', '/match/20/live', '/match/4/live'];
  } else if (group === 'football') {
    paths = ['/match/3/live', '/match/8/live', '/match/9/live', '/match/10/live', '/match/14/live', '/match/15/live', '/match/12/live', '/match/13/live', '/match/7/live', '/match/11/live', '/match/27/live', '/match/26/live', '/match/31/live', '/match/23/live'];
  } else if (group === 'other') {
    paths = ['/match/21/live', '/match/29/live', '/match/25/live', '/match/19/live', '/match/38/live'];
  }

  const all = [];
  const seen = {};
  for (let i = 0; i < paths.length; i++) {
    try {
      const html = await fetchText(host + paths[i], host + '/');
      const items = parseList(html);
      for (let j = 0; j < items.length; j++) {
        const key = items[j].vod_id;
        if (seen[key]) continue;
        seen[key] = true;
        all.push(items[j]);
      }
    } catch (e) {}
  }
  return all;
}

async function init(cfg) {
  if (cfg && cfg.ext && String(cfg.ext).indexOf('http') === 0) host = String(cfg.ext).trim().replace(/\/$/, '');
}

async function home(filter) {
  return JSON.stringify({ class: getClasses(), filters: {} });
}

async function homeVod() {
  return await category('0', 1, false, {});
}

async function category(tid, pg, filter, extend) {
  tid = String((extend && extend.cateId) || tid || '0');
  pg = parseInt(pg) || 1;
  let group = '';
  if (tid === '1' || tid === 'basketball') group = 'basketball';
  else if (tid === '8' || tid === 'football') group = 'football';
  else if (tid === '21' || tid === 'other') group = 'other';

  let list = [];
  try {
    const onlyLiving = tid === 'live';
    list = group ? await fetchGroupList(group) : parseList(await fetchText(host + '/', host + '/'), onlyLiving);
  } catch (e) {
    list = [];
  }
  return JSON.stringify({ code: 1, msg: '数据列表', page: pg, pagecount: 1, limit: 20, total: list.length, list });
}

async function detail(id) {
  id = Array.isArray(id) ? id[0] : id;
  let realId = String(id || '');
  let displayName = '赛事直播';
  if (realId.indexOf('###') >= 0) {
    const parts = realId.split('###');
    realId = parts[0];
    try { displayName = decodeURIComponent(parts[1] || '赛事直播'); } catch (e) { displayName = parts[1] || '赛事直播'; }
  }

  const match = realId.match(/\/live\/(\d+)\/play/);
  const gameId = match ? match[1] : '';
  if (!gameId) return JSON.stringify({ code: 1, page: 1, pagecount: 1, limit: 0, total: 0, list: [] });

  let playUrls = '';
  try {
    const content = await fetchText(host + '/live/' + gameId + '/source', realId);
    const json = safeJson(content, {});
    const data = decodePlaySource(json.data || '');
    const links = (data && data.links) || [];
    const arr = [];
    for (let i = 0; i < links.length; i++) {
      const u = toDirectPlayUrl(links[i].url || '');
      if (u) arr.push((links[i].name || ('线路' + (i + 1))) + '$' + u);
    }
    playUrls = arr.join('#');
  } catch (e) {
    playUrls = '';
  }

  return JSON.stringify({
    code: 1,
    msg: '数据列表',
    page: 1,
    pagecount: 1,
    limit: 1,
    total: 1,
    list: [{
      vod_id: realId,
      vod_name: displayName,
      vod_pic: host + '/static/img/default.png',
      vod_remarks: '直播中',
      vod_play_from: '88看球',
      vod_play_url: playUrls,
      vod_content: '实时体育直播'
    }]
  });
}

async function search(wd, quick, pg) {
  return JSON.stringify({ code: 1, msg: '数据列表', page: parseInt(pg) || 1, pagecount: 1, limit: 20, total: 0, list: [] });
}

async function play(flag, id, flags) {
  const isDirect = /\.(m3u8|mp4)(\?|$)/i.test(String(id || ''));
  return JSON.stringify({ parse: isDirect ? 0 : 1, url: id, header: headers });
}

// OK影视/部分 CAT 壳兼容入口。
async function homeContent(filter) { return safeJson(await home(filter), { class: [], filters: {} }); }
async function homeVideoContent() { return safeJson(await homeVod(), { list: [] }); }
async function categoryContent(tid, pg, filter, extend) { return safeJson(await category(tid, pg, filter, extend || {}), { list: [] }); }
async function detailContent(ids) { return safeJson(await detail(ids), { list: [] }); }
async function searchContent(wd, quick, pg) { return safeJson(await search(wd, quick, pg || 1), { list: [] }); }
async function playerContent(flag, id, flags) { return safeJson(await play(flag, id, flags), { parse: 1, url: id }); }
  return { init, home, homeVod, category, search, detail, play, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent };
})();


const __sports_src_1 = (function () {


let host = 'https://kafeizhibo.cc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const headers = {
  'User-Agent': UA,
  'Referer': host + '/pc',
  'Accept': 'application/json, text/plain, */*'
};

function safeJson(text, def) {
  try { return JSON.parse(text || '{}'); } catch (e) { return def || {}; }
}

function absUrl(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf('//') === 0) return 'https:' + url;
  if (url.charAt(0) === '/') return host + url;
  return host + '/' + url;
}

function clean(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchJson(url) {
  const r = await req(url, { headers });
  return safeJson((r && (r.content || r.body)) || '{}', {});
}

function getClasses() {
  return [
    { type_id: 'all', type_name: '全部直播' },
    { type_id: 'hot', type_name: '热门直播' },
    { type_id: 'nba', type_name: 'NBA' },
    { type_id: '1', type_name: '足球直播' },
    { type_id: '2', type_name: '篮球直播' },
    { type_id: '3', type_name: '网球直播' },
    { type_id: '19', type_name: '台球直播' },
    { type_id: 'schedule', type_name: '赛程列表' },
    { type_id: 'recordings', type_name: '录像' }
  ];
}

function titleOf(it) {
  const mi = it.match_info || {};
  const league = it.league_name || mi.league_name || it.league || '';
  const home = it.home_team || mi.home_team || (it.homeTeam && it.homeTeam.name) || '';
  const away = it.away_team || mi.away_team || (it.awayTeam && it.awayTeam.name) || '';
  const title = it.title || it.name || '';
  if (title && title !== it.name) return clean(title);
  if (league && home && away) return clean(league + ' ' + home + ' vs ' + away);
  return clean(title || it.name || ('直播间 ' + (it.room_id || it.id || '')));
}

function remarkOf(it) {
  const parts = [];
  const status = it.status || (it.match_info && it.match_info.status) || '';
  if (status === 'live' || it.is_live) parts.push('直播中');
  else if (status === 'online') parts.push('在线');
  else if (status === 'upcoming') parts.push('未开赛');
  else if (status) parts.push(status);
  const score = (it.home_score !== undefined && it.away_score !== undefined) ? (it.home_score + '-' + it.away_score) : '';
  if (score && score !== '0-0') parts.push(score);
  if (it.heat) parts.push('热度:' + it.heat);
  if (it.name && it.title && it.name !== it.title) parts.push(it.name);
  return clean(parts.join(' ')) || '直播';
}

function picOf(it) {
  return absUrl(it.screenshot || it.avatar || it.home_team_logo || it.away_team_logo || (it.homeTeam && it.homeTeam.logo) || (it.awayTeam && it.awayTeam.logo) || '/images/logo.png');
}

function itemToVod(it) {
  const roomId = it.room_id || (it.archor && it.archor.room_id) || (Array.isArray(it.archors) && it.archors[0] && it.archors[0].room_id) || '';
  if (!roomId) return null;
  return {
    vod_id: String(roomId) + '###' + encodeURIComponent(titleOf(it)),
    vod_name: titleOf(it),
    vod_pic: picOf(it),
    vod_remarks: remarkOf(it)
  };
}

function recordingToVod(it) {
  const matchId = it.match_id || it.id || '';
  if (!matchId) return null;
  const name = titleOf(it);
  return {
    vod_id: 'rec$' + String(matchId) + '###' + encodeURIComponent(name),
    vod_name: name,
    vod_pic: absUrl(it.cover_image || it.screenshot || it.home_team_logo || it.away_team_logo || '/images/logo.png'),
    vod_remarks: clean([it.start_time || '', it.recording_count ? ('录像:' + it.recording_count) : '录像'].filter(Boolean).join(' '))
  };
}

async function init(cfg) {
  if (cfg && cfg.ext && String(cfg.ext).indexOf('http') === 0) host = String(cfg.ext).trim().replace(/\/$/, '');
}

async function home(filter) {
  return JSON.stringify({ class: getClasses(), filters: {} });
}

async function homeVod() {
  return await category('all', 1, false, {});
}

async function category(tid, pg, filter, extend) {
  tid = String((extend && extend.cateId) || tid || 'all');
  pg = parseInt(pg) || 1;
  const size = 30;
  let apiUrl = '';

  if (tid === 'schedule') {
    apiUrl = host + '/api/v1/schedule?type=all&page=' + pg + '&size=' + size + '&_t=' + Date.now();
  } else if (tid === 'recordings') {
    apiUrl = host + '/api/v1/recordings?page=' + pg + '&size=' + size + '&_t=' + Date.now();
  } else if (tid === 'nba') {
    // 官网没有单独 nba 参数；用篮球赛程聚合后按 NBA 关键字过滤，有 NBA 时显示 NBA，无 NBA 时为空不混入其他篮球。
    apiUrl = host + '/api/v1/schedule?type=2&page=' + pg + '&size=100&_t=' + Date.now();
  } else {
    const type = tid === 'all' ? '' : tid;
    apiUrl = host + '/api/v1/archor?type=' + encodeURIComponent(type) + '&_t=' + Date.now();
  }

  let list = [];
  let total = 0;
  try {
    const json = await fetchJson(apiUrl);
    const data = Array.isArray(json.data) ? json.data : [];
    if (tid === 'recordings') {
      const seen = {};
      for (let i = 0; i < data.length; i++) {
        const vod = recordingToVod(data[i]);
        if (vod && !seen[vod.vod_id]) { seen[vod.vod_id] = true; list.push(vod); }
      }
    } else {
      // 站点按主播房间列条目, 同一场比赛会有多个房间(解说/原声)导致列表重复;
      // 这里按比赛标题聚合: 列表一场一条, 所有房间号并入 vod_id, 详情页展开为多条线路
      const agg = {};
      const order = [];
      function roomsOf(it) {
        const rooms = [];
        if (it.room_id) rooms.push(String(it.room_id));
        const archors = Array.isArray(it.archors) ? it.archors : [];
        for (let j = 0; j < archors.length; j++) {
          const rid = archors[j] && (archors[j].room_id || archors[j].id);
          if (rid) rooms.push(String(rid));
        }
        if (it.archor && it.archor.room_id) rooms.push(String(it.archor.room_id));
        return rooms;
      }
      for (let i = 0; i < data.length; i++) {
        const it = data[i];
        const title = titleOf(it);
        if (tid === 'nba' && !/NBA|美职篮|美国职业篮球/i.test(title)) continue;
        const rooms = roomsOf(it);
        if (!rooms.length) continue;
        // 同一场比赛无论标题写法差异(如"VS 曼彻斯特城"/"vs 曼城"), match_id 相同, 按它聚合才不会重复
        const mi = it.match_info || {};
        const key = (it.match_id || mi.match_id) ? 'm' + (it.match_id || mi.match_id) : title;
        if (!agg[key]) { agg[key] = { item: it, rooms: [] }; order.push(key); }
        if ((it.heat || 0) > (agg[key].item.heat || 0)) agg[key].item = it;
        for (let j = 0; j < rooms.length; j++) if (agg[key].rooms.indexOf(rooms[j]) < 0) agg[key].rooms.push(rooms[j]);
      }
      for (let i = 0; i < order.length; i++) {
        const b = agg[order[i]];
        const vod = itemToVod(Object.assign({}, b.item, { room_id: b.rooms.join(',') }));
        if (vod) list.push(vod);
      }
    }
    total = list.length;
  } catch (e) {
    list = [];
  }
  return JSON.stringify({ code: 1, msg: '数据列表', page: pg, pagecount: 1, limit: size, total, list });
}

async function detail(id) {
  id = Array.isArray(id) ? id[0] : id;
  let roomId = String(id || '');
  let displayName = '咖啡直播';
  if (roomId.indexOf('###') >= 0) {
    const parts = roomId.split('###');
    roomId = parts[0];
    try { displayName = decodeURIComponent(parts[1] || displayName); } catch (e) { displayName = parts[1] || displayName; }
  }
  if (roomId.indexOf('rec$') === 0) {
    const matchId = roomId.slice(4);
    let vod = {
      vod_id: roomId,
      vod_name: displayName,
      vod_pic: host + '/images/logo.png',
      vod_remarks: '录像',
      vod_play_from: '咖啡录像',
      vod_play_url: '',
      vod_content: '咖啡直播赛事录像'
    };
    try {
      const json = await fetchJson(host + '/api/v1/match/' + encodeURIComponent(matchId) + '/recordings?_t=' + Date.now());
      const data = json.data || {};
      const match = data.match || {};
      const urls = [];
      const replays = Array.isArray(data.replays) ? data.replays : [];
      const highlights = Array.isArray(data.highlights) ? data.highlights : [];
      for (let i = 0; i < replays.length; i++) {
        if (replays[i].video_url) urls.push(clean(replays[i].title || ('录像' + (i + 1))) + '$' + replays[i].video_url);
      }
      for (let i = 0; i < highlights.length; i++) {
        if (highlights[i].video_url) urls.push(clean(highlights[i].title || ('集锦' + (i + 1))) + '$' + highlights[i].video_url);
      }
      vod = {
        vod_id: roomId,
        vod_name: titleOf(match) || displayName,
        vod_pic: absUrl((replays[0] && replays[0].cover_image) || match.cover_image || match.home_team_logo || match.away_team_logo || '/images/logo.png'),
        vod_remarks: clean([match.start_time || '', match.home_score !== undefined ? (match.home_score + '-' + match.away_score) : ''].filter(Boolean).join(' ')) || '录像',
        vod_play_from: '咖啡录像',
        vod_play_url: urls.join('#'),
        vod_content: '咖啡直播赛事录像'
      };
    } catch (e) {}
    return JSON.stringify({ code: 1, msg: '数据列表', page: 1, pagecount: 1, limit: 1, total: 1, list: [vod] });
  }
  if (!roomId) return JSON.stringify({ code: 1, page: 1, pagecount: 1, limit: 0, total: 0, list: [] });

  let vod = {
    vod_id: roomId,
    vod_name: displayName,
    vod_pic: host + '/images/logo.png',
    vod_remarks: '直播',
    vod_play_from: '咖啡直播',
    vod_play_url: '',
    vod_content: '咖啡直播实时体育直播'
  };

  try {
    // vod_id 可能含多个房间号(同场比赛的解说/原声房间合并), 逐个取流展开为多条线路
    const roomList = roomId.split(',').filter(Boolean);
    const urls = [];
    const seen = {};

    function addLine(name, url) {
      url = String(url || '').trim();
      if (!url || seen[url]) return;
      seen[url] = true;
      urls.push(clean(name || ('线路' + (urls.length + 1))) + '$' + url);
    }

    for (let k = 0; k < roomList.length; k++) {
      const rj = await fetchJson(host + '/api/v1/room/' + encodeURIComponent(roomList[k]) + '?_t=' + Date.now());
      const data = rj.data || {};
      const room = data.room_info || {};
      const archor = data.archor || {};
      const tag = clean(archor.name || room.title || ('线路' + (k + 1)));
      const signals = Array.isArray(data.signals) ? data.signals : [];
      for (let i = 0; i < signals.length; i++) {
        const sn = clean(signals[i].name || '');
        // 信号名本身就是"直播12"/"原声12"这种叫法, 直接用; 重名但流不同时补序号区分
        let name = sn || tag;
        const key0 = 'n:' + name;
        if (seen[key0] && !seen[signals[i].stream_url]) name = name + '(' + (k + 1) + ')';
        addLine(name, signals[i].stream_url);
      }
      addLine(tag, archor.stream_url);
      if (k === 0) {
        vod.vod_pic = absUrl(archor.screenshot || room.avatar || archor.avatar || '/images/logo.png');
        vod.vod_remarks = remarkOf(Object.assign({}, room, archor));
        vod.vod_content = clean(room.notice || room.notice_h5 || '咖啡直播实时体育直播');
      }
    }
    vod.vod_play_url = urls.join('#');
  } catch (e) {}

  return JSON.stringify({ code: 1, msg: '数据列表', page: 1, pagecount: 1, limit: 1, total: 1, list: [vod] });
}

async function search(wd, quick, pg) {
  return JSON.stringify({ code: 1, msg: '数据列表', page: parseInt(pg) || 1, pagecount: 1, limit: 20, total: 0, list: [] });
}

async function play(flag, id, flags) {
  return JSON.stringify({ parse: 0, url: id, header: headers });
}

async function homeContent(filter) { return safeJson(await home(filter), { class: [], filters: {} }); }
async function homeVideoContent() { return safeJson(await homeVod(), { list: [] }); }
async function categoryContent(tid, pg, filter, extend) { return safeJson(await category(tid, pg, filter, extend || {}), { list: [] }); }
async function detailContent(ids) { return safeJson(await detail(ids), { list: [] }); }
async function searchContent(wd, quick, pg) { return safeJson(await search(wd, quick, pg || 1), { list: [] }); }
async function playerContent(flag, id, flags) { return safeJson(await play(flag, id, flags), { parse: 0, url: id }); }
  return { init, home, homeVod, category, search, detail, play, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent };
})();


const __sports_src_3 = (function () {


let host = 'https://m.jrskk.com';
const hosts = ['https://m.jrskk.com', 'https://m.jrs21.com', 'https://www.jrs33.com', 'https://3.swjrzx.com'];
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const defaultPic = 'https://im-imgs-bucket.oss-accelerate.aliyuncs.com/icon-192.png';
let cacheTime = 0;
let cacheHtml = '';
// 站点已改为 JS 动态渲染: 首页只下发模板, 真实赛程在 OSS 的 index.js 里
const INDEX_JS = 'https://im-imgs-bucket.oss-accelerate.aliyuncs.com/index.js?t_5';
let cachePlayHosts = {};

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function stripHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

function absUrl(url, base) {
  url = String(url || '').trim();
  base = base || host;
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf('//') === 0) return 'https:' + url;
  if (url.charAt(0) === '/') return base + url;
  return base + '/' + url;
}

function utf8ToBase64Url(str) {
  str = unescape(encodeURIComponent(String(str || '')));
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = str.charCodeAt(i + 1);
    const c3 = str.charCodeAt(i + 2);
    out += B64_CHARS.charAt(c1 >> 2);
    out += B64_CHARS.charAt(((c1 & 3) << 4) | ((c2 || 0) >> 4));
    out += isNaN(c2) ? '=' : B64_CHARS.charAt(((c2 & 15) << 2) | ((c3 || 0) >> 6));
    out += isNaN(c3) ? '=' : B64_CHARS.charAt(c3 & 63);
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUtf8(str) {
  str = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  let bytes = [];
  for (let i = 0; i < str.length; i += 4) {
    const c1 = B64_CHARS.indexOf(str.charAt(i));
    const c2 = B64_CHARS.indexOf(str.charAt(i + 1));
    const c3 = B64_CHARS.indexOf(str.charAt(i + 2));
    const c4 = B64_CHARS.indexOf(str.charAt(i + 3));
    if (c1 < 0 || c2 < 0) continue;
    const n = (c1 << 18) | (c2 << 12) | ((c3 < 0 ? 0 : c3) << 6) | (c4 < 0 ? 0 : c4);
    bytes.push((n >> 16) & 255);
    if (str.charAt(i + 2) !== '=') bytes.push((n >> 8) & 255);
    if (str.charAt(i + 3) !== '=') bytes.push(n & 255);
  }
  let raw = '';
  for (let j = 0; j < bytes.length; j++) raw += String.fromCharCode(bytes[j]);
  try { return decodeURIComponent(escape(raw)); } catch (e) { return raw; }
}

function safeJson(text, def) { try { return JSON.parse(text || '{}'); } catch (e) { return def || {}; } }

function matchCategory(tid, league, name, stype, hot) {
  tid = String(tid || 'all');
  const text = league + ' ' + name;
  if (tid === 'all' || tid === 'live') return true;
  if (tid === 'hot') return !!hot || /(NBA|CBA|英超|西甲|意甲|德甲|法甲|欧冠|中超|世界杯|世俱杯|亚冠|热门)/i.test(text);
  if (tid === 'basketball') return stype === 'lq' || /(NBA|CBA|WNBA|NBL|篮球|篮)/i.test(text);
  if (tid === 'football') return stype === 'zq' || (/(足球|英超|西甲|意甲|德甲|法甲|欧冠|欧联|中超|亚冠|足协|世界杯|世俱|巴西甲|巴西乙|日职|韩K|联赛|杯)/i.test(text) && !/(NBA|CBA|WNBA|NBL|篮球|篮)/i.test(text));
  if (tid === 'other') return !matchCategory('basketball', league, name, stype, hot) && !matchCategory('football', league, name, stype, hot);
  return true;
}

async function fetchText(url, referer) {
  const hd = { 'User-Agent': UA, 'Referer': referer || host + '/', 'Accept': 'text/html,application/json,*/*', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' };
  if (typeof Java !== 'undefined' && Java && Java.req) {
    const r = await Java.req(url, { headers: hd });
    if (typeof r === 'string') return r;
    return String((r && (r.body || r.content || r.data)) || '');
  }
  const r2 = await req(url, { headers: hd });
  return String((r2 && (r2.content || r2.body)) || '');
}

function parsePlayHosts(html) {
  const map = {};
  const m = String(html || '').match(/window\.PLAY_HOSTS\s*=\s*\{([\s\S]*?)\};/);
  if (m) {
    const reg = /(line\d+)\s*:\s*atob\(\s*["']([^"']+)["']\s*\)/g;
    let r;
    while ((r = reg.exec(m[1])) !== null) {
      try { map[r[1]] = atobSafe(r[2]); } catch (e) {}
    }
  }
  return map;
}

function atobSafe(b64) {
  if (typeof atob === 'function') {
    try { return atob(b64); } catch (e) {}
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const str = String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  let out = '';
  for (let i = 0; i < str.length; i += 4) {
    const g = [];
    for (let j = 0; j < 4; j++) {
      const ch = str.charAt(i + j);
      g[j] = ch === '=' ? -1 : chars.indexOf(ch);
    }
    if (g[0] < 0 || g[1] < 0) continue;
    out += String.fromCharCode((g[0] << 2 | g[1] >> 4) & 255);
    if (g[2] >= 0) out += String.fromCharCode(((g[1] & 15) << 4 | g[2] >> 2) & 255);
    if (g[3] >= 0) out += String.fromCharCode(((g[2] & 3) << 6 | g[3]) & 255);
  }
  return out;
}

// ==================== XXTEA 解密 (移植站点自带的 xxtea-js, KEY 固定) ====================
const JRS_XK = 'ABCDEFGHIJKLMNOPQRSTUVWX';

function __xu32(r) { return 4294967295 & r; }
function __xmx(r, e, t, n, o, a) { return (t >>> 5 ^ e << 2) + (e >>> 3 ^ t << 4) ^ (r ^ e) + (a[3 & n ^ o] ^ t); }
function __xToU32(r, e) {
  let t; const n = r.length; let o = n >> 2;
  if (0 !== (3 & n)) ++o;
  e ? (t = new Array(o + 1))[o] = n : t = new Array(o);
  for (let a = 0; a < n; ++a) t[a >> 2] |= r.charCodeAt(a) << ((3 & a) << 3);
  return t;
}
function __xToBytes(r, e) {
  let t = r.length; let n = t << 2;
  if (e) { const o = r[t - 1]; if (o < (n -= 4) - 3 || n < o) return null; n = o; }
  for (let a = 0; a < t; a++) r[a] = String.fromCharCode(255 & r[a], r[a] >>> 8 & 255, r[a] >>> 16 & 255, r[a] >>> 24 & 255);
  const c = r.join('');
  return e ? c.substring(0, n) : c;
}
function __xDecrypt(raw, key) {
  const v = __xToU32(raw, false);
  const k = __xToU32(key, false);
  if (k.length < 4) k.length = 4;
  let t; let n; let o; let a; const i = v.length; const h = i - 1;
  if (i < 2) return raw;
  for (t = v[0], o = __xu32(Math.floor(6 + 52 / i) * 2654435769); 0 !== o; o = __xu32(o - 2654435769)) {
    for (a = o >>> 2 & 3, n = h; 0 < n; --n) { const nb = v[n - 1]; t = v[n] = __xu32(v[n] - __xmx(o, t, nb, n, a, k)); }
    const nb2 = v[h];
    t = v[0] = __xu32(v[0] - __xmx(o, t, nb2, 0, a, k));
  }
  return __xToBytes(v, true);
}
function __xUtf8Decode(r) {
  const e = r.length;
  if (0 === e) return '';
  if (/^[\x00-\x7f]*$/.test(r) || !/^[\x00-\xff]*$/.test(r)) return r;
  const t = new Array(e);
  let n = 0; let o = 0;
  while (n < e && o < r.length) {
    const c = r.charCodeAt(o++);
    if (c < 128) t[n++] = c;
    else if (c < 224) { if (o >= r.length) return r; t[n++] = (31 & c) << 6 | 63 & r.charCodeAt(o++); }
    else if (c < 240) { if (o + 1 >= r.length) return r; t[n++] = (15 & c) << 12 | (63 & r.charCodeAt(o++)) << 6 | 63 & r.charCodeAt(o++); }
    else return r;
  }
  return String.fromCharCode.apply(String, n < e ? t.slice(0, n) : t);
}
// 播放页密文 -> {"ts":...,"url":"...m3u8"} 明文
function jrsDecrypt(enc) {
  try {
    const dec = __xDecrypt(atobSafe(enc), JRS_XK);
    return dec ? __xUtf8Decode(dec) : '';
  } catch (e) { return ''; }
}

// 解密出的流先探测可读性, 死流(如上游停播 404)直接回落嗅探
async function jrsProbe(url) {
  try {
    const r = (typeof Java !== 'undefined' && Java && Java.req)
      ? await Java.req(url, { headers: { 'User-Agent': UA } })
      : await req(url, { headers: { 'User-Agent': UA } });
    if (typeof r === 'string') return r.length > 0;
    const code = Number((r && (r.statusCode || r.status || r.code)) || 0);
    const body = String((r && (r.content || r.body || r.data)) || '');
    if (!code) return body.length > 0;
    return code >= 200 && code < 300 && body.length > 0;
  } catch (e) { return false; }
}

async function fetchHome(force) {
  if (!force && cacheHtml && Date.now() - cacheTime < 60000) return cacheHtml;
  let tmpl = '';
  // 首页只剩模板(含 PLAY_HOSTS), 真实赛程由 OSS 上的 index.js 动态下发
  for (let i = 0; i < hosts.length; i++) {
    try {
      const html = await fetchText(hosts[i] + '/', hosts[i] + '/');
      if (html && (/PLAY_HOSTS|lab_team|JRKAN|index\.js/i).test(html)) {
        host = hosts[i]; tmpl = html; break;
      }
    } catch (e) {}
  }
  if (!tmpl) tmpl = cacheHtml || '';
  const playHosts = parsePlayHosts(tmpl);
  if (Object.keys(playHosts).length) cachePlayHosts = playHosts;
  try {
    const js = await fetchText(INDEX_JS, host + '/');
    if (js && /lab_team_home|data-lid/.test(js)) {
      // index.js 用 document.write 逐段拼 HTML, 这里还原成完整片段
      const built = js.replace(/document\.write\(\s*'([\s\S]*?)'\s*\);/g, function (a, one) {
        let seg = one.replace(/\\'/g, "'").replace(/\\\//g, '/');
        // 还原 href="' + getPlayUrl("line1","825706") + '" 这种运行时拼接
        seg = seg.replace(/'\s*\+\s*getPlayUrl\(\s*["'](line\d+)["']\s*,\s*["'](\d+)["']\s*\)\s*\+\s*'/g,
          function (mk, line, pid) {
            const base = cachePlayHosts[line] || '';
            return base ? (base + '/play/steam' + pid + '.html') : 'javascript:void(0)';
          });
        return seg;
      });
      cacheHtml = built;
      cacheTime = Date.now();
      return built;
    }
  } catch (e) {}
  return tmpl;
}

function firstMatch(text, reg) { const m = String(text || '').match(reg); return m ? m[1] : ''; }

function parseList(html, tid) {
  const list = [];
  const reg = /<ul\b[^>]*class=["'][^"']*\bitem\b[^"']*["'][^>]*>[\s\S]*?<\/ul>/gi;
  let m;
  while ((m = reg.exec(String(html || ''))) !== null) {
    const item = m[0];
    if (/sub_head/i.test(item)) continue;
    const links = [];
    const areg = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let am;
    while ((am = areg.exec(item)) !== null) {
      const attrs = am[1];
      const cls = firstMatch(attrs, /class=["']([^"']*)["']/i) || '';
      if (!/(^|\s)me(\s|$)/.test(cls)) continue;
      if (/ok_kqt/i.test(cls)) continue;
      const href = firstMatch(attrs, /href=["']([^"']+)["']/i) || firstMatch(attrs, /data-play=["']([^"']+)["']/i);
      if (!href || href === 'javascript:void(0)' || href === '.html') continue;
      const name = stripHtml(am[2]) || ('线路' + (links.length + 1));
      links.push({ name, url: absUrl(href, host) });
    }
    if (!links.length) continue;
    const league = stripHtml(firstMatch(item, /class=["'][^"']*lab_events[^"']*["'][\s\S]*?<span[^>]*class=["']name["'][^>]*>([\s\S]*?)<\/span>/i));
    const time = stripHtml(firstMatch(item, /class=["'][^"']*lab_time[^"']*["'][^>]*>([\s\S]*?)<\/li>/i));
    const home = stripHtml(firstMatch(item, /class=["'][^"']*lab_team_home[^"']*["'][\s\S]*?<strong[^>]*class=["']name["'][^>]*>([\s\S]*?)<\/strong>/i));
    const away = stripHtml(firstMatch(item, /class=["'][^"']*lab_team_away[^"']*["'][\s\S]*?<strong[^>]*class=["']name["'][^>]*>([\s\S]*?)<\/strong>/i));
    const stype = firstMatch(item, /data-stype=["']([^"']+)["']/i);
    const hot = /class=["'][^"']*hot[^"']*["']/i.test(item);
    const isLive = /lab_vs[^>]*class=["'][^"']*active/i.test(item) || /\bplay\b/.test(item.slice(0, 220));
    if (String(tid) === 'live' && !isLive) continue;
    let name = [time, league, [home, away].filter(Boolean).join(' vs ')].filter(Boolean).join(' ');
    if (!name) name = stripHtml(item).slice(0, 80) || '赛事直播';
    if (!matchCategory(tid, league, name, stype, hot)) continue;
    const pic = absUrl(firstMatch(item, /<img[^>]+src=["']([^"']+)["']/i) || defaultPic, host);
    const payload = { name, pic, links };
    list.push({ vod_id: 'jrs$' + utf8ToBase64Url(JSON.stringify(payload)), vod_name: name, vod_pic: pic, vod_remarks: links.map(x => x.name).slice(0, 3).join('/') || '直播' });
  }
  return list;
}

function getClasses() {
  return [
    { type_id: 'live', type_name: '正在直播' },
    { type_id: 'all', type_name: '全部赛程' },
    { type_id: 'basketball', type_name: '篮球直播' },
    { type_id: 'football', type_name: '足球直播' },
    { type_id: 'hot', type_name: '热门赛事' },
    { type_id: 'other', type_name: '其他赛事' }
  ];
}

async function init(cfg) { if (cfg && cfg.ext && String(cfg.ext).indexOf('http') === 0) host = String(cfg.ext).replace(/\/$/, ''); }
async function home(filter) { return JSON.stringify({ class: getClasses(), filters: {} }); }
async function homeVod() { return await category('live', 1, false, {}); }
async function category(tid, pg, filter, extend) {
  const html = await fetchHome(false);
  const list = parseList(html, tid || 'all');
  return JSON.stringify({ code: 1, msg: '数据列表', page: parseInt(pg) || 1, pagecount: 1, limit: list.length, total: list.length, list });
}
async function detail(id) {
  id = Array.isArray(id) ? id[0] : id;
  let payload = null;
  id = String(id || '');
  if (id.indexOf('jrs$') === 0) payload = safeJson(base64UrlToUtf8(id.slice(4)), null);
  if (!payload && /^https?:\/\//i.test(id)) payload = { name: '赛事直播', pic: defaultPic, links: [{ name: '直播', url: id }] };
  if (!payload) return JSON.stringify({ code: 1, list: [], page: 1, pagecount: 1, total: 0 });
  // 抓 steam 播放页, 枚举页面上的全部真实线路(data-play)
  // 首页那三条镜像线路(直播①②③)与页面线路是同一场信号, 会重叠, 不再输出
  let links = [];
  try {
    const first = (payload.links || [])[0] && payload.links[0].url;
    if (first && /play\/steam/i.test(first)) {
      const page = await fetchText(first, host + '/');
      const origin = (first.match(/^https?:\/\/[^\/]+/i) || [''])[0];
      const areg = /<a\b([^>]*class=["'][^"']*\bme\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let am;
      const seen = {};
      let n = 0;
      while ((am = areg.exec(page)) !== null) {
        const attrs = am[1];
        if (/ok_kqt/i.test(attrs)) continue;
        const dp = firstMatch(attrs, /data-play=["']([^"']*)["']/i) || firstMatch(attrs, /href=["']([^"']*)["']/i);
        if (!dp || dp === '=&id2=' || dp === 'javascript:void(0)' || dp === '.html' || dp === '') continue;
        if (!/^\//.test(dp) && !/^https?:/i.test(dp)) continue;
        // 按播放器类型归类命名, 避免页面上 ①②③ 圈码序号与镜像线路混淆
        const kind = /sm\.html/i.test(dp) ? '线路' : /mgxl/i.test(dp) ? '高清M' : /wlive/i.test(dp) ? '高清W'
          : /\/wen\//i.test(dp) ? '高清E' : /\/pao\//i.test(dp) ? '高清P' : '线路';
        const label = stripHtml(am[2]).replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '').trim();
        // 移除主播解说类线路(主播房间信号, 非比赛转播)
        if (/主播/.test(label)) continue;
        n++;
        const name = label ? (label + ' ' + kind + n) : (kind + n);
        const url = absUrl(dp, origin);
        const idm = dp.match(/id=([^&]*)/);
        const key = dp.split('?')[0] + '|' + (idm ? idm[1] : '');
        if (seen[key]) continue;
        seen[key] = 1;
        links.push({ name, url });
      }
    }
  } catch (e) {}
  // 兜底: 页面没枚举到任何真实线路时, 保留原镜像线路可播
  if (!links.length) links = (payload.links || []).slice(0, 1);
  if (!links.length) links = [{ name: '直播', url: id }];
  const playUrl = links.map((x, i) => (x.name || ('线路' + (i + 1))) + '$' + x.url).join('#');
  return JSON.stringify({ code: 1, msg: '数据列表', page: 1, pagecount: 1, limit: 1, total: 1, list: [{ vod_id: id, vod_name: payload.name || '赛事直播', vod_pic: payload.pic || defaultPic, vod_remarks: '直播', vod_content: 'JRKAN 体育赛事直播。部分线路为网页播放器，播放器可嗅探播放。', vod_play_from: 'JRS直播', vod_play_url: playUrl }] });
}
async function search(wd, quick, pg) { return JSON.stringify({ code: 1, msg: '数据列表', page: parseInt(pg) || 1, pagecount: 1, limit: 20, total: 0, list: [] }); }
// 播放页 -> /play/sm.html -> /play/{id}.html -> iframe src 里带真实 m3u8
function extractM3u8(html) {
  const text = String(html || '');
  const m = text.match(/[?&]id=([^"&]+)/);
  if (m) {
    try {
      const u = decodeURIComponent(decodeURIComponent(m[1]));
      const mm = u.match(/https?:\/\/[^"'\s]+?\.m3u8[^"'\s]*/i) || u.match(/\/\/[^"'\s]+?\.m3u8[^"'\s]*/i);
      if (mm) {
        let url = mm[0];
        if (url.indexOf('//') === 0) url = 'https:' + url;
        return url;
      }
    } catch (e) {}
  }
  const d = text.match(/https?:\/\/[^"'\s]+?\.m3u8[^"'\s]*/i);
  return d ? d[0] : '';
}

async function play(flag, id, flags) {
  id = String(id || '');
  if (/\.(m3u8|mp4|flv)(\?|$)/i.test(id)) {
    return JSON.stringify({ parse: 0, url: id, header: { 'User-Agent': UA, 'Referer': host + '/' } });
  }
  if (/\/(play\/)?(mgxl|wlive|wen|pao|txf|kbs)\//i.test(id)) {
    // 播放页内嵌 XXTEA 加密的流参数(KEY 固定), 直接解出真实 m3u8 直连播放;
    // 解密失败或流已失效(如上游停播 404)时回落 WebView 嗅探
    try {
      const encPage = await fetchText(id, host + '/');
      const enc = firstMatch(encPage, /en_str":"\s*"([^"]+)"/) || firstMatch(encPage, /en_str\\?":\s*\\?"([^"\\]+)\\?"/) || firstMatch(encPage, /encodedStr\s*=\s*"([^"]+)"/);
      if (enc) {
        const dec = jrsDecrypt(enc);
        if (dec) {
          const um = dec.match(/"url"\s*:\s*"([^"]+)"/);
          const u = um ? um[1].replace(/\\\//g, '/') : '';
          if (u && /^https?:/i.test(u) && (await jrsProbe(u))) {
            return JSON.stringify({ parse: 0, url: u, header: { 'User-Agent': UA } });
          }
        }
      }
    } catch (e) {}
    return JSON.stringify({ parse: 1, url: id, header: { 'User-Agent': UA, 'Referer': host + '/' } });
  }
  try {
    let page = await fetchText(id, host + '/');
    let real = extractM3u8(page);
    // 第一跳: 播放页里嵌 /play/sm.html?id=xxx (部分是 JS 动态写入, 抓不到就手动补)
    if (!real) {
      let sm = firstMatch(page, /src=["']([^"']*sm\.html[^"']*)["']/i);
      // 自身就是 sm.html? 时直接拿它的 id 作为下一跳
      const selfSm = /\/sm\.html/i.test(id) ? firstMatch(String(id) + '&', /[?&]id=([^&"'\s]*)/i) : '';
      const smId = selfSm || firstMatch(page, /sm\.html\?id=([^&"'\s]*)/i) || firstMatch(String(id), /\/play\/(\d+)\.html/i);
      if (!sm && smId) sm = '/play/sm.html?id=' + smId + '&id2=';
      if (sm) {
        const origin = (id.match(/^https?:\/\/[^\/]+/i) || [''])[0];
        const smUrl = absUrl(sm, origin);
        const smPage = await fetchText(smUrl, id);
        // 第二跳: sm.html 里再嵌 /play/{id}.html (id 来自 location.search, 即 sm.html 的 id 参数)
        const sid = firstMatch(smUrl + '&', /[?&]id=([^&"']*)/i);
        const targets = [];
        // 优先按 sm.html? 里的 id 直接拼 /play/{id}.html
        if (sid) targets.push('/play/' + decodeURIComponent(decodeURIComponent(sid)) + '.html');
        // 兜底: 从 sm.html 源码里还原 '/play/'+id1+'.html' 这种运行时拼接
        const sub = firstMatch(smPage, /src=["']([^"']*(?:id1|\+\s*id)[^"']*)["']/i);
        if (sub) targets.push(sub.replace(/["']\s*\+\s*(id1|id)\s*\+\s*["']/g, sid || ''));
        for (let i = 0; i < targets.length && !real; i++) {
          const t = targets[i].replace(/\+\s*id1\s*\+/, sid || '');
          if (t.indexOf('/play/') !== 0 && !/^https?:/i.test(t)) continue;
          try { real = extractM3u8(await fetchText(absUrl(t, origin), smUrl)); } catch (e) {}
        }
        if (!real) real = extractM3u8(smPage);
      }
    }
    if (real) return JSON.stringify({ parse: 0, url: real, header: { 'User-Agent': UA, 'Referer': host + '/' } });
  } catch (e) {}
  return JSON.stringify({ parse: 1, url: id, header: { 'User-Agent': UA, 'Referer': host + '/' } });
}

async function homeContent(filter) { return safeJson(await home(filter), { class: [], filters: {} }); }
async function homeVideoContent() { return safeJson(await homeVod(), { list: [] }); }
async function categoryContent(tid, pg, filter, extend) { return safeJson(await category(tid, pg, filter, extend || {}), { list: [] }); }
async function detailContent(ids) { return safeJson(await detail(ids), { list: [] }); }
async function searchContent(wd, quick, pg) { return safeJson(await search(wd, quick, pg || 1), { list: [] }); }
async function playerContent(flag, id, flags) { return safeJson(await play(flag, id, flags), { parse: 1, url: id }); }
  return { init, home, homeVod, category, search, detail, play, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent };
})();


const __sports_src_4 = (function () {


let host = 'https://www.iqzhibo.com';
const dbHost = 'https://www.doubaozhibo.com';
const dbScheduleApi = dbHost + '/api/v1/schedules/public/local';
const dbPlaybackApi = dbHost + '/api/v1/playbacks';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function getHeaders(referer) {
  return {
    'User-Agent': UA,
    'Referer': referer || host + '/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  };
}

function getHeaderValue(headers, name) {
  if (!headers) return '';
  const lower = String(name || '').toLowerCase();
  for (const k in headers) {
    if (String(k).toLowerCase() === lower) {
      const v = headers[k];
      return Array.isArray(v) ? String(v[0] || '') : String(v || '');
    }
  }
  return '';
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(s) {
  return stripHtml(s).replace(/\s+/g, ' ').trim();
}

function absUrl(url, base) {
  url = String(url || '').trim();
  base = base || host;
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf('//') === 0) return 'https:' + url;
  if (url.charAt(0) === '/') return base.replace(/\/$/, '') + url;
  return base.replace(/\/$/, '') + '/' + url;
}

function safeJson(text, def) {
  try { return JSON.parse(text || '{}'); } catch (e) { return def || {}; }
}

async function fetchText(url, referer) {
  const hd = getHeaders(referer || host + '/');
  if (typeof Java !== 'undefined' && Java && Java.req) {
    const r = await Java.req(url, { headers: hd });
    if (typeof r === 'string') return r;
    const code = Number((r && (r.statusCode || r.status || r.code)) || 0);
    const loc = getHeaderValue(r && r.headers, 'location');
    if (loc && code >= 300 && code < 400) return await fetchText(absUrl(loc, url.indexOf(dbHost) === 0 ? dbHost : host), url);
    return String((r && (r.body || r.content || r.data)) || '');
  }
  const r2 = await req(url, { headers: hd });
  if (typeof r2 === 'string') return r2;
  const code2 = Number((r2 && (r2.statusCode || r2.status || r2.code)) || 0);
  const loc2 = getHeaderValue(r2 && r2.headers, 'location');
  if (loc2 && code2 >= 300 && code2 < 400) return await fetchText(absUrl(loc2, url.indexOf(dbHost) === 0 ? dbHost : host), url);
  return String((r2 && (r2.content || r2.body || r2.data)) || '');
}

function getClasses() {
  return [
    { type_id: 'zuqiu', type_name: '足球直播' },
    { type_id: 'lanqiu', type_name: '篮球直播' },
    { type_id: 'sssc', type_name: '实时赛程' },
    { type_id: 'huifang', type_name: '赛事回放' },
    { type_id: 'fifa', type_name: '世界杯' },
    { type_id: 'zhongchao', type_name: '中超' },
    { type_id: 'yingchao', type_name: '英超' },
    { type_id: 'xijia', type_name: '西甲' },
    { type_id: 'dejia', type_name: '德甲' },
    { type_id: 'yijia', type_name: '意甲' },
    { type_id: 'fajia', type_name: '法甲' }
  ];
}

function parseIqList(html) {
  html = String(html || '');
  const list = [];
  const reg = /<li>\s*<div class=["']liveinfo["'][\s\S]*?<\/li>/gi;
  let m;
  while ((m = reg.exec(html)) !== null) {
    const item = m[0];
    const title = cleanText((item.match(/class=["']title["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1]);
    const homeBlock = (item.match(/class=["']team-zhu["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
    const awayBlock = (item.match(/class=["']team-ke["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
    const home = cleanText(homeBlock.replace(/<img[\s\S]*$/i, ''));
    const away = cleanText(awayBlock.replace(/^[\s\S]*?<img[^>]*>/i, ''));
    const hrefMatch = item.match(/<div class=["']livesource["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!hrefMatch) continue;
    const imgMatch = item.match(/<img[^>]+src=["']([^"']+)["']/i);
    const teams = [home, away].filter(Boolean).join(' vs ');
    const name = [title, teams].filter(Boolean).join(' ');
    list.push({
      vod_id: absUrl(hrefMatch[1], host),
      vod_name: name || teams || title || '赛事直播',
      vod_pic: absUrl(imgMatch ? imgMatch[1] : '/logo.png', host),
      vod_remarks: cleanText(hrefMatch[2]) || '高清'
    });
  }
  return list;
}

function matchCategory(tid, league, name, dataType) {
  tid = String(tid || '');
  league = cleanText(league);
  name = cleanText(name);
  dataType = String(dataType || '');
  const text = league + ' ' + name;
  if (!tid || tid === 'sssc' || tid === 'huifang') return true;
  if (tid === 'zuqiu') return dataType === 'football' || (/(足|超|甲|乙|冠|欧联|日职|韩K|世界杯|世俱|足球|杯)/i.test(text) && !/(篮|NBA|CBA|WNBA|NBL|篮球)/i.test(text));
  if (tid === 'lanqiu') return dataType === 'basketball' || /(篮|NBA|CBA|WNBA|NBL|篮球)/i.test(text);
  const rules = {
    fifa: /(世界杯|世俱杯|世预赛|国际足联|FIFA)/i,
    zhongchao: /(中超|足协杯|中国超级联赛)/i,
    yingchao: /(英超|英格兰超级联赛)/i,
    xijia: /(西甲|西班牙甲级联赛)/i,
    dejia: /(德甲|德国甲级联赛)/i,
    yijia: /(意甲|意大利甲级联赛)/i,
    fajia: /(法甲|法国甲级联赛)/i
  };
  return rules[tid] ? rules[tid].test(text) : true;
}

function formatTimeText(matchTime) {
  const d = new Date(matchTime);
  if (!matchTime || isNaN(d.getTime())) return '';
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

async function fetchJson(url, referer) {
  const text = await fetchText(url, referer || dbHost + '/');
  try { return JSON.parse(text || '{}'); } catch (e) { return {}; }
}

function parseApiSchedule(json, tid) {
  const days = json && json.data && Array.isArray(json.data.days) ? json.data.days : [];
  const list = [];
  for (let i = 0; i < days.length; i++) {
    const rows = Array.isArray(days[i].live) ? days[i].live : [];
    for (let j = 0; j < rows.length; j++) {
      const item = rows[j];
      const signals = Array.isArray(item.signals) ? item.signals : [];
      if (!signals.length) continue;
      const name = [formatTimeText(item.matchTime), cleanText(item.league), cleanText(item.teamA) + ' vs ' + cleanText(item.teamB)].filter(Boolean).join(' ');
      if (!matchCategory(tid, item.league, name, item.dataType)) continue;
      const links = signals.map(function (s, idx) {
        return { name: cleanText(s.name || s.label) || ('信号' + (idx + 1)), url: dbHost + '/play/' + s.playId + '?device=pc_web' };
      });
      list.push({
        vod_id: 'db$' + encodeURIComponent(JSON.stringify({ name: name, links: links })),
        vod_name: name,
        vod_pic: item.teamAImage || item.teamBImage || host + '/logo.png',
        vod_remarks: links.map(function (x) { return x.name; }).join('/') || '直播'
      });
    }
  }
  return list;
}

function parsePlaybackList(json, tid) {
  // 接口实际返回 data.items: { scheduleId, title, cover, schedule, lines: [{lineNo,title,proxyUrl}] }
  const data = (json && json.data) || {};
  const rows = Array.isArray(data.items) ? data.items : (Array.isArray(data.list) ? data.list : []);
  const list = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const s = row.schedule || {};
    const lines = Array.isArray(row.lines) ? row.lines : [];
    if (!lines.length) continue;
    const fullName = cleanText(row.title) || [formatTimeText(s.matchTime), cleanText(s.league), cleanText(s.teamA) + ' vs ' + cleanText(s.teamB), '回放'].filter(Boolean).join(' ');
    if (!matchCategory(tid, s.league, fullName, s.dataType)) continue;
    const shortName = (cleanText(s.teamA) + ' vs ' + cleanText(s.teamB)).replace(/^\s*vs\s*|\s*vs\s*$/g, '') || fullName.replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*/, '').replace(/\s*赛事回放$/, '');
    const remarkPrefix = [formatTimeText(s.matchTime), cleanText(s.league)].filter(Boolean).join(' ');
    const links = lines.map(function (line, idx) {
      return { name: cleanText(line.title) || ('回放' + (idx + 1)), url: absUrl(line.proxyUrl, dbHost) };
    });
    list.push({
      vod_id: 'db$' + encodeURIComponent(JSON.stringify({ name: fullName, links: links })),
      vod_name: shortName,
      vod_pic: absUrl(row.cover, dbHost) || s.teamAImage || s.teamBImage || host + '/logo.png',
      vod_remarks: [remarkPrefix, links.map(function (x) { return x.name; }).join('/')].filter(Boolean).join(' · ') || '回放'
    });
  }
  return list;
}

function parseProxySchedule(html, tid) {
  html = String(html || '');
  const list = [];
  const reg = /<article[^>]*class=["'][^"']*px-3 py-3 sm:px-4[^"']*["'][^>]*>[\s\S]*?<\/article>/gi;
  let m;
  while ((m = reg.exec(html)) !== null) {
    const item = m[0];
    const ps = [];
    const pReg = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pm;
    while ((pm = pReg.exec(item)) !== null) ps.push(cleanText(pm[1]));
    const time = ps[0] || '';
    const league = ps[1] || '';

    const teams = [];
    const spanReg = /<span[^>]*class=["'][^"']*truncate[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
    let sm;
    while ((sm = spanReg.exec(item)) !== null) {
      const t = cleanText(sm[1]);
      if (t && !/^信号|高清|返回/.test(t) && teams.indexOf(t) < 0) teams.push(t);
    }
    if (teams.length < 2) continue;
    const name = [time, league, teams[0] + ' vs ' + teams[1]].filter(Boolean).join(' ');
    if (!matchCategory(tid, league, name)) continue;

    const links = [];
    const aReg = /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*home-signal-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    let am;
    while ((am = aReg.exec(item)) !== null) {
      const title = (am[0].match(/title=["']([^"']+)["']/i) || [])[1] || cleanText(am[2]) || ('信号' + (links.length + 1));
      links.push({ name: title, url: absUrl(am[1], dbHost) });
    }
    if (!links.length) continue;
    const img = (item.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || '/logo.png';
    list.push({
      vod_id: 'db$' + encodeURIComponent(JSON.stringify({ name: name, links: links })),
      vod_name: name,
      vod_pic: absUrl(img, dbHost),
      vod_remarks: links.map(function (x) { return x.name; }).join('/') || '直播'
    });
  }
  return list;
}

async function init(cfg) {
  if (cfg && cfg.ext && String(cfg.ext).indexOf('http') === 0) host = String(cfg.ext).trim().replace(/\/$/, '');
}

async function home(filter) {
  return JSON.stringify({ class: getClasses(), filters: {} });
}

async function homeVod() {
  return await category('zuqiu', 1, false, {});
}

async function category(tid, pg, filter, extend) {
  tid = String((extend && extend.cateId) || tid || 'zuqiu');
  pg = parseInt(pg) || 1;
  let list = [];
  try {
    if (tid === 'huifang') {
      list = parsePlaybackList(await fetchJson(dbPlaybackApi + '?page=' + pg + '&pageSize=20&dataType=all', dbHost + '/'), tid);
    } else {
      list = parseApiSchedule(await fetchJson(dbScheduleApi, dbHost + '/'), tid);
      if (!list.length && tid !== 'lanqiu') {
        list = parseProxySchedule(await fetchText(host + '/proxy.php', host + '/sssc/'), tid);
      }
    }
  } catch (e) {
    list = [];
  }
  return JSON.stringify({ code: 1, msg: '数据列表', page: pg, pagecount: list.length >= 20 ? pg + 1 : 1, limit: 50, total: list.length, list: list });
}

function parseNuxtProxy(html) {
  html = String(html || '');
  const hls = html.match(/(?:\\u002F|\/)hls(?:\\u002F|\/)[A-Za-z0-9._-]+\.m3u8/i);
  if (hls) return absUrl(hls[0].replace(/\\u002F/g, '/'), dbHost);
  const m = html.match(/"proxyUrl"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (m) {
    try { return absUrl(JSON.parse('"' + m[1] + '"'), dbHost); } catch (e) { return absUrl(m[1].replace(/\\u002F/g, '/'), dbHost); }
  }
  const iframe = html.match(/https?:\/\/www\.kanqiuge\.com\/embed\/play\/[A-Za-z0-9._-]+/i);
  if (iframe) return iframe[0];
  return '';
}

// 豆包直播信号取流 (官方 JSON 接口, 网页播放器同款): /api/v1/public/signals/{playId}/play -> {playable,url,kind}
const sigCache = {};
async function signalPlay(playId) {
  playId = String(playId || '');
  if (!playId) return null;
  const hit = sigCache[playId];
  if (hit && Date.now() - hit.t < 30000) return hit.v;
  const j = await fetchJson(dbHost + '/api/v1/public/signals/' + playId + '/play', dbHost + '/');
  const d = (j && j.data) || null;
  if (d && d.url) {
    if (Object.keys(sigCache).length > 60) for (const k in sigCache) delete sigCache[k];
    sigCache[playId] = { t: Date.now(), v: d };
  }
  return d;
}

function playIdOf(url) {
  const m = String(url || '').match(/(\d{1,10}-\d{1,10}-\d{1,10})/);
  return m ? m[1] : '';
}

// rtmpcdn 中继偶尔 404 channel stopped, 先探测确认可读再交给播放器
async function streamOk(url) {
  url = String(url || '');
  if (!url || !/\.(m3u8|flv|mp4)(\?|$)/i.test(url)) return false;
  try {
    const r = await req(url, { headers: { 'User-Agent': UA } });
    if (typeof r === 'string') return r.indexOf('#EXTM3U') >= 0 || r.length > 0;
    const code = Number((r && (r.statusCode || r.status || r.code)) || 0);
    const body = String((r && (r.content || r.body || r.data)) || '');
    if (!code) return body.length > 0;
    return code >= 200 && code < 300 && body.length > 0;
  } catch (e) {
    return false;
  }
}

async function resolvePlayUrl(playUrl) {
  playUrl = String(playUrl || '');
  if (/\.(m3u8|flv|mp4)(\?|$)/i.test(playUrl)) return playUrl;
  // 豆包直播信号页 /play/{playId}: 直接走 JSON 接口取流, 不再抓网页
  const pid = playIdOf(playUrl);
  if (pid && playUrl.indexOf(dbHost) === 0) {
    try {
      const d = await signalPlay(pid);
      if (d && d.url) return d.url;
    } catch (e) {}
  }
  try {
    const html = await fetchText(playUrl, host + '/sssc/');
    return parseNuxtProxy(html) || playUrl;
  } catch (e) {
    return playUrl;
  }
}

async function detail(id) {
  id = Array.isArray(id) ? id[0] : id;
  id = String(id || '');
  if (id.indexOf('db$') === 0) {
    let data = { name: '实时赛程', links: [] };
    try { data = JSON.parse(decodeURIComponent(id.slice(3))); } catch (e) {}
    const playUrls = (data.links || []).map(function (x) { return (x.name || '线路') + '$' + x.url; }).join('#');
    return JSON.stringify({
      code: 1,
      msg: '数据列表',
      page: 1,
      pagecount: 1,
      limit: 1,
      total: 1,
      list: [{
        vod_id: id,
        vod_name: data.name || '实时赛程',
        vod_pic: host + '/logo.png',
        vod_remarks: '直播',
        vod_play_from: '爱球直播',
        vod_play_url: playUrls,
        vod_content: '爱球直播实时赛程，播放时解析豆包直播信号。'
      }]
    });
  }

  let name = '赛事直播';
  let time = '';
  let playUrls = '';
  try {
    const html = await fetchText(id, host + '/');
    name = cleanText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]) || name;
    time = cleanText((html.match(/<div class=["']match-header["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1]);
    const arr = [];
    const aReg = /<div class=["']gohome["'][\s\S]*?<\/div>/i;
    const block = (html.match(aReg) || [])[0] || '';
    const linkReg = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = linkReg.exec(block)) !== null) {
      const text = cleanText(lm[2]) || ('信号' + (arr.length + 1));
      if (/赛程|返回|首页/.test(text)) continue;
      const href = lm[1];
      arr.push(text + '$' + (href === '/sssc/' || href.indexOf('/sssc/') >= 0 ? host + '/proxy.php' : absUrl(href, host)));
    }
    if (!arr.length) arr.push('赛程$' + host + '/proxy.php');
    playUrls = arr.join('#');
  } catch (e) {
    playUrls = '赛程$' + host + '/proxy.php';
  }

  return JSON.stringify({
    code: 1,
    msg: '数据列表',
    page: 1,
    pagecount: 1,
    limit: 1,
    total: 1,
    list: [{
      vod_id: id,
      vod_name: name,
      vod_pic: host + '/logo.png',
      vod_remarks: time,
      vod_play_from: '爱球直播',
      vod_play_url: playUrls,
      vod_content: time || '爱球直播赛事导航'
    }]
  });
}

async function search(wd, quick, pg) {
  pg = parseInt(pg) || 1;
  let list = [];
  try {
    const html = await fetchText(host + '/search.html?keywords=' + encodeURIComponent(wd || '') + '&method=1', host + '/');
    list = parseIqList(html);
  } catch (e) {
    list = [];
  }
  return JSON.stringify({ code: 1, msg: '数据列表', page: pg, pagecount: 1, limit: 20, total: list.length, list });
}

async function play(flag, id, flags) {
  let url = await resolvePlayUrl(id);
  let ok = await streamOk(url);
  if (!ok) {
    // 主信号停流 (中继偶发 channel stopped): 换同场赛事的其它信号
    const pid = playIdOf(id);
    if (pid) {
      const mid = pid.split('-')[0];
      const j = await fetchJson(dbHost + '/api/v1/public/matches/' + mid + '/signals', dbHost + '/');
      const items = (j && j.data && Array.isArray(j.data.items)) ? j.data.items : [];
      for (let i = 0; i < items.length && !ok; i++) {
        const alt = String(items[i].playId || '');
        if (!alt || alt === pid) continue;
        try {
          const d = await signalPlay(alt);
          if (d && d.url && (await streamOk(d.url))) {
            url = d.url;
            ok = true;
          }
        } catch (e) {}
      }
    }
  }
  const direct = /\.(m3u8|flv|mp4)(\?|$)/i.test(String(url || ''));
  return JSON.stringify({
    parse: direct ? 0 : 1,
    url: url,
    header: {
      'User-Agent': UA
    }
  });
}

async function homeContent(filter) { return safeJson(await home(filter), { class: [], filters: {} }); }
async function homeVideoContent() { return safeJson(await homeVod(), { list: [] }); }
async function categoryContent(tid, pg, filter, extend) { return safeJson(await category(tid, pg, filter, extend || {}), { list: [] }); }
async function detailContent(ids) { return safeJson(await detail(ids), { list: [] }); }
async function searchContent(wd, quick, pg) { return safeJson(await search(wd, quick, pg || 1), { list: [] }); }
async function playerContent(flag, id, flags) { return safeJson(await play(flag, id, flags), { parse: 1, url: id }); }
  return { init, home, homeVod, category, search, detail, play, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent };
})();


const __sports_src_5 = (function () {

// 球吧直播 https://www.qiuba.vip/
// 接口: /api/matches 列表, /api/matches/{id}/signals 线路, POST /api/play/session {source_id} 取流
// 注意: 播放 CDN Referer 防盗链, 仅放行「无 Referer」, 播放 header 不带 Referer
let host = 'https://www.qiuba.vip';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const playHeaders = { 'User-Agent': UA };

function safeJson(text, def) {
  try { return JSON.parse(text || '{}'); } catch (e) { return def || {}; }
}

async function fetchJson(url, opt) {
  const r = await req(url, Object.assign({ headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, opt || {}));
  return safeJson((r && (r.content || r.body)) || '{}', {});
}

function b64Dec(s) {
  s = String(s || '').replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  // 补齐 padding, 否则部分环境的 atob 会抛错导致取流失败
  while (s.length % 4 !== 0) s += '=';
  if (typeof atob === 'function') { try { return atob(s); } catch (e) {} }
  const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map(j => B.indexOf(s.charAt(i + j)));
    out += String.fromCharCode((c[0] << 2) | (c[1] >> 4));
    if (c[2] >= 0) out += String.fromCharCode(((c[1] & 15) << 4) | (c[2] >> 2));
    if (c[3] >= 0) out += String.fromCharCode(((c[2] & 3) << 6) | c[3]);
  }
  return out.replace(/\x00+$/, '');
}

function timeCn(iso) {
  const t = new Date(iso || '');
  if (isNaN(t.getTime())) return '';
  const p = n => (n < 10 ? '0' : '') + n;
  return (t.getMonth() + 1) + '-' + t.getDate() + ' ' + p(t.getHours()) + ':' + p(t.getMinutes());
}

function matchToVod(it) {
  if (!it || !it.id) return null;
  const comp = (it.competition && it.competition.name) || '';
  const home = (it.home_team && it.home_team.name) || '';
  const away = (it.away_team && it.away_team.name) || '';
  let name = [comp, [home, away].filter(Boolean).join(' vs ')].filter(Boolean).join(' ');
  if (!name) name = '赛事 ' + it.id;
  const parts = [];
  if (it.status === 'live') parts.push('直播中' + (it.clock ? '(' + it.clock + ')' : ''));
  else if (it.status === 'not_started') parts.push(timeCn(it.start_time));
  if (it.home_score !== null && it.away_score !== null && it.status === 'live') parts.push(it.home_score + '-' + it.away_score);
  if (it.signal_count) parts.push(it.signal_count + '路信号');
  if (it.is_hot) parts.push('热门');
  const cat = it.category || {};
  const pic = (it.home_team && it.home_team.logo) || (it.away_team && it.away_team.logo) || '';
  return {
    vod_id: String(it.id),
    vod_name: name,
    vod_pic: pic,
    vod_remarks: parts.join(' ') || '赛程'
  };
}

function getClasses() {
  return [
    { type_id: 'live', type_name: '正在直播' },
    { type_id: 'all', type_name: '全部赛程' },
    { type_id: 'football', type_name: '足球直播' },
    { type_id: 'basketball', type_name: '篮球直播' }
  ];
}

async function init(cfg) {
  if (cfg && cfg.ext && String(cfg.ext).indexOf('http') === 0) host = String(cfg.ext).trim().replace(/\/$/, '');
}

async function home(filter) {
  return JSON.stringify({ class: getClasses(), filters: {} });
}

async function category(tid, pg, filter, extend) {
  tid = String(tid || 'live');
  pg = parseInt(pg) || 1;
  const size = 30;
  let url = host + '/api/matches?page=' + pg + '&page_size=' + size + '&_t=' + Date.now();
  if (tid === 'live') url = host + '/api/matches?view=home&page=1&page_size=50&hot_first=0&_t=' + Date.now();
  let list = [];
  let total = 0;
  try {
    const j = await fetchJson(url);
    const items = Array.isArray(j.items) ? j.items : [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (tid === 'live' && it.status !== 'live') continue;
      if ((tid === 'football' || tid === 'basketball') && (!it.category || it.category.key !== tid)) continue;
      const vod = matchToVod(it);
      if (vod) list.push(vod);
    }
    total = j.total || list.length;
  } catch (e) {}
  return JSON.stringify({ code: 1, msg: '数据列表', page: pg, pagecount: Math.max(1, Math.ceil(total / size)), limit: size, total, list });
}

async function homeVod() { return await category('live', 1, false, {}); }

async function detail(id) {
  id = Array.isArray(id) ? id[0] : id;
  id = String(id || '').trim();
  let vod = {
    vod_id: id,
    vod_name: '球吧赛事 ' + id,
    vod_pic: '',
    vod_remarks: '直播',
    vod_play_from: '球吧直播',
    vod_play_url: '',
    vod_content: '球吧直播实时体育直播'
  };
  try {
    const j = await fetchJson(host + '/api/matches/' + encodeURIComponent(id) + '?_t=' + Date.now());
    const it = j && j.id ? j : null;
    if (it) {
      const v = matchToVod(it);
      if (v) { vod.vod_name = v.vod_name; vod.vod_remarks = v.vod_remarks; vod.vod_pic = v.vod_pic; }
    }
    const sigs = await fetchJson(host + '/api/matches/' + encodeURIComponent(id) + '/signals?_t=' + Date.now());
    const urls = [];
    const seenName = {};
    const seenUrl = {};
    const arr = Array.isArray(sigs) ? sigs : [];
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i] || {};
      const sid = s.source_id || '';
      if (!sid || seenUrl[sid]) continue;
      seenUrl[sid] = true;
      let nm = String(s.display_name || '').trim() || ('线路' + (urls.length + 1));
      if (seenName[nm]) nm = nm + (i + 1);
      seenName[nm] = true;
      // 线路统一存 matchId@sourceId, 播放时实时取流: 流地址 5 分钟过期, 预取嵌入反而会失效
      urls.push(nm + '$' + id + '@' + sid);
    }
    if (!urls.length) urls.push('直播$' + id + '@0');
    vod.vod_play_url = urls.join('#');
    vod.vod_content = '球吧直播 - ' + vod.vod_name;
  } catch (e) {}
  return JSON.stringify({ code: 1, msg: '数据列表', page: 1, pagecount: 1, limit: 1, total: 1, list: [vod] });
}

async function search(wd, quick, pg) {
  let list = [];
  try {
    const j = await fetchJson(host + '/api/matches?page=1&page_size=200&_t=' + Date.now());
    const items = Array.isArray(j.items) ? j.items : [];
    const kw = String(wd || '').toLowerCase();
    for (let i = 0; i < items.length && list.length < 30; i++) {
      const it = items[i];
      const blob = JSON.stringify([it.competition, it.home_team, it.away_team]).toLowerCase();
      if (kw && blob.indexOf(kw) < 0) continue;
      const vod = matchToVod(it);
      if (vod) list.push(vod);
    }
  } catch (e) {}
  return JSON.stringify({ code: 1, msg: '数据列表', page: parseInt(pg) || 1, pagecount: 1, limit: list.length, total: list.length, list });
}

function extractWebStream(url) {
  // 网页播放器地址(如 player.on8on8.com/live/index.html?liveUrl=...)的 query 里
  // 往往直接带着真实流地址, 双重解码后解出即可直连, 无需壳嗅探
  const q = String(url || '').split('?')[1] || '';
  for (const p of q.split('&')) {
    const i = p.indexOf('=');
    if (i < 0) continue;
    let v = p.slice(i + 1);
    for (let k = 0; k < 2; k++) {
      try { v = decodeURIComponent(v); } catch (e) {}
      if (/^https?:\/\/.+\.(m3u8|mp4|flv)(\?|$)/i.test(v)) return v;
    }
  }
  return '';
}

async function playSession(sid) {
  // 取真实流地址(5 分钟过期)。各家壳 req 的 POST 参数写法不一, 依次尝试多种签名
  const payload = JSON.stringify({ source_id: parseInt(sid) || 0 });
  const url = host + '/api/play/session';
  const tries = [
    { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, body: payload },
    { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, data: payload },
    { method: 'post', headers: { 'content-type': 'application/json' }, body: payload },
    { method: 1, headers: { 'User-Agent': UA }, body: payload }
  ];
  for (let i = 0; i < tries.length; i++) {
    let j = null;
    try { j = await fetchJson(url, tries[i]); } catch (e) {}
    let raw = String((j && (j.real_url_encrypted || j.real_url_enc || j.play_url || j.url)) || '');
    if (!raw) continue;
    let out = raw;
    if (out.indexOf('crawler_b64:') === 0) {
      try { out = b64Dec(out.slice(12)); } catch (e) {}
    }
    if (/^https?:\/\//i.test(out)) return out;
  }
  return '';
}

function headerOf(url) {
  const h = { 'User-Agent': UA };
  // vivo155 的防盗链只放行 on8on8 播放页 Referer
  if (/vivo155\.com|on8on8\.com/i.test(String(url || ''))) h['Referer'] = 'https://player.on8on8.com/';
  return h;
}

async function probeStream(url) {
  // 探活并修正: 该站部分变体返回 200/403 但内容为空(清晰度/音轨不存在或防盗链),
  // 按清晰度(sd/hd/shd) x 音轨(无/en/zh) 轮换组合, 找到内容非空的变体
  let sc = 0, body = '';
  try {
    const r = await req(url, { headers: headerOf(url) });
    sc = (r && r.status_code) || 0;
    body = String((r && (r.content || r.body)) || '');
  } catch (e) {}
  if (sc < 400 && body.indexOf('#EXTM') >= 0) return url;
  const m = url.match(/^(https?:\/\/[^\/]+\/(?:[^\/]+\/)*)([a-z]{2,4})(?:-([a-z]{2,3}))?-(\d+(?:-\d+)*\.m3u8[^\s]*)$/i);
  if (m) {
    const qs = ['hd', 'sd', 'shd', 'hhd'];
    const trs = m[3] ? [m[3], 'en', 'zh', ''] : ['', 'en', 'zh'];
    for (const q of qs) {
      for (const tr of trs) {
        const v = m[1] + q + (tr ? '-' + tr : '') + '-' + m[4];
        if (v === url) continue;
        try {
          const r2 = await req(v, { headers: headerOf(v) });
          const b2 = String((r2 && (r2.content || r2.body)) || '');
          if (((r2 && r2.status_code) || 0) < 400 && b2.indexOf('#EXTM') >= 0) return v;
        } catch (e) {}
      }
    }
  }
  // 轮换没找到活变体(可能被 CDN 限流误判): 保守返回原地址让壳直接播
  return url;
}

async function resolveStream(sid) {
  let real = await playSession(sid);
  if (!real) return '';
  if (/\.html?(\?|$)/i.test(real)) {
    const ws = extractWebStream(real);
    if (!ws) return '';
    real = ws;
  }
  if (/\.m3u8/i.test(real)) return await probeStream(real);
  return real;
}

// 多格式 header 兼容下发(对象 + headers 键 + 字符串), 各家壳取自己认识的那种
function QB_PLAY_RESULT(url) {
  const h = headerOf(url);
  const hs = JSON.stringify(h);
  return { parse: 0, url: url, playUrl: '', flag: '播放', header: h, headers: h, headerStr: hs };
}

async function play(flag, id, flags) {
  id = String(id || '').trim();
  // 兼容三种线路值: 预取直连地址 / matchId@sourceId / 纯 sourceId
  if (/^https?:\/\//i.test(id)) {
    if (/\.html?(\?|$)/i.test(id)) {
      const ws = extractWebStream(id);
      if (ws) {
        const fixed = /\.m3u8/i.test(ws) ? await probeStream(ws) : ws;
        if (fixed) return JSON.stringify(QB_PLAY_RESULT(fixed));
      }
      return JSON.stringify({ parse: 1, url: id, header: playHeaders });
    }
    const fixed = /\.m3u8/i.test(id) ? await probeStream(id) : id;
    if (fixed) return JSON.stringify(QB_PLAY_RESULT(fixed));
    return JSON.stringify({ parse: 1, url: id, header: playHeaders });
  }
  let matchId = '';
  const at = id.indexOf('@');
  if (at > 0) { matchId = id.slice(0, at); id = id.slice(at + 1); }
  const sid = parseInt(id) || 0;
  if (sid) {
    const fixed = await resolveStream(sid);
    if (fixed) return JSON.stringify(QB_PLAY_RESULT(fixed));
  }
  const page = matchId ? (host + '/match/' + matchId) : host;
  return JSON.stringify({ parse: 1, url: page, header: playHeaders });
}

async function homeContent(filter) { return safeJson(await home(filter), { class: [], filters: {} }); }
async function homeVideoContent() { return safeJson(await homeVod(), { list: [] }); }
async function categoryContent(tid, pg, filter, extend) { return safeJson(await category(tid, pg, filter, extend || {}), { list: [] }); }
async function detailContent(ids) { return safeJson(await detail(ids), { list: [] }); }
async function searchContent(wd, quick, pg) { return safeJson(await search(wd, quick, pg || 1), { list: [] }); }
async function playerContent(flag, id, flags) { return safeJson(await play(flag, id, flags), { parse: 1, url: id }); }
  return { init, home, homeVod, category, search, detail, play, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent };
})();


const __sports_src_6 = (function () {

// 瓜子直播 api.46d5umpk.com (反编译自 SportsGuazi)
// 协议: AES-128-CBC 参数加密(bo)/响应解密(an), POST form parameter=<b64>
// headers: UA=okhttp/3.12.0, user-platform=null, client-version=3.0.1.1
// 播放 header: UA=Lavf/57.83.100 + Referer=http://WJiZxLXA2.com/
const HOST = 'https://api.46d5umpk.com';
const AK = 'KANGEQIU@8868!~.';
const AI = '0200010900030207';
const GUAZI_HEADERS = {
  'User-Agent': 'okhttp/3.12.0',
  'content-type': 'application/x-www-form-urlencoded',
  'user-platform': 'null',
  'client-version': '3.0.1.1',
  'client-channel': '',
  'token': ''
};
// 与 jar 爬虫抓包一致的播放 header; 壳端须以字符串形式下发才会被播放器应用(对象形式会被忽略导致默认UA被CDN拒)
const GZ_PLAY_HEADERS = { 'User-Agent': 'Lavf/57.83.100', 'Referer': 'http://WJiZxLXA2.com/' };
const GZ_PLAY_HEADER_STR = JSON.stringify(GZ_PLAY_HEADERS);
// 多格式兼容下发: header(对象) / header(字符串形式壳自行解析) / headers, 各家壳取自己认识的那种
function GZ_PLAY_RESULT(url) {
  return { parse: 0, url: url, playUrl: '', flag: '播放',
    header: GZ_PLAY_HEADERS, headers: GZ_PLAY_HEADERS,
    headerStr: GZ_PLAY_HEADER_STR };
}

// ---- 纯 JS AES-128-CBC (壳端无 crypto 模块) ----
function gzMakeAES() {
  const SBOX = [
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16];
  const INV = new Array(256);
  for (let i = 0; i < 256; i++) INV[SBOX[i]] = i;
  const RCON = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];
  function xtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff; }
  function mul(a, b) {
    let r = 0;
    while (b) { if (b & 1) r ^= a; a = xtime(a); b >>= 1; }
    return r & 0xff;
  }
  function expandKey(key) {
    const w = [];
    for (let i = 0; i < 4; i++) w.push([key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]]);
    for (let i = 4; i < 44; i++) {
      let t = w[i-1].slice();
      if (i % 4 === 0) t = [SBOX[t[1]] ^ RCON[i/4-1], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
      w.push([w[i-4][0]^t[0], w[i-4][1]^t[1], w[i-4][2]^t[2], w[i-4][3]^t[3]]);
    }
    return w;
  }
  // state: 列主序 s[r + 4c], 轮密钥取 w[4r+c]
  function cryptBlock(inp, out, w, enc) {
    const s = new Array(16);
    for (let i = 0; i < 16; i++) s[i] = inp[i];
    function addRK(r) { for (let c = 0; c < 4; c++) for (let j = 0; j < 4; j++) s[j+4*c] ^= w[4*r+c][j]; }
    function subBytes() { for (let i = 0; i < 16; i++) s[i] = enc ? SBOX[s[i]] : INV[s[i]]; }
    function shiftRows() {
      for (let r = 1; r < 4; r++) {
        const row = [s[r], s[r+4], s[r+8], s[r+12]];
        for (let c = 0; c < 4; c++) {
          if (enc) s[r+4*c] = row[(c + r) % 4];
          else s[r+4*c] = row[(c + 4 - r) % 4];
        }
      }
    }
    function mixCols() {
      for (let c = 0; c < 4; c++) {
        const a0 = s[4*c], a1 = s[4*c+1], a2 = s[4*c+2], a3 = s[4*c+3];
        if (enc) {
          s[4*c]   = mul(a0,2)^mul(a1,3)^a2^a3;
          s[4*c+1] = a0^mul(a1,2)^mul(a2,3)^a3;
          s[4*c+2] = a0^a1^mul(a2,2)^mul(a3,3);
          s[4*c+3] = mul(a0,3)^a1^a2^mul(a3,2);
        } else {
          s[4*c]   = mul(a0,14)^mul(a1,11)^mul(a2,13)^mul(a3,9);
          s[4*c+1] = mul(a0,9)^mul(a1,14)^mul(a2,11)^mul(a3,13);
          s[4*c+2] = mul(a0,13)^mul(a1,9)^mul(a2,14)^mul(a3,11);
          s[4*c+3] = mul(a0,11)^mul(a1,13)^mul(a2,9)^mul(a3,14);
        }
      }
    }
    if (enc) {
      addRK(0);
      for (let round = 1; round < 10; round++) { subBytes(); shiftRows(); mixCols(); addRK(round); }
      subBytes(); shiftRows(); addRK(10);
    } else {
      addRK(10);
      for (let round = 9; round >= 1; round--) { shiftRows(); subBytes(); addRK(round); mixCols(); }
      shiftRows(); subBytes(); addRK(0);
    }
    for (let i = 0; i < 16; i++) out[i] = s[i];
  }
  function pad(b) {
    const n = 16 - (b.length % 16), r = b.slice();
    for (let i = 0; i < n; i++) r.push(n);
    return r;
  }
  function b64Enc(u8) {
    const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let r = '';
    for (let i = 0; i < u8.length; i += 3) {
      const b0 = u8[i], b1 = u8[i+1], b2 = u8[i+2];
      r += CH[b0 >> 2] + CH[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
      if (b1 === undefined) { r += '=='; break; }
      r += CH[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
      if (b2 === undefined) { r += '='; break; }
      r += CH[b2 & 63];
    }
    return r;
  }
  function b64Dec(s0) {
    let s = String(s0 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    while (s.length % 4 !== 0) s += '=';
    const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const T = {}; for (let i = 0; i < 64; i++) T[B.charAt(i)] = i;
    T['='] = 0;
    const out = [];
    for (let i = 0; i < s.length; i += 4) {
      const n = (T[s.charAt(i)] << 18) | (T[s.charAt(i+1)] << 12) | (T[s.charAt(i+2)] << 6) | T[s.charAt(i+3)];
      out.push((n >> 16) & 0xff);
      if (s.charAt(i+2) !== '=') out.push((n >> 8) & 0xff);
      if (s.charAt(i+3) !== '=') out.push(n & 0xff);
    }
    return out;
  }
  function utf8Dec(bytes) {
    let r = '', i = 0;
    while (i < bytes.length) {
      const b = bytes[i];
      if (b < 0x80) { r += String.fromCharCode(b); i++; }
      else if (b < 0xe0) { r += String.fromCharCode(((b & 31) << 6) | (bytes[i+1] & 63)); i += 2; }
      else if (b < 0xf0) { r += String.fromCharCode(((b & 15) << 12) | ((bytes[i+1] & 63) << 6) | (bytes[i+2] & 63)); i += 3; }
      else {
        const u = (((b & 7) << 18) | ((bytes[i+1] & 63) << 12) | ((bytes[i+2] & 63) << 6) | (bytes[i+3] & 63)) - 0x10000;
        r += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 1023)); i += 4;
      }
    }
    return r;
  }
  function utf8Enc(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const d = str.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function strBytes(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c < 256) out.push(c); }
    return out;
  }
  const KW = expandKey(strBytes(AK)), KIV = strBytes(AI);
  function enc(text) {
    const data = pad(utf8Enc(text));
    const out = [];
    let prev = KIV.slice();
    for (let off = 0; off < data.length; off += 16) {
      const blk = new Array(16), e = new Array(16);
      for (let i = 0; i < 16; i++) blk[i] = data[off + i] ^ prev[i];
      cryptBlock(blk, e, KW, true);
      for (let i = 0; i < 16; i++) out.push(e[i]);
      prev = e;
    }
    return b64Enc(out);
  }
  function dec(b64) {
    const data = b64Dec(b64);
    const out = [];
    let prev = KIV.slice();
    for (let off = 0; off + 16 <= data.length; off += 16) {
      const blk = data.slice(off, off + 16), d = new Array(16);
      cryptBlock(blk, d, KW, false);
      for (let i = 0; i < 16; i++) out.push(d[i] ^ prev[i]);
      prev = blk;
    }
    if (!out.length) return '';
    const n = out[out.length - 1];
    if (n >= 1 && n <= 16) out.length = out.length - n;
    return utf8Dec(out);
  }
  return { enc, dec };
}
const gzAES = gzMakeAES();

// 瓜子接口调用: 加密参数 -> POST form -> 解密 data
async function gzApi(path, obj) {
  const param = gzAES.enc(JSON.stringify(obj || {}));
  const body = 'parameter=' + encodeURIComponent(param);
  const tries = [
    { method: 'POST', headers: GUAZI_HEADERS, body },
    { method: 'POST', headers: GUAZI_HEADERS, data: body },
    { method: 'post', headers: GUAZI_HEADERS, body },
    { method: 1, headers: GUAZI_HEADERS, body }
  ];
  for (let i = 0; i < tries.length; i++) {
    try {
      const r = await req(HOST + '/gz/live/' + path + '?parameter=key', tries[i]);
      const txt = String((r && (r.content || r.body)) || '');
      if (!txt) continue;
      const j = JSON.parse(txt);
      const data = gzAES.dec(String(j && j.data || ''));
      if (data) return JSON.parse(data);
    } catch (e) {}
  }
  return null;
}

function timeCn(sec) {
  const t = new Date((parseInt(sec) || 0) * 1000);
  if (isNaN(t.getTime())) return '';
  const p = n => (n < 10 ? '0' : '') + n;
  return (t.getMonth() + 1) + '-' + t.getDate() + ' ' + p(t.getHours()) + ':' + p(t.getMinutes());
}

function matchToVod(it) {
  if (!it || !it.mid) return null;
  const home = (it.home && it.home.name) || '';
  const away = (it.visiting && it.visiting.name) || '';
  let name = [it.event_name, [home, away].filter(Boolean).join(' vs ')].filter(Boolean).join(' ');
  if (!name) name = '赛事 ' + it.mid;
  const parts = [];
  if (it.statusInfo) parts.push(it.statusInfo);
  else if (it.m_status >= 2) parts.push('已结束');
  else if (it.match_time) parts.push(timeCn(it.match_time));
  if (it.home && it.visiting && it.home.score !== undefined && it.visiting.score !== undefined &&
      (it.home.score !== 0 || it.visiting.score !== 0)) parts.push(it.home.score + '-' + it.visiting.score);
  const pic = (it.home && it.home.logo) || (it.visiting && it.visiting.logo) || '';
  return {
    vod_id: String(it.mid),
    vod_name: name,
    vod_pic: pic,
    vod_remarks: parts.join(' ') || '赛程'
  };
}

function getClasses() {
  return [
    { type_id: 'hot', type_name: '热门直播' },
    { type_id: 'all', type_name: '全部赛事' },
    { type_id: 'football', type_name: '足球直播' },
    { type_id: 'basketball', type_name: '篮球直播' },
    { type_id: 'nba', type_name: 'NBA' }
  ];
}

async function init(cfg) {}

function safeJson(text, def) {
  try { return JSON.parse(text || '{}'); } catch (e) { return def || {}; }
}

async function home(filter) {
  return JSON.stringify({ class: getClasses(), filters: {} });
}

async function category(tid, pg, filter, extend) {
  tid = String(tid || 'hot');
  pg = parseInt(pg) || 1;
  const size = 40;
  let obj = { frame: '0', hot: '1', tag: '0', type: '0' };
  if (tid === 'football') obj = { frame: '0', hot: '0', tag: '0', type: '1' };
  else if (tid === 'basketball') obj = { frame: '0', hot: '0', tag: '0', type: '2' };
  else if (tid === 'nba') obj = { frame: '0', hot: '0', tag: '37', type: '0' };
  let list = [];
  try {
    const j = await gzApi('sports', obj);
    const arr = (j && (j.data || j)) || [];
    const items = Array.isArray(arr) ? arr : [];
    const now = Date.now() / 1000;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      // 过滤已结束与超过 24h 的旧赛程
      if ((it.m_status || 0) >= 2) continue;
      if (it.match_time && it.match_time < now - 86400) continue;
      const vod = matchToVod(it);
      if (vod) list.push(vod);
    }
  } catch (e) {}
  return JSON.stringify({ code: 1, msg: '数据列表', page: pg, pagecount: 1, limit: size, total: list.length, list });
}

async function homeVod() { return await category('hot', 1, false, {}); }

// 缓存最近一次详情的线路(播放时优先用, 避免二次请求接口失败导致播放地址解析失败)
let gzCache = { mid: '', t: 0, lines: [] };

function gzLinesOf(it) {
  return (it && Array.isArray(it.live_line) ? it.live_line : []).filter(l => l && /^https?:\/\/.+/i.test(String(l.m3u8 || '')));
}

async function gzDetail(mid) {
  const j = await gzApi('detail', { mid: String(mid) });
  const it = j && (j.data || j) || null;
  if (it) {
    const lines = gzLinesOf(it);
    if (lines.length) gzCache = { mid: String(mid), t: Date.now(), lines };
  }
  return it;
}

function gzCacheLines(mid) {
  if (gzCache.mid === String(mid) && Date.now() - gzCache.t < 180000) return gzCache.lines;
  return [];
}

async function gzSleep(ms) {
  await new Promise(r => { if (typeof setTimeout === 'function') setTimeout(r, ms); else r(); });
}

async function search(wd, quick, pg) {
  return JSON.stringify({ code: 1, msg: '数据列表', page: 1, pagecount: 1, limit: 0, total: 0, list: [] });
}

async function detail(id) {
  id = Array.isArray(id) ? id[0] : id;
  id = String(id || '').trim();
  let vod = {
    vod_id: id,
    vod_name: '瓜子赛事 ' + id,
    vod_pic: '',
    vod_remarks: '直播',
    vod_play_from: '瓜子直播',
    vod_play_url: '',
    vod_content: '瓜子直播实时体育直播'
  };
  try {
    const it = await gzDetail(id);
    if (it) {
      const v = matchToVod(it);
      if (v) { vod.vod_name = v.vod_name; vod.vod_remarks = v.vod_remarks; vod.vod_pic = v.vod_pic; }
      const urls = [];
      const seen = {};
      const lines = gzLinesOf(it);
      for (let i = 0; i < lines.length; i++) {
        let nm = String(lines[i].name || '').trim() || ('线路' + (i + 1));
        if (seen[nm]) nm = nm + (i + 1);
        seen[nm] = 1;
        // 注意: token 绝不能以 http 开头, 否则壳会跳过 play() 直接把原始 token 塞给 WebView
        urls.push(nm + '$gz' + id + '@' + i);
      }
      if (urls.length) vod.vod_play_url = urls.join('#');
    }
  } catch (e) {}
  if (!vod.vod_play_url) vod.vod_play_url = '播放$gz' + id + '@0';
  return JSON.stringify({ list: [vod] });
}

async function play(flag, id, flags) {
  // token 格式: gz{mid}@{序号}; 用缓存/实时接口取流
  let raw = String(id || '').trim();
  if (raw.slice(0, 2) === 'gz') raw = raw.slice(2);
  let mid = raw, idx = 0;
  const at = raw.indexOf('@');
  if (at > 0) { idx = parseInt(raw.slice(at + 1)) || 0; mid = raw.slice(0, at); }
  let lines = gzCacheLines(mid);
  for (let attempt = 0; attempt < 3 && !lines.length; attempt++) {
    try {
      const it = await gzDetail(mid);
      lines = gzLinesOf(it);
    } catch (e) {}
    if (!lines.length) await gzSleep(800);
  }
  const line = lines[idx] || lines[0];
  if (line && line.m3u8) {
    return JSON.stringify(GZ_PLAY_RESULT(String(line.m3u8)));
  }
  return JSON.stringify(GZ_PLAY_RESULT(''));
}

async function homeContent(filter) { return safeJson(await home(filter), { class: [], filters: {} }); }
async function homeVideoContent() { return safeJson(await homeVod(), { list: [] }); }
async function categoryContent(tid, pg, filter, extend) { return safeJson(await category(tid, pg, filter, extend || {}), { list: [] }); }
async function detailContent(ids) { return safeJson(await detail(ids), { list: [] }); }
async function searchContent(wd, quick, pg) { return safeJson(await search(wd, quick, pg || 1), { list: [] }); }
async function playerContent(flag, id, flags) { return safeJson(await play(flag, id, flags), { parse: 1, url: id }); }
  return { init, home, homeVod, category, search, detail, play, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent };
})();


const SOURCES = [
  { id: 's0', name: '88看球', api: __sports_src_0 },
  { id: 's6', name: '瓜子直播', api: __sports_src_6 },
  { id: 's1', name: '咖啡直播', api: __sports_src_1 },
  { id: 's4', name: '爱球直播', api: __sports_src_4 },
  { id: 's3', name: 'JRS直播', api: __sports_src_3 },
  { id: 's5', name: '球吧直播', api: __sports_src_5 }
];

const SOURCE_CATS = {
  s0: [
    { n: '正在直播', v: 'live' },
    { n: '全部直播', v: '0' },
    { n: '篮球直播', v: '1' },
    { n: '足球直播', v: '8' },
    { n: '其他直播', v: '21' }
  ],
  s1: [
    { n: '全部直播', v: 'all' },
    { n: '热门直播', v: 'hot' },
    { n: 'NBA', v: 'nba' },
    { n: '足球直播', v: '1' },
    { n: '篮球直播', v: '2' },
    { n: '网球直播', v: '3' },
    { n: '台球直播', v: '19' },
    { n: '赛程列表', v: 'schedule' },
    { n: '录像', v: 'recordings' }
  ],
  s3: [
    { n: '正在直播', v: 'live' },
    { n: '全部赛程', v: 'all' },
    { n: '篮球直播', v: 'basketball' },
    { n: '足球直播', v: 'football' },
    { n: '热门赛事', v: 'hot' },
    { n: '其他赛事', v: 'other' }
  ],
  s5: [
    { n: '正在直播', v: 'live' },
    { n: '全部赛程', v: 'all' },
    { n: '足球直播', v: 'football' },
    { n: '篮球直播', v: 'basketball' }
  ],
  s6: [
    { n: '热门直播', v: 'hot' },
    { n: '全部赛事', v: 'all' },
    { n: '足球直播', v: 'football' },
    { n: '篮球直播', v: 'basketball' },
    { n: 'NBA', v: 'nba' }
  ],
  s4: [
    { n: '足球直播', v: 'zuqiu' },
    { n: '篮球直播', v: 'lanqiu' },
    { n: '实时赛程', v: 'sssc' },
    { n: '赛事回放', v: 'huifang' },
    { n: '世界杯', v: 'fifa' },
    { n: '中超', v: 'zhongchao' },
    { n: '英超', v: 'yingchao' },
    { n: '西甲', v: 'xijia' },
    { n: '德甲', v: 'dejia' },
    { n: '意甲', v: 'yijia' },
    { n: '法甲', v: 'fajia' }
  ]
};

function __safeJson(text, def) {
  if (text && typeof text === 'object') return text;
  try { return JSON.parse(text || '{}'); } catch (e) { return def || {}; }
}

function __packId(srcId, id) {
  return srcId + '@@@' + String(id || '');
}

function __splitId(id) {
  const s = String(Array.isArray(id) ? id[0] : (id || ''));
  const p = s.indexOf('@@@');
  if (p < 0) return { srcId: '', raw: s };
  return { srcId: s.slice(0, p), raw: s.slice(p + 3) };
}

function __srcById(srcId) {
  for (let i = 0; i < SOURCES.length; i++) if (SOURCES[i].id === srcId) return SOURCES[i];
  return null;
}

function __firstCat(srcId) {
  const arr = SOURCE_CATS[srcId] || [];
  return arr.length ? arr[0].v : 'home';
}

function __classes() {
  const arr = [];
  for (let i = 0; i < SOURCES.length; i++) {
    arr.push({ type_id: SOURCES[i].id, type_name: SOURCES[i].name });
  }
  return arr;
}

function __filters() {
  const filters = {};
  for (let i = 0; i < SOURCES.length; i++) {
    const src = SOURCES[i];
    const values = SOURCE_CATS[src.id] || [];
    filters[src.id] = [{ key: 'cat', name: '分类', value: values }];
  }
  return filters;
}

function __pickExtendCat(extend) {
  extend = extend || {};
  return String(extend.cat || extend.type || extend.class || extend.cate || '');
}

function __prefixList(list, src) {
  list = Array.isArray(list) ? list : [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i] || {};
    const id = String(it.vod_id || '');
    if (!id) continue;
    out.push(Object.assign({}, it, {
      vod_id: __packId(src.id, id),
      vod_name: String(it.vod_name || ''),
      vod_remarks: it.vod_remarks || src.name
    }));
  }
  return out;
}

async function __callList(src, subTid, pg, filter, extend) {
  try {
    subTid = subTid || __firstCat(src.id);
    const obj = __safeJson(await src.api.category(subTid, pg || 1, filter || false, extend || {}), {});
    return __prefixList(obj.list || [], src);
  } catch (e) {
    return [];
  }
}

async function init(cfg) {
  for (let i = 0; i < SOURCES.length; i++) {
    try { if (SOURCES[i].api.init) await SOURCES[i].api.init(cfg || {}); } catch (e) {}
  }
}

async function home(filter) {
  return JSON.stringify({ class: __classes(), filters: __filters() });
}

async function homeVod() {
  // 首页只加载第一个源的默认二级分类，避免一进源就把所有体育站数据全量请求一遍。
  const src = SOURCES[0];
  const list = await __callList(src, __firstCat(src.id), 1, false, {});
  return JSON.stringify({ code: 1, msg: '数据列表', page: 1, pagecount: 1, limit: list.length, total: list.length, list });
}

async function category(tid, pg, filter, extend) {
  tid = String(tid || SOURCES[0].id);
  extend = extend || {};
  const src = __srcById(tid) || SOURCES[0];
  const subTid = __pickExtendCat(extend) || __firstCat(src.id);
  const list = await __callList(src, subTid, pg || 1, filter, extend);
  return JSON.stringify({ code: 1, msg: '数据列表', page: parseInt(pg) || 1, pagecount: 1, limit: list.length, total: list.length, list });
}

async function detail(id) {
  const sp = __splitId(id);
  const src = __srcById(sp.srcId);
  if (!src) return JSON.stringify({ code: 1, list: [], page: 1, pagecount: 1, total: 0 });
  try {
    const obj = __safeJson(await src.api.detail(sp.raw), {});
    const list = Array.isArray(obj.list) ? obj.list : [];
    for (let i = 0; i < list.length; i++) {
      if (list[i]) list[i].vod_id = __packId(src.id, list[i].vod_id || sp.raw);
    }
    obj.list = list;
    return JSON.stringify(obj);
  } catch (e) {
    return JSON.stringify({ code: 1, list: [], page: 1, pagecount: 1, total: 0, msg: String(e && e.message || e) });
  }
}

async function search(wd, quick, pg) {
  const list = [];
  for (let i = 0; i < SOURCES.length; i++) {
    try {
      const obj = __safeJson(await SOURCES[i].api.search(wd, quick, pg || 1), {});
      const part = __prefixList(obj.list || [], SOURCES[i]);
      for (let j = 0; j < part.length; j++) list.push(part[j]);
    } catch (e) {}
  }
  return JSON.stringify({ code: 1, msg: '数据列表', page: parseInt(pg) || 1, pagecount: 1, limit: list.length, total: list.length, list });
}

async function play(flag, id, flags) {
  return JSON.stringify(await playerContent(flag, id, flags));
}

async function playerContent(flag, id, flags) {
  const sp = __splitId(id);
  let src = __srcById(sp.srcId);
  // 兜底: 部分 vod_play_url token 不带源前缀, 用线路名(flag=源名)路由
  if (!src && flag) {
    const f = String(flag);
    for (let i = 0; i < SOURCES.length; i++) {
      if (SOURCES[i].name === f || f.indexOf(SOURCES[i].name) >= 0 || SOURCES[i].name.indexOf(f) >= 0) { src = SOURCES[i]; break; }
    }
  }
  if (!src) return { parse: 1, url: sp.raw || id };
  try {
    if (src.api.playerContent) return await src.api.playerContent(flag, sp.raw, flags);
    return __safeJson(await src.api.play(flag, sp.raw, flags), { parse: 1, url: sp.raw });
  } catch (e) {
    return { parse: 1, url: sp.raw };
  }
}

async function homeContent(filter) { return __safeJson(await home(filter), { class: [], filters: {} }); }
async function homeVideoContent() { return __safeJson(await homeVod(), { list: [] }); }
async function categoryContent(tid, pg, filter, extend) { return __safeJson(await category(tid, pg, filter, extend || {}), { list: [] }); }
async function detailContent(ids) { return __safeJson(await detail(ids), { list: [] }); }
async function searchContent(wd, quick, pg) { return __safeJson(await search(wd, quick, pg || 1), { list: [] }); }

export function __jsEvalReturn() {
  return { init, home, homeVod, category, search, detail, play, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent };
}
